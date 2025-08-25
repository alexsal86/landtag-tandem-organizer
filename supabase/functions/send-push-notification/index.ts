import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Push notification function initialized");

// Simplified Web Push implementation for testing
async function sendWebPushNotification(endpoint: string, payload: string, vapidPublicKey: string): Promise<Response> {
  console.log(`📤 Sending to endpoint: ${endpoint.substring(0, 50)}...`);
  
  // For testing, try different approaches
  const approaches = [
    // Approach 1: Minimal headers for testing
    async () => {
      console.log('🔄 Trying minimal approach...');
      return fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'TTL': '2419200'
        },
        body: payload
      });
    },
    
    // Approach 2: With VAPID header but no encryption
    async () => {
      console.log('🔄 Trying VAPID approach...');
      return fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `WebPush ${vapidPublicKey}`,
          'Content-Type': 'application/json',
          'TTL': '2419200'
        },
        body: payload
      });
    },
    
    // Approach 3: Chrome-style push
    async () => {
      console.log('🔄 Trying Chrome approach...');
      return fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': payload.length.toString(),
          'TTL': '2419200'
        },
        body: payload
      });
    }
  ];
  
  // Try each approach until one works
  for (const [index, approach] of approaches.entries()) {
    try {
      const response = await approach();
      console.log(`📊 Approach ${index + 1} result: ${response.status}`);
      
      if (response.ok || response.status === 201) {
        console.log(`✅ Approach ${index + 1} succeeded!`);
        return response;
      } else {
        const text = await response.text();
        console.log(`⚠️ Approach ${index + 1} failed: ${response.status} - ${text}`);
      }
    } catch (error) {
      console.log(`❌ Approach ${index + 1} error:`, error.message);
    }
  }
  
  // If all approaches fail, return the last failed response
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting push notification function...');
    
    // Test VAPID keys first
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY_FRESH') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY_FRESH') || '';
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:mail@alexander-salomon.de';
    
    console.log('🔑 VAPID Keys Check:', {
      publicKeyExists: !!vapidPublicKey,
      privateKeyExists: !!vapidPrivateKey,
      publicKeyLength: vapidPublicKey.length,
      privateKeyLength: vapidPrivateKey.length,
      subject: vapidSubject
    });

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('❌ VAPID keys missing!');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'VAPID keys not configured',
        debug: {
          publicKeyExists: !!vapidPublicKey,
          privateKeyExists: !!vapidPrivateKey,
          publicKeyLength: vapidPublicKey.length,
          privateKeyLength: vapidPrivateKey.length
        }
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const body = await req.json();
    console.log('📦 Request body:', body);

    // Initialize Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // For test requests, check subscriptions but don't send yet
    if (body.test || body.type === 'test') {
      console.log('✅ Test request - checking subscriptions...');
      
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

        // Send Web Push notifications with VAPID authentication
        let sent = 0;
        let failed = 0;

        for (const subscription of subscriptions) {
          try {
            console.log(`📤 Testing push to subscription ${subscription.id}`);
            
            // Prepare the payload
            const payload = JSON.stringify({
              title: body.title || 'Test-Benachrichtigung',
              body: body.message || 'Dies ist eine Test-Push-Benachrichtigung!',
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              data: body.data || {}
            });

            // Use the simplified approach that tries multiple methods
            const response = await sendWebPushNotification(subscription.endpoint, payload, vapidPublicKey);

            if (response.ok || response.status === 201) {
              sent++;
              console.log(`✅ Push sent successfully to subscription ${subscription.id}`);
            } else {
              failed++;
              const responseText = await response.text().catch(() => 'Unable to read response');
              console.log(`❌ Push failed to subscription ${subscription.id}: ${response.status} - ${responseText}`);
              
              // Deactivate failed subscription if it's invalid (410 = Gone)
              if (response.status === 410 || response.status === 404) {
                await supabaseAdmin
                  .from('push_subscriptions')
                  .update({ is_active: false })
                  .eq('id', subscription.id);
                console.log(`🗑️ Deactivated invalid subscription ${subscription.id}`);
              }
            }
          } catch (pushError) {
            failed++;
            console.error(`❌ Push error for subscription ${subscription.id}:`, pushError);
            // Don't deactivate on network errors, only on invalid subscriptions
          }
        }

        console.log(`✅ Test complete: ${sent} sent, ${failed} failed`);

        return new Response(JSON.stringify({
          success: sent > 0,
          sent,
          failed,
          total_subscriptions: subscriptions.length,
          message: sent > 0 ? 'Test notifications sent successfully!' : 'No notifications could be sent'
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

    // For real notifications, return not implemented for now
    return new Response(JSON.stringify({
      success: false,
      error: 'Real push notifications not implemented yet'
    }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Function error: ' + error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});