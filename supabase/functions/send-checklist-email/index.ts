import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  actionId: string;
  checklistItemId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = "https://wawofclbehbkebjivdte.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get JWT token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { actionId, checklistItemId }: EmailRequest = await req.json();

    console.log("Processing email for action:", actionId, "item:", checklistItemId);

    // Fetch action configuration
    const { data: action, error: actionError } = await supabase
      .from("event_planning_item_actions")
      .select("*")
      .eq("id", actionId)
      .eq("is_enabled", true)
      .single();

    if (actionError || !action) {
      throw new Error("Action not found or disabled");
    }

    const config = action.action_config as {
      recipients: string[];
      subject: string;
      message: string;
      sender_name?: string;
      sender_email?: string;
    };

    // Validate configuration
    if (!config.recipients || config.recipients.length === 0) {
      throw new Error("No recipients configured");
    }

    // Get user info for default sender
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    const senderName = config.sender_name || profile?.display_name || "Event Planning";
    const senderEmail = config.sender_email || "onboarding@resend.dev";

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: config.recipients,
        subject: config.subject,
        html: config.message,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error: ${errorText}`);
    }

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    // Log the execution
    await supabase.from("event_planning_action_logs").insert({
      action_id: actionId,
      checklist_item_id: checklistItemId,
      execution_status: "success",
      executed_by: user.id,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: emailData.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending checklist email:", error);

    // Try to log the error if we have the IDs
    try {
      const body = await req.json();
      const { actionId, checklistItemId } = body;
      const supabaseUrl = "https://wawofclbehbkebjivdte.supabase.co";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase.from("event_planning_action_logs").insert({
        action_id: actionId,
        checklist_item_id: checklistItemId,
        execution_status: "failed",
        error_message: error.message,
      });
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
