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
  decision_metadata?: {
    decision_id: string;
    participant_token: string;
    expires_at: string;
  };
}

interface DecisionMatrixMessage extends MatrixMessage {
  decision_metadata: {
    decision_id: string;
    participant_token: string;
    expires_at: string;
  };
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

    // Handle test requests - now sends REAL Matrix messages for testing
    if (body.test || body.type === 'test') {
      console.log('🧪 Processing Matrix test request - sending REAL messages');
      
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

        let sentCount = 0;
        let failedCount = 0;

        // Send REAL Matrix test messages
        for (const subscription of subscriptions) {
          try {
            console.log(`🧪 Sending TEST Matrix message to room ${subscription.room_id}`);
            
            const testMessage: MatrixMessage = {
              msgtype: "m.text",
              body: body.message || 'Dies ist eine Test-Nachricht aus der Matrix-Integration! 🤖',
              format: "org.matrix.custom.html",
              formatted_body: `<strong>🧪 ${body.title || 'Matrix-Test'}</strong><br/>${body.message || 'Dies ist eine Test-Nachricht aus der Matrix-Integration!'}`
            };

            // Generate transaction ID
            const txnId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Send message to Matrix room via API
            const matrixUrl = `${matrixHomeserver}/_matrix/client/r0/rooms/${subscription.room_id}/send/m.room.message/${txnId}`;
            
            console.log(`🔗 Matrix API URL: ${matrixUrl}`);
            console.log(`🔑 Using homeserver: ${matrixHomeserver}`);
            
            const response = await fetch(matrixUrl, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${matrixToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(testMessage)
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
                  message: testMessage.body,
                  success: false,
                  error_message: `HTTP ${response.status}: ${errorText}`,
                  timestamp: new Date().toISOString()
                });
            } else {
              const result = await response.json();
              console.log(`✅ TEST Matrix message sent successfully to room ${subscription.room_id}:`, result);
              sentCount++;
              
              // Log the successful attempt
              await supabaseAdmin
                .from('matrix_bot_logs')
                .insert({
                  user_id: subscription.user_id,
                  room_id: subscription.room_id,
                  message: testMessage.body,
                  success: true,
                  event_id: result.event_id,
                  timestamp: new Date().toISOString()
                });

              // Also create a database notification
              if (subscription.user_id) {
                await supabaseAdmin
                  .from('notifications')
                  .insert({
                    user_id: subscription.user_id,
                    notification_type_id: '380fab61-2f1a-40d1-bed8-d34925544397',
                    title: '🧪 Matrix-Test erfolgreich!',
                    message: 'Test-Nachricht wurde erfolgreich an Matrix gesendet.',
                    data: { 
                      test: true, 
                      matrix_sent: true,
                      room_id: subscription.room_id,
                      event_id: result.event_id,
                      timestamp: new Date().toISOString() 
                    },
                    priority: 'high'
                  });
              }
            }
            
          } catch (sendError) {
            console.error(`❌ Failed to send TEST Matrix message to room ${subscription.room_id}:`, sendError);
            failedCount++;
            
            // Log the failed attempt
            await supabaseAdmin
              .from('matrix_bot_logs')
              .insert({
                user_id: subscription.user_id,
                room_id: subscription.room_id,
                message: body.message || 'Test message',
                success: false,
                error_message: sendError instanceof Error ? sendError.message : String(sendError),
                timestamp: new Date().toISOString()
              });
          }
        }

        return new Response(JSON.stringify({
          success: sentCount > 0,
          sent: sentCount,
          failed: failedCount,
          total_subscriptions: subscriptions.length,
          message: sentCount > 0 
            ? `✅ Matrix-Test erfolgreich! ${sentCount} echte Nachrichten gesendet, ${failedCount} fehlgeschlagen.`
            : `❌ Matrix-Test fehlgeschlagen. ${failedCount} Nachrichten konnten nicht gesendet werden.`
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (dbError) {
        console.error('❌ Database connection error:', dbError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Database connection failed: ' + (dbError instanceof Error ? dbError.message : String(dbError))
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle decision message sending
    if (body.type === 'decision') {
      console.log('🗳️ Processing Matrix decision message request');
      return await sendDecisionMessages(body, supabaseAdmin, matrixToken, matrixHomeserver);
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
            error_message: sendError instanceof Error ? sendError.message : String(sendError),
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
      error: 'Function error: ' + (error instanceof Error ? error.message : String(error)),
      sent: 0,
      failed: 1,
      total_subscriptions: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function sendDecisionMessages(
  body: any,
  supabaseAdmin: any,
  matrixToken: string,
  matrixHomeserver: string
) {
  try {
    console.log('🗳️ Sending decision messages via Matrix');
    
    const { decisionId, participantIds, decisionTitle, decisionDescription } = body;
    
    if (!decisionId || !participantIds || !Array.isArray(participantIds)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: decisionId, participantIds'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each participant
    for (const participantId of participantIds) {
      try {
        console.log(`📤 Processing Matrix decision for participant: ${participantId}`);

        // Get participant token
        const { data: participant, error: participantError } = await supabaseAdmin
          .from('task_decision_participants')
          .select('id, token, user_id')
          .eq('decision_id', decisionId)
          .eq('user_id', participantId)
          .maybeSingle();

        if (participantError || !participant) {
          console.error('❌ Participant not found:', participantId);
          failedCount++;
          results.push({ participantId, success: false, error: 'Participant not found' });
          continue;
        }

        // Get user's Matrix subscription
        const { data: matrixSub, error: matrixError } = await supabaseAdmin
          .from('matrix_subscriptions')
          .select('room_id, user_id')
          .eq('user_id', participantId)
          .eq('is_active', true)
          .maybeSingle();

        if (matrixError || !matrixSub) {
          console.log(`ℹ️ No Matrix subscription for user ${participantId}, skipping Matrix send`);
          results.push({ participantId, success: false, error: 'No Matrix subscription' });
          failedCount++;
          continue;
        }

        // Create decision message with commands
        const token = participant.token;
        const expireDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        const decisionMessage: DecisionMatrixMessage = {
          msgtype: "m.text",
          body: `🗳️ ENTSCHEIDUNGSANFRAGE: ${decisionTitle}\n\n` +
                `${decisionDescription || ''}\n\n` +
                `📋 Antwortmöglichkeiten:\n` +
                `✅ /decision-yes ${token}\n` +
                `❌ /decision-no ${token}\n` +
                `❓ /decision-question ${token} [Ihre Frage]\n` +
                `📊 /decision-status ${token}\n\n` +
                `⏰ Antworten bis: ${expireDate.toLocaleDateString('de-DE')}`,
          format: "org.matrix.custom.html",
          formatted_body: `<h3>🗳️ ENTSCHEIDUNGSANFRAGE: ${decisionTitle}</h3>` +
                          `${decisionDescription ? `<p><em>${decisionDescription}</em></p>` : ''}` +
                          `<h4>📋 Antwortmöglichkeiten:</h4>` +
                          `<ul>` +
                          `<li>✅ <code>/decision-yes ${token}</code></li>` +
                          `<li>❌ <code>/decision-no ${token}</code></li>` +
                          `<li>❓ <code>/decision-question ${token} [Ihre Frage]</code></li>` +
                          `<li>📊 <code>/decision-status ${token}</code></li>` +
                          `</ul>` +
                          `<p><small>⏰ Antworten bis: ${expireDate.toLocaleDateString('de-DE')}</small></p>`,
          decision_metadata: {
            decision_id: decisionId,
            participant_token: token,
            expires_at: expireDate.toISOString()
          }
        };

        // Send Matrix message
        const txnId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const matrixUrl = `${matrixHomeserver}/_matrix/client/r0/rooms/${matrixSub.room_id}/send/m.room.message/${txnId}`;
        
        console.log(`🔗 Sending decision to Matrix room: ${matrixSub.room_id}`);
        
        const response = await fetch(matrixUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${matrixToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(decisionMessage)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Matrix API error for user ${participantId}:`, response.status, errorText);
          failedCount++;
          results.push({ participantId, success: false, error: `Matrix API error: ${response.status}` });
        } else {
          const result = await response.json();
          console.log(`✅ Decision message sent via Matrix to user ${participantId}`);
          sentCount++;
          
          // Track the Matrix message
          await supabaseAdmin
            .from('decision_matrix_messages')
            .insert({
              decision_id: decisionId,
              participant_id: participant.id,
              matrix_room_id: matrixSub.room_id,
              matrix_event_id: result.event_id,
              sent_at: new Date().toISOString()
            });

          results.push({ 
            participantId, 
            success: true, 
            matrixEventId: result.event_id,
            roomId: matrixSub.room_id 
          });
        }

      } catch (error) {
        console.error(`❌ Error sending Matrix decision to ${participantId}:`, error);
        failedCount++;
        results.push({ 
          participantId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    console.log(`📊 Matrix decision results: ${sentCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({
      success: sentCount > 0,
      sent: sentCount,
      failed: failedCount,
      total_participants: participantIds.length,
      message: `Matrix-Entscheidungen versendet! ${sentCount} erfolgreich, ${failedCount} fehlgeschlagen.`,
      results: results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in sendDecisionMessages:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error sending Matrix decisions: ' + (error instanceof Error ? error.message : String(error))
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}