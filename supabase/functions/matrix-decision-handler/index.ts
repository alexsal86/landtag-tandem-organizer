// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/security.ts";

import { withSafeHandler } from "../_shared/security.ts";
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

Deno.serve(withSafeHandler("matrix-decision-handler", async (req) => {
  console.log('🤖 Matrix decision handler called with method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: accept either an authenticated Supabase user (in-app/test) or a
  // valid shared secret in the X-Matrix-Webhook-Secret header (Matrix server).
  const { requireAuth, requireSharedSecret, unauthorizedResponse } = await import("../_shared/security.ts");
  const authed = await requireAuth(req);
  const webhookOk = requireSharedSecret(req, "MATRIX_WEBHOOK_SECRET", "x-matrix-webhook-secret");
  if (!authed && !webhookOk) {
    return unauthorizedResponse();
  }

  try {
    // Parse incoming Matrix message or webhook
    const body = await req.json();
    // A logged-in user cannot impersonate Matrix senders or submit forged webhook events.
    if (!webhookOk && (body.type === 'matrix_webhook' || (body.room_id && body.sender && body.content))) {
      return new Response(JSON.stringify({ error: 'Trusted Matrix webhook required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}));

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

  console.log(`⚡ Decision command detected: ${command}`);

  // Find the participant by token
  const { data: participant, error: participantError } = await supabase
    .from('task_decision_participants')
    .select(`
      id,
      user_id,
      decision_id,
      token,
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
    console.error('❌ Participant not found for supplied token', participantError?.message ?? '');

    await sendMatrixResponse(message.room_id,
      '❌ Ungültiger Token oder Entscheidung nicht gefunden.',
      matrixToken, matrixHomeserver);

    return { success: false, error: 'Invalid token' };
  }

  // Antworten stehen in task_decision_responses (eine Wurzelantwort je
  // Teilnehmer). task_decision_participants kennt weder response_type noch
  // responded_at; die Abfrage danach scheiterte mit 42703, sodass jeder
  // Matrix-Befehl als "Ungültiger Token" endete.
  const { data: existingResponse } = await supabase
    .from('task_decision_responses')
    .select('id, response_type')
    .eq('decision_id', participant.decision_id)
    .eq('participant_id', participant.id)
    .is('parent_response_id', null)
    .maybeSingle();

  if (existingResponse) {
    console.log('⚠️ User has already responded to this decision');

    await sendMatrixResponse(message.room_id,
      `ℹ️ Sie haben bereits geantwortet: ${existingResponse.response_type}`,
      matrixToken, matrixHomeserver);

    return { success: false, error: 'Already responded' };
  }

  const decision = participant.task_decisions;
  const { data: activeMember } = await supabase.from('user_tenant_memberships')
    .select('id').eq('user_id', participant.user_id).eq('tenant_id', decision.tenant_id)
    .eq('is_active', true).maybeSingle();
  if (!activeMember || !decision.tenant_id) return { success: false, error: 'Inactive office membership' };

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
        .select('id, task_decision_responses(response_type, parent_response_id)')
        .eq('decision_id', participant.decision_id);

      const rootResponses = (allParticipants ?? []).flatMap((p: any) =>
        (p.task_decision_responses ?? []).filter((r: any) => !r.parent_response_id));
      const responded = rootResponses.length;
      const total = allParticipants?.length || 0;
      const yesCount = rootResponses.filter((r: any) => r.response_type === 'yes').length;
      const noCount = rootResponses.filter((r: any) => r.response_type === 'no').length;
      const questionCount = rootResponses.filter((r: any) => r.response_type === 'question').length;

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

  // Antwort als Wurzelantwort festhalten; Matrix-Kennung und Zeitpunkt ergeben
  // sich aus decision_matrix_messages beziehungsweise created_at.
  const { error: responseError } = await supabase
    .from('task_decision_responses')
    .insert({
      decision_id: participant.decision_id,
      participant_id: participant.id,
      response_type: responseType,
      comment: comments,
    });

  if (responseError) {
    console.error('❌ Error storing participant response:', responseError);

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
    .select('id, task_decision_responses(id, parent_response_id)')
    .eq('decision_id', participant.decision_id);

  const allResponded = (allParticipants ?? []).length > 0
    && allParticipants.every((p: any) => (p.task_decision_responses ?? []).some((r: any) => !r.parent_response_id));

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
      priority_param: 'high',
      tenant_id_param: decision.tenant_id
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
  console.log(`🎯 Processing direct decision command: ${command.command}`);

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
