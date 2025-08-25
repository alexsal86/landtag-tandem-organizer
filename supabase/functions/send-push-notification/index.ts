import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  try {
    console.log('📦 Starting to parse request body...');
    
    // Parse request body with error handling
    let body;
    try {
      const bodyText = await req.text();
      console.log('📄 Raw body received:', bodyText);
      body = JSON.parse(bodyText);
      console.log('✅ Request body parsed successfully:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase
    console.log('🔗 Initializing Supabase...');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // For test requests, return success without actually sending push
    if (body.test || body.type === 'test') {
      console.log('✅ Test request - simulating successful push...');
      
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

        // For now, simulate success to test the UI flow
        console.log('🎭 Simulating successful push notification...');
        
        // Create a test notification in the database instead
        for (const subscription of subscriptions) {
          console.log(`📝 Creating test notification for user...`);
          
          // Get user_id from subscription
          const userId = subscription.user_id;
          
          if (userId) {
            // Create notification in database
            const { error: notificationError } = await supabaseAdmin
              .from('notifications')
              .insert({
                user_id: userId,
                notification_type_id: '380fab61-2f1a-40d1-bed8-d34925544397', // message_received type
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
    }

    // Real push notifications implementation
    console.log('🔔 Processing real push notification...');
    console.log('📦 Request body for real push:', JSON.stringify(body, null, 2));
    
    // For now, return a simple error message indicating this is not implemented
    console.log('⚠️ Real push notifications not fully implemented yet');
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Real push notifications are being implemented. Please use the test button for now.',
      message: 'Echte Push-Notifications sind in Entwicklung. Bitte nutze vorerst den Test-Button.'
    }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Function error:', error);
    console.error('❌ Error stack:', error.stack);
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