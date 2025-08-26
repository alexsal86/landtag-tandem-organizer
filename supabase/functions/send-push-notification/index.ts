import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Push notification function initialized");

serve(async (req) => {
  console.log('🚀 Function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('📋 Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET request for VAPID public key
  if (req.method === 'GET') {
    console.log('🔑 Providing VAPID public key...');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    
    if (!vapidPublicKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'VAPID public key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      publicKey: vapidPublicKey
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('📦 Starting to parse request body...');
    
    // Parse request body
    const body = await req.json();
    console.log('✅ Request body parsed:', JSON.stringify(body, null, 2));

    // Initialize Supabase
    console.log('🔗 Initializing Supabase...');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if this is a test request
    const isTestRequest = body.test || body.type === 'test';
    console.log('🧪 Is test request:', isTestRequest);

    if (isTestRequest) {
      console.log('✅ Processing TEST request - simulating successful push...');
      
      try {
        // Get all active push subscriptions
        const { data: subscriptions, error } = await supabaseAdmin
          .from('push_subscriptions')
          .select('*')
          .eq('is_active', true);

        if (error) {
          console.error('❌ Database error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Database error: ' + error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`📋 Found ${subscriptions?.length || 0} active subscriptions`);

        if (!subscriptions || subscriptions.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            sent: 0,
            failed: 0,
            total_subscriptions: 0,
            message: 'No active push subscriptions found'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create test notifications in database
        console.log('🎭 Creating test notifications in database...');
        
        for (const subscription of subscriptions) {
          console.log(`📝 Creating test notification for user ${subscription.user_id}...`);
          
          if (subscription.user_id) {
            const { error: notificationError } = await supabaseAdmin
              .from('notifications')
              .insert({
                user_id: subscription.user_id,
                notification_type_id: '380fab61-2f1a-40d1-bed8-d34925544397',
                title: 'Push-Test erfolgreich! 🎉',
                message: 'Dies ist eine Test-Push-Benachrichtigung über die Datenbank.',
                data: { test: true, timestamp: new Date().toISOString() },
                priority: 'high'
              });
              
            if (notificationError) {
              console.error('❌ Error creating notification:', notificationError);
            } else {
              console.log('✅ Test notification created in database');
            }
          }
        }

        console.log('✅ Test complete: simulated success');

        return new Response(JSON.stringify({
          success: true,
          sent: subscriptions.length,
          failed: 0,
          total_subscriptions: subscriptions.length,
          message: `Test erfolgreich - ${subscriptions.length} Benachrichtigung(en) simuliert! (Check die Benachrichtigungsglocke oben rechts)`
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (dbError) {
        console.error('❌ Database connection error:', dbError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Database connection failed: ' + dbError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Real push notification request
      console.log('🔔 Processing REAL push notification request...');
      
      // Configure web-push with VAPID details
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
      const vapidSubject = Deno.env.get('VAPID_SUBJECT');
      
      if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
        console.error('❌ Missing VAPID configuration');
        return new Response(JSON.stringify({
          success: false,
          error: 'VAPID configuration missing'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('🔧 Configuring web-push with VAPID...');
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      
      try {
        // Get all active push subscriptions
        const { data: subscriptions, error } = await supabaseAdmin
          .from('push_subscriptions')
          .select('*')
          .eq('is_active', true);

        if (error) {
          console.error('❌ Database error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Database error: ' + error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`📋 Found ${subscriptions?.length || 0} active subscriptions`);

        if (!subscriptions || subscriptions.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            sent: 0,
            failed: 0,
            total_subscriptions: 0,
            message: 'No active push subscriptions found'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Prepare notification payload
        const notificationPayload = JSON.stringify({
          title: body.title || 'Test Push Notification 🔔',
          body: body.message || 'Dies ist eine echte Browser-Push-Benachrichtigung!',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          data: body.data || { timestamp: new Date().toISOString() },
          actions: [
            {
              action: 'open',
              title: 'Öffnen'
            }
          ],
          requireInteraction: false,
          silent: false
        });
        
        console.log('📨 Sending push notifications...');
        let sentCount = 0;
        let failedCount = 0;
        
        // Send push notifications to all subscriptions
        for (const subscription of subscriptions) {
          try {
            console.log(`📤 Sending push to user ${subscription.user_id}...`);
            
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh_key,
                auth: subscription.auth_key
              }
            };
            
            await webpush.sendNotification(pushSubscription, notificationPayload);
            sentCount++;
            console.log(`✅ Push sent successfully to user ${subscription.user_id}`);
            
            // Also create a database notification for consistency
            if (subscription.user_id) {
              await supabaseAdmin
                .from('notifications')
                .insert({
                  user_id: subscription.user_id,
                  notification_type_id: '380fab61-2f1a-40d1-bed8-d34925544397',
                  title: body.title || 'Push Notification erhalten 🔔',
                  message: body.message || 'Eine Browser-Push-Benachrichtigung wurde gesendet.',
                  data: { ...body.data, pushed: true, timestamp: new Date().toISOString() },
                  priority: body.priority || 'medium'
                });
            }
            
          } catch (pushError) {
            console.error(`❌ Failed to send push to user ${subscription.user_id}:`, pushError);
            failedCount++;
            
            // If the subscription is invalid, mark it as inactive
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
              console.log(`🗑️ Marking invalid subscription as inactive for user ${subscription.user_id}`);
              await supabaseAdmin
                .from('push_subscriptions')
                .update({ is_active: false })
                .eq('id', subscription.id);
            }
          }
        }
        
        const totalSubscriptions = subscriptions.length;
        console.log(`📊 Push notification results: ${sentCount} sent, ${failedCount} failed out of ${totalSubscriptions} total`);
        
        return new Response(JSON.stringify({
          success: true,
          sent: sentCount,
          failed: failedCount,
          total_subscriptions: totalSubscriptions,
          message: `Browser-Push erfolgreich! ${sentCount} Benachrichtigung(en) gesendet, ${failedCount} fehlgeschlagen.`
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (dbError) {
        console.error('❌ Database connection error:', dbError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Database connection failed: ' + dbError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

  } catch (error) {
    console.error('❌ Function error:', error);
    console.error('❌ Error stack:', error.stack);
    return new Response(JSON.stringify({
      success: false,
      error: 'Function error: ' + error.message,
      sent: 0,
      failed: 1,
      total_subscriptions: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});