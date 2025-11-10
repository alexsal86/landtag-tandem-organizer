import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendChecklistEmailRequest {
  checklistItemId: string;
  actionId: string;
  eventTitle: string;
  checklistItemTitle: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { checklistItemId, actionId, eventTitle, checklistItemTitle }: SendChecklistEmailRequest = await req.json();

    console.log(`📧 Sending checklist email for item: ${checklistItemTitle}`);

    // Get action configuration
    const { data: action, error: actionError } = await supabase
      .from("event_planning_item_actions")
      .select("action_config")
      .eq("id", actionId)
      .single();

    if (actionError || !action) {
      throw new Error("Action configuration not found");
    }

    const config = action.action_config as {
      recipients: string[];
      subject?: string;
      message?: string;
      includeSenderInfo?: boolean;
    };

    if (!config.recipients || config.recipients.length === 0) {
      throw new Error("No recipients configured");
    }

    // Get user info for sender
    const authHeader = req.headers.get("Authorization");
    let senderName = "Team";
    let senderEmail = "";

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .single();
        
        senderName = profile?.display_name || user.email || "Team";
        senderEmail = user.email || "";
      }
    }

    // Build email HTML
    const subject = config.subject || `✅ ${checklistItemTitle} - Erledigt`;
    const message = config.message || `Der Checklist-Punkt "${checklistItemTitle}" für "${eventTitle}" wurde als erledigt markiert.`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
          .checklist-item { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
          .item-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #1a1a1a; }
          .event-info { font-size: 14px; color: #666; margin-bottom: 15px; }
          .message { font-size: 14px; color: #333; margin: 20px 0; white-space: pre-wrap; }
          .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #e5e5e5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">✅ Checklist-Punkt erledigt</h1>
          </div>
          
          <div class="content">
            <div class="checklist-item">
              <div class="item-title">${checklistItemTitle}</div>
              <div class="event-info">Event: ${eventTitle}</div>
            </div>
            
            <div class="message">${message}</div>
            
            ${config.includeSenderInfo && senderName ? `
              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 14px; color: #666;">
                Markiert als erledigt von: <strong>${senderName}</strong>${senderEmail ? ` (${senderEmail})` : ''}
              </p>
            ` : ''}
          </div>
          
          <div class="footer">
            Automatische Benachrichtigung vom Event-Planning-System
          </div>
        </div>
      </body>
      </html>
    `;

    // Send emails to all recipients
    const emailPromises = config.recipients.map(recipient => 
      resend.emails.send({
        from: "Event Planning <onboarding@resend.dev>",
        to: [recipient],
        subject: subject,
        html: htmlBody,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    
    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failedCount = results.filter(r => r.status === "rejected").length;

    // Log execution
    await supabase
      .from("event_planning_action_logs")
      .insert({
        action_id: actionId,
        checklist_item_id: checklistItemId,
        execution_status: failedCount > 0 ? "failed" : "success",
        execution_details: {
          recipients_total: config.recipients.length,
          recipients_success: successCount,
          recipients_failed: failedCount,
          sent_at: new Date().toISOString(),
        },
      });

    console.log(`✅ Sent checklist email to ${successCount}/${config.recipients.length} recipients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipients_total: config.recipients.length,
        recipients_success: successCount,
        recipients_failed: failedCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-checklist-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
