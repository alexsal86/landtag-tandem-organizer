import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Matrix bot handler initialized");

interface MatrixMessage {
  msgtype: string;
  body: string;
  format?: string;
  formatted_body?: string;
}

serve(async (req) => {
  console.log('🤖 Matrix function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = await req.json();
    console.log('📨 Matrix request body:', JSON.stringify(body, null, 2));

    // Get Matrix configuration from secrets
    const matrixToken = Deno.env.get('MATRIX_BOT_TOKEN');
    const matrixHomeserver = Deno.env.get('MATRIX_HOMESERVER_URL') || 'https://matrix.org';
    
    if (!matrixToken) {
      console.error('❌ Matrix bot token not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'Matrix bot token not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle test requests
    if (body.test || body.type === 'test') {
      console.log('🧪 Processing Matrix test request');
      
      try {
        // Get Matrix subscriptions for testing
        const { data: subscriptions, error } = await supabaseAdmin
          .from('matrix_subscriptions')
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

        console.log(`📋 Found ${subscriptions?.length || 0} Matrix subscriptions`);

        if (!subscriptions || subscriptions.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            sent: 0,
            failed: 0,
            total_subscriptions: 0,
            message: 'Keine aktiven Matrix-Abonnements gefunden'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create test notifications in database
        let sentCount = 0;
        for (const subscription of subscriptions) {
          if (subscription.user_id) {
            try {
              const { error: notificationError } = await supabaseAdmin
                .from('notifications')
                .insert({
                  user_id: subscription.user_id,
                  notification_type_id: '380fab61-2f1a-40d1-bed8-d34925544397',
                  title: 'Matrix-Test erfolgreich! 🤖',
                  message: 'Dies ist eine Test-Matrix-Benachrichtigung.',
                  data: { test: true, matrix_room: subscription.room_id, timestamp: new Date().toISOString() },
                  priority: 'high'
                });
                
              if (notificationError) {
                console.error('❌ Error creating notification:', notificationError);
              } else {
                sentCount++;
                console.log('✅ Test Matrix notification created for user:', subscription.user_id);
              }
            } catch (e) {
              console.error('❌ Error processing subscription:', e);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          sent: sentCount,
          failed: subscriptions.length - sentCount,
          total_subscriptions: subscriptions.length,
          message: `Matrix-Test erfolgreich - ${sentCount} Benachrichtigung(en) simuliert!`
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

    // Handle real Matrix message sending
    console.log('📤 Processing real Matrix message request');
    
    const { data: subscriptions, error } = await supabaseAdmin
      .from('matrix_subscriptions')
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

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        sent: 0,
        failed: 0,
        total_subscriptions: 0,
        message: 'Keine aktiven Matrix-Abonnements gefunden'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Send messages to all subscribed Matrix rooms
    for (const subscription of subscriptions) {
      try {
        console.log(`📤 Sending Matrix message to room ${subscription.room_id} for user ${subscription.user_id}`);
        
        const message: MatrixMessage = {
          msgtype: "m.text",
          body: body.message || 'Test-Nachricht von Ihrem Bot',
          format: "org.matrix.custom.html",
          formatted_body: `<strong>${body.title || 'Benachrichtigung'}</strong><br/>${body.message || 'Test-Nachricht von Ihrem Bot'}`
        };

        // Generate transaction ID
        const txnId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Send message to Matrix room via API
        const matrixUrl = `${matrixHomeserver}/_matrix/client/r0/rooms/${subscription.room_id}/send/m.room.message/${txnId}`;
        
        console.log(`🔗 Matrix API URL: ${matrixUrl}`);
        
        const response = await fetch(matrixUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${matrixToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Matrix API error for room ${subscription.room_id}:`, response.status, errorText);
          failedCount++;
          
          // Log the failed attempt
          await supabaseAdmin
            .from('matrix_bot_logs')
            .insert({
              user_id: subscription.user_id,
              room_id: subscription.room_id,
              message: message.body,
              success: false,
              error_message: `HTTP ${response.status}: ${errorText}`,
              timestamp: new Date().toISOString()
            });
        } else {
          const result = await response.json();
          console.log(`✅ Matrix message sent successfully to room ${subscription.room_id}:`, result);
          sentCount++;
          
          // Log the successful attempt
          await supabaseAdmin
            .from('matrix_bot_logs')
            .insert({
              user_id: subscription.user_id,
              room_id: subscription.room_id,
              message: message.body,
              success: true,
              event_id: result.event_id,
              timestamp: new Date().toISOString()
            });

          // Also create a database notification for consistency
          if (subscription.user_id) {
            await supabaseAdmin
              .from('notifications')
              .insert({
                user_id: subscription.user_id,
                notification_type_id: '380fab61-2f1a-40d1-bed8-d34925544397',
                title: body.title || 'Matrix-Nachricht gesendet 🤖',
                message: body.message || 'Eine Matrix-Nachricht wurde gesendet.',
                data: { 
                  ...body.data, 
                  matrix_sent: true, 
                  room_id: subscription.room_id,
                  event_id: result.event_id,
                  timestamp: new Date().toISOString() 
                },
                priority: body.priority || 'medium'
              });
          }
        }
        
      } catch (sendError) {
        console.error(`❌ Failed to send Matrix message to room ${subscription.room_id}:`, sendError);
        failedCount++;
        
        // Log the failed attempt
        await supabaseAdmin
          .from('matrix_bot_logs')
          .insert({
            user_id: subscription.user_id,
            room_id: subscription.room_id,
            message: body.message || 'Test message',
            success: false,
            error_message: sendError.message,
            timestamp: new Date().toISOString()
          });
      }
    }

    const totalSubscriptions = subscriptions.length;
    console.log(`📊 Matrix results: ${sentCount} sent, ${failedCount} failed out of ${totalSubscriptions} total`);

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total_subscriptions: totalSubscriptions,
      message: `Matrix-Nachrichten versendet! ${sentCount} erfolgreich, ${failedCount} fehlgeschlagen.`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Matrix function error:', error);
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