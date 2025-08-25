import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Push notification function initialized");

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

        // Send simple test notifications
        let sent = 0;
        let failed = 0;

        for (const subscription of subscriptions) {
          try {
            // Simple fetch to the push service
            const response = await fetch(subscription.endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'TTL': '2419200'
              },
              body: JSON.stringify({
                title: 'Test-Benachrichtigung',
                body: 'Dies ist eine Test-Push-Benachrichtigung!',
                icon: '/favicon.ico'
              })
            });

            if (response.ok) {
              sent++;
              console.log(`✅ Push sent to subscription ${subscription.id}`);
            } else {
              failed++;
              console.log(`❌ Push failed to subscription ${subscription.id}: ${response.status}`);
              // Deactivate failed subscription
              await supabaseAdmin
                .from('push_subscriptions')
                .update({ is_active: false })
                .eq('id', subscription.id);
            }
          } catch (pushError) {
            failed++;
            console.error(`❌ Push error for subscription ${subscription.id}:`, pushError);
            // Deactivate failed subscription
            await supabaseAdmin
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', subscription.id);
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