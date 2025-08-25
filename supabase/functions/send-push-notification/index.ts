import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  data?: any;
  tag?: string;
  requireInteraction?: boolean;
}

// Base64URL encoding for VAPID
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate VAPID JWT token
async function generateVapidJWT(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string,
  expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60 // 12 hours
): Promise<string> {
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };

  const payload = {
    aud: audience,
    exp: expiration,
    sub: subject
  };

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  
  // Import the private key
  const privateKeyBuffer = new Uint8Array(
    atob(privateKey.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map(char => char.charCodeAt(0))
  );

  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256'
    },
    key,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = base64UrlEncode(signature);
  return `${signingInput}.${encodedSignature}`;
}

// Web Push Protocol implementation
async function sendWebPushNotification(
  subscription: any,
  payload: string,
  vapidJWT: string,
  vapidPublicKey: string
): Promise<Response> {
  const endpoint = subscription.endpoint;
  
  console.log('📤 Sending push notification to:', endpoint);
  console.log('📦 Payload size:', payload.length);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'TTL': '86400',
    'Authorization': `vapid t=${vapidJWT}, k=${vapidPublicKey}`
  };

  // Add FCM-specific headers for Chrome/Edge
  if (endpoint.includes('fcm.googleapis.com')) {
    headers['Content-Encoding'] = 'aes128gcm';
  }

  console.log('📋 Request headers:', headers);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: payload
  });

  console.log(`📨 Push response status: ${response.status}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Push error response:', errorText);
    throw new Error(`Push failed with status ${response.status}: ${errorText}`);
  }
  
  console.log('✅ Push notification sent successfully');
  return response;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting push notification function...');
    
    // Use the NEW VAPID keys consistently - prioritize NEW keys
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY_NEW');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY_NEW');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
    
    console.log('🔑 VAPID configuration:', {
      publicKeyExists: !!vapidPublicKey,
      privateKeyExists: !!vapidPrivateKey,
      subject: vapidSubject,
      publicKeyLength: vapidPublicKey?.length || 0,
      privateKeyLength: vapidPrivateKey?.length || 0
    });

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('❌ Missing VAPID NEW configuration');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Server configuration error: Missing VAPID NEW keys',
        details: {
          publicKey: !!vapidPublicKey,
          privateKey: !!vapidPrivateKey,
          subject: !!vapidSubject
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const body = await req.json();
    console.log('📥 Received request body:', body);

    // Check if this is a test notification - handle with simplified auth
    if (body.test || body.type === 'test') {
      console.log('🧪 Processing test notification...');
      const { title = 'Test Benachrichtigung', message = 'Dies ist eine Test-Push-Benachrichtigung!', priority = 'medium' } = body;
      
      // Clean up any invalid subscriptions first
      const { error: cleanupError } = await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .or('endpoint.is.null,p256dh_key.is.null,auth_key.is.null');
      
      if (cleanupError) {
        console.warn('⚠️ Cleanup warning:', cleanupError.message);
      }

      // Get all active push subscriptions for test
      const { data: subscriptions, error: subError } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .eq('is_active', true);

      if (subError) {
        console.error('❌ Error fetching subscriptions:', subError);
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Failed to fetch subscriptions: ' + subError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`📊 Found ${subscriptions?.length || 0} active subscriptions for test`);

      if (!subscriptions || subscriptions.length === 0) {
        console.log('ℹ️ No active push subscriptions found');
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No active subscriptions to send to - Try subscribing to push notifications first',
          sent: 0,
          failed: 0,
          total_subscriptions: 0,
          results: { total: 0, success: 0, failures: 0 }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Send test notification to each subscription
      let sent = 0;
      let failed = 0;
      const results = [];

      for (const subscription of subscriptions) {
        try {
          console.log(`🔔 Sending to subscription ${subscription.id} (endpoint: ${subscription.endpoint.substring(0, 50)}...)`);
          
          // Extract audience from endpoint for VAPID JWT
          const endpointUrl = new URL(subscription.endpoint);
          const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
          
          // Generate VAPID JWT
          const vapidJWT = await generateVapidJWT(
            audience,
            vapidSubject,
            vapidPublicKey,
            vapidPrivateKey
          );

          const payload = JSON.stringify({
            title,
            body: message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'test-notification',
            requireInteraction: priority === 'high',
            data: {
              type: 'test',
              timestamp: Date.now(),
              priority
            }
          });

          await sendWebPushNotification(
            { endpoint: subscription.endpoint },
            payload,
            vapidJWT,
            vapidPublicKey
          );
          
          sent++;
          results.push({ subscription_id: subscription.id, status: 'sent' });
          console.log(`✅ Successfully sent to subscription ${subscription.id}`);
        } catch (error) {
          failed++;
          results.push({ subscription_id: subscription.id, status: 'error', error: error.message });
          console.error(`❌ Failed to send to subscription ${subscription.id}:`, error);
          
          // Deactivate failed subscription
          await supabaseAdmin
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', subscription.id);
        }
      }

      console.log(`📊 Test notification results: ${sent} sent, ${failed} failed out of ${subscriptions.length} total`);

      return new Response(JSON.stringify({ 
        success: sent > 0 || subscriptions.length === 0, 
        message: `Test notification completed: ${sent} sent, ${failed} failed out of ${subscriptions.length} subscriptions`,
        results: {
          total: subscriptions.length,
          success: sent,
          failures: failed,
          details: results
        },
        sent,
        failed,
        total_subscriptions: subscriptions.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For regular notifications, require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided for regular notification');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { persistSession: false },
        global: { headers: { authorization: authHeader } }
      }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For regular notifications, process directly (test notifications already handled above)

    // Handle regular notifications
    const { notification_id } = body;
    if (!notification_id) {
      throw new Error('notification_id is required for non-test notifications');
    }

    // Get notification details
    const { data: notification, error: notificationError } = await supabaseAdmin
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
    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
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
    const { data: settings } = await supabaseAdmin
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

    // Prepare push payload
    const payload = {
      title: notification.title,
      body: notification.message,
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

    console.log(`🚀 Processing ${subscriptions.length} subscriptions for notification`);

    // Send push notifications to all subscriptions
    for (const subscription of subscriptions) {
      try {
        console.log(`📨 Sending to subscription: ${subscription.id}`);
        
        // Extract audience from endpoint for VAPID JWT
        const endpointUrl = new URL(subscription.endpoint);
        const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
        
        // Generate VAPID JWT
        const vapidJWT = await generateVapidJWT(
          audience,
          vapidSubject,
          vapidPublicKey,
          vapidPrivateKey
        );

        await sendWebPushNotification(
          { endpoint: subscription.endpoint },
          JSON.stringify(payload),
          vapidJWT,
          vapidPublicKey
        );
        
        sentCount++;
        console.log(`✅ Successfully sent notification to subscription ${subscription.id}`);
      } catch (error) {
        console.error(`❌ Error sending notification to subscription ${subscription.id}:`, error);
        failedSubscriptions.push(subscription.id);
      }
    }

    // Deactivate failed subscriptions
    if (failedSubscriptions.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('id', failedSubscriptions);
    }

    // Mark notification as pushed
    await supabaseAdmin
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