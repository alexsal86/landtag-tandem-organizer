import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DecisionResponseRequest {
  participantId: string;
  token: string;
  responseType: string; // Now accepts any string key from response_options
  comment?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      participantId, 
      token, 
      responseType, 
      comment 
    }: DecisionResponseRequest = await req.json();

    console.log("=== PROCESS DECISION RESPONSE DEBUG ===");
    console.log("Participant ID:", participantId);
    console.log("Token:", token ? "Present" : "Missing");
    console.log("Response type:", responseType);
    console.log("Comment:", comment ? "Present" : "None");
    console.log("=== END DEBUG INFO ===");

    // Validate token and get participant
    const { data: participant, error: participantError } = await supabase
      .from('task_decision_participants')
      .select('id, decision_id, user_id, token')
      .eq('id', participantId)
      .eq('token', token)
      .single();

    console.log("Participant data:", JSON.stringify(participant));

    if (participantError || !participant) {
      console.error("Invalid participant or token:", participantError);
      return new Response(
        JSON.stringify({ error: "Ungültiger Link oder Token" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get decision details separately
    const { data: decision, error: decisionError } = await supabase
      .from('task_decisions')
      .select('id, title, created_by, task_id, response_options')
      .eq('id', participant.decision_id)
      .single();

    console.log("Decision data:", JSON.stringify(decision));

    if (decisionError || !decision) {
      console.error("Invalid decision:", decisionError);
      return new Response(
        JSON.stringify({ error: "Entscheidung nicht gefunden" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate response type against allowed options
    const responseOptions = decision.response_options || [];
    const validOption = responseOptions.find((opt: any) => opt.key === responseType);
    
    if (!validOption) {
      console.error("Invalid response type:", responseType, "Valid options:", responseOptions.map((o: any) => o.key));
      return new Response(
        JSON.stringify({ error: "Ungültiger Antworttyp" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if option requires comment
    if (validOption.requires_comment && !comment?.trim()) {
      return new Response(
        JSON.stringify({ error: "Ein Kommentar ist für diese Antwortoption erforderlich" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if response already exists
    const { data: existingResponse, error: existingError } = await supabase
      .from('task_decision_responses')
      .select('id')
      .eq('decision_id', participant.decision_id)
      .eq('participant_id', participantId)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing response:", existingError);
      return new Response(
        JSON.stringify({ error: "Fehler beim Überprüfen der Antwort" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (existingResponse) {
      // Update existing response
      const { error: updateError } = await supabase
        .from('task_decision_responses')
        .update({
          response_type: responseType,
          comment: comment || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingResponse.id);

      if (updateError) {
        console.error("Error updating response:", updateError);
        return new Response(
          JSON.stringify({ error: "Fehler beim Aktualisieren der Antwort" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    } else {
      // Create new response
      const { error: insertError } = await supabase
        .from('task_decision_responses')
        .insert({
          decision_id: participant.decision_id,
          participant_id: participantId,
          response_type: responseType,
          comment: comment || null
        });

      if (insertError) {
        console.error("Error creating response:", insertError);
        return new Response(
          JSON.stringify({ error: "Fehler beim Speichern der Antwort" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Check if all participants have responded
    const { data: allParticipants, error: allParticipantsError } = await supabase
      .from('task_decision_participants')
      .select('id')
      .eq('decision_id', participant.decision_id);

    if (allParticipantsError) {
      console.error("Error getting all participants:", allParticipantsError);
    } else {
      const { data: allResponses, error: allResponsesError } = await supabase
        .from('task_decision_responses')
        .select('participant_id')
        .eq('decision_id', participant.decision_id);

      if (!allResponsesError && allParticipants && allResponses) {
        const allResponded = allParticipants.length === allResponses.length;
        
        if (allResponded) {
          // Notify the decision creator that all participants have responded
          try {
            await supabase.rpc('create_notification', {
              user_id_param: decision.created_by,
              type_name: 'task_decision_complete',
              title_param: 'Entscheidungsanfrage abgeschlossen',
              message_param: `Alle Teilnehmer haben zu "${decision.title}" geantwortet.`,
              data_param: {
                decision_id: decision.id,
                task_id: decision.task_id,
                decision_title: decision.title
              },
              priority_param: 'medium'
            });
          } catch (notificationError) {
            console.error('Error creating completion notification:', notificationError);
          }
        }
      }
    }

    // Get participant name for response
    const { data: participantProfile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', participant.user_id)
      .single();

    const participantName = participantProfile?.display_name || 'Ein Teammitglied';

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Antwort erfolgreich gespeichert",
        participantName,
        decisionTitle: decision.title,
        responseType,
        responseOptions: decision.response_options
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in process-decision-response function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
