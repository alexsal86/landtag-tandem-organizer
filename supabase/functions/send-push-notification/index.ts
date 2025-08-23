import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  message: string;
  icon?: string;
  badge?: string;
  data?: any;
  tag?: string;
  requireInteraction?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the user from the request
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { notification_id } = await req.json();

    if (!notification_id) {
      throw new Error('notification_id is required');
    }

    // Get notification details
    const { data: notification, error: notificationError } = await supabaseClient
      .from('notifications')
      .select(`
        *,
        notification_types(name, label)
      `)
      .eq('id', notification_id)
      .single();

    if (notificationError || !notification) {
      throw new Error('Notification not found');
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subscriptionsError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', notification.user_id)
      .eq('is_active', true);

    if (subscriptionsError) {
      throw new Error('Failed to get subscriptions');
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No active push subscriptions found for user');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check user's notification settings
    const { data: settings } = await supabaseClient
      .from('user_notification_settings')
      .select('*')
      .eq('user_id', notification.user_id)
      .eq('notification_type_id', notification.notification_type_id)
      .single();

    if (!settings?.push_enabled) {
      console.log('Push notifications disabled for this notification type');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check quiet hours
    if (settings.quiet_hours_start && settings.quiet_hours_end) {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      
      if (currentTime >= settings.quiet_hours_start && currentTime <= settings.quiet_hours_end) {
        console.log('Current time is within quiet hours');
        return new Response(JSON.stringify({ success: true, sent: 0, reason: 'quiet_hours' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    // Prepare push payload
    const payload: PushPayload = {
      title: notification.title,
      message: notification.message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        notification_id: notification.id,
        type: notification.notification_types?.name,
        ...notification.data,
      },
      tag: notification.notification_types?.name,
      requireInteraction: notification.priority === 'urgent',
    };

    let sentCount = 0;
    const failedSubscriptions: string[] = [];

    // Send push notifications to all subscriptions
    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key,
          },
        };

        // Use web-push library equivalent for Deno
        const response = await fetch(subscription.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'Authorization': `WebPush ${vapidPrivateKey}`,
            'Crypto-Key': `p256ecdsa=${vapidPublicKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          sentCount++;
        } else {
          console.error(`Failed to send push notification: ${response.status}`);
          failedSubscriptions.push(subscription.id);
        }
      } catch (error) {
        console.error('Error sending push notification:', error);
        failedSubscriptions.push(subscription.id);
      }
    }

    // Deactivate failed subscriptions
    if (failedSubscriptions.length > 0) {
      await supabaseClient
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('id', failedSubscriptions);
    }

    // Mark notification as pushed
    await supabaseClient
      .from('notifications')
      .update({ 
        is_pushed: true, 
        push_sent_at: new Date().toISOString() 
      })
      .eq('id', notification_id);

    return new Response(JSON.stringify({ 
      success: true, 
      sent: sentCount,
      failed: failedSubscriptions.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});