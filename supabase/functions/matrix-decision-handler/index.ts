import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Matrix decision handler initialized");

interface MatrixIncomingMessage {
  room_id: string;
  sender: string;
  content: {
    msgtype: string;
    body: string;
  };
  event_id: string;
  event_type: string;
}

interface DecisionCommand {
  command: 'yes' | 'no' | 'question' | 'status';
  token: string;
  message?: string;
}

serve(async (req) => {
  console.log('🤖 Matrix decision handler called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse incoming Matrix message or webhook
    const body = await req.json();
    console.log('📨 Matrix decision request body:', JSON.stringify(body, null, 2));

    // Initialize Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Handle Matrix webhook events from Matrix server
    if (body.type === 'matrix_webhook' && body.events) {
      console.log('🔄 Processing Matrix webhook events');
      
      for (const event of body.events) {
        if (event.type === 'm.room.message' && event.content?.msgtype === 'm.text') {
          await handleMatrixMessage(event, supabaseAdmin, matrixToken, matrixHomeserver);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle direct command processing (for testing or direct API calls)
    if (body.command && body.token) {
      const result = await processDecisionCommand(body, supabaseAdmin, matrixToken, matrixHomeserver);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle manual Matrix message simulation
    if (body.room_id && body.sender && body.content) {
      const result = await handleMatrixMessage(body, supabaseAdmin, matrixToken, matrixHomeserver);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid request format'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Matrix decision handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Function error: ' + (error instanceof Error ? error.message : String(error))
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleMatrixMessage(
  message: MatrixIncomingMessage, 
  supabase: any, 
  matrixToken: string, 
  matrixHomeserver: string
) {
  console.log(`📥 Processing Matrix message from ${message.sender} in room ${message.room_id}`);
  console.log(`💬 Message content: ${message.content.body}`);

  const body = message.content.body;
  
  // Parse decision commands: /decision-yes <token>, /decision-no <token>, etc.
  const commandRegex = /^\/decision-(yes|no|question|status)\s+([a-zA-Z0-9]+)(?:\s+(.+))?$/;
  const match = body.match(commandRegex);
  
  if (!match) {
    console.log('💭 Message is not a decision command, ignoring');
    return { success: true, message: 'Not a decision command' };
  }

  const [, command, token, messageText] = match;
  
  console.log(`⚡ Decision command detected: ${command} with token ${token}`);
  
  // Find the participant by token
  const { data: participant, error: participantError } = await supabase
    .from('task_decision_participants')
    .select(`
      id,
      user_id,
      decision_id,
      token,
      response_type,
      responded_at,
      task_decisions!inner(
        id,
        title,
        description,
        created_by,
        tenant_id
      )
    `)
    .eq('token', token)
    .maybeSingle();

  if (participantError || !participant) {
    console.error('❌ Participant not found for token:', token, participantError);
    
    await sendMatrixResponse(message.room_id, 
      '❌ Ungültiger Token oder Entscheidung nicht gefunden.', 
      matrixToken, matrixHomeserver);
    
    return { success: false, error: 'Invalid token' };
  }

  // Check if user has already responded
  if (participant.responded_at) {
    console.log('⚠️ User has already responded to this decision');
    
    await sendMatrixResponse(message.room_id, 
      `ℹ️ Sie haben bereits geantwortet: ${participant.response_type}`, 
      matrixToken, matrixHomeserver);
    
    return { success: false, error: 'Already responded' };
  }

  const decision = participant.task_decisions;

  // Process the response
  let responseType: string;
  let comments: string | null = null;

  switch (command) {
    case 'yes':
      responseType = 'yes';
      break;
    case 'no':
      responseType = 'no';
      break;
    case 'question':
      responseType = 'question';
      comments = messageText || 'Rückfrage gestellt via Matrix';
      break;
    case 'status':
      // Show current decision status
      const { data: allParticipants } = await supabase
        .from('task_decision_participants')
        .select('response_type, responded_at')
        .eq('decision_id', participant.decision_id);
      
      const responded = allParticipants?.filter((p: any) => p.responded_at).length || 0;
      const total = allParticipants?.length || 0;
      const yesCount = allParticipants?.filter((p: any) => p.response_type === 'yes').length || 0;
      const noCount = allParticipants?.filter((p: any) => p.response_type === 'no').length || 0;
      const questionCount = allParticipants?.filter((p: any) => p.response_type === 'question').length || 0;
      
      await sendMatrixResponse(message.room_id, 
        `📊 Status für "${decision.title}":\n` +
        `✅ Ja: ${yesCount}\n` +
        `❌ Nein: ${noCount}\n` +
        `❓ Fragen: ${questionCount}\n` +
        `📈 Geantwortet: ${responded}/${total}`, 
        matrixToken, matrixHomeserver);
      
      return { success: true, message: 'Status sent' };
    default:
      return { success: false, error: 'Unknown command' };
  }

  // Update participant response
  const { error: updateError } = await supabase
    .from('task_decision_participants')
    .update({
      response_type: responseType,
      comments: comments,
      responded_at: new Date().toISOString(),
      matrix_user_id: message.sender
    })
    .eq('id', participant.id);

  if (updateError) {
    console.error('❌ Error updating participant response:', updateError);
    
    await sendMatrixResponse(message.room_id, 
      '❌ Fehler beim Speichern der Antwort.', 
      matrixToken, matrixHomeserver);
    
    return { success: false, error: 'Database error' };
  }

  // Track Matrix response
  await supabase
    .from('decision_matrix_messages')
    .insert({
      decision_id: participant.decision_id,
      participant_id: participant.id,
      matrix_room_id: message.room_id,
      matrix_event_id: message.event_id || 'unknown',
      responded_via_matrix: true
    });

  // Send confirmation message
  let confirmationMessage: string;
  switch (responseType) {
    case 'yes':
      confirmationMessage = `✅ Entscheidung registriert: JA für "${decision.title}"`;
      break;
    case 'no':
      confirmationMessage = `❌ Entscheidung registriert: NEIN für "${decision.title}"`;
      break;
    case 'question':
      confirmationMessage = `❓ Rückfrage gestellt für "${decision.title}": ${comments}`;
      break;
    default:
      confirmationMessage = `📝 Antwort gespeichert für "${decision.title}"`;
  }

  await sendMatrixResponse(message.room_id, confirmationMessage, matrixToken, matrixHomeserver);

  // Check if all participants have responded
  const { data: allParticipants } = await supabase
    .from('task_decision_participants')
    .select('responded_at')
    .eq('decision_id', participant.decision_id);

  const allResponded = allParticipants?.every((p: any) => p.responded_at);
  
  if (allResponded) {
    console.log('🎉 All participants have responded, notifying creator');
    
    // Notify the decision creator
    await supabase.rpc('create_notification', {
      user_id_param: decision.created_by,
      type_name: 'task_decision_completed',
      title_param: 'Entscheidung abgeschlossen',
      message_param: `Alle Teilnehmer haben auf "${decision.title}" geantwortet.`,
      data_param: {
        decision_id: participant.decision_id,
        completed_via_matrix: true
      },
      priority_param: 'high'
    });
  }

  console.log(`✅ Decision response processed successfully: ${responseType}`);
  
  return { 
    success: true, 
    message: 'Response processed',
    response_type: responseType,
    decision_title: decision.title
  };
}

async function processDecisionCommand(
  command: DecisionCommand, 
  supabase: any, 
  matrixToken: string, 
  matrixHomeserver: string
) {
  // This function can be used for direct API testing or future enhancements
  console.log(`🎯 Processing direct decision command: ${command.command} for token ${command.token}`);
  
  // Implementation similar to handleMatrixMessage but for direct API calls
  return { success: true, message: 'Direct command processed' };
}

async function sendMatrixResponse(
  roomId: string, 
  message: string, 
  matrixToken: string, 
  matrixHomeserver: string
) {
  try {
    const txnId = `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const matrixUrl = `${matrixHomeserver}/_matrix/client/r0/rooms/${roomId}/send/m.room.message/${txnId}`;
    
    const response = await fetch(matrixUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${matrixToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: "m.text",
        body: message,
        format: "org.matrix.custom.html",
        formatted_body: message.replace(/\n/g, '<br/>')
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to send Matrix response: ${response.status} ${errorText}`);
    } else {
      console.log(`✅ Matrix response sent to room ${roomId}: ${message}`);
    }
  } catch (error) {
    console.error('❌ Error sending Matrix response:', error);
  }
}