import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireServiceRole, corsHeaders, forbiddenResponse, withSafeHandler } from "../_shared/security.ts";

serve(withSafeHandler("process-scheduled-emails", async (req) => {
  if (!requireServiceRole(req)) {
    return forbiddenResponse();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch scheduled emails that should be sent now
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from("scheduled_emails")
      .select("id, user_id, tenant_id, sender_id, subject, body_html, reply_to, recipients, cc, bcc, distribution_list_ids, contact_ids, document_ids")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error("Error fetching scheduled emails:", fetchError);
      throw fetchError;
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No emails to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let successCount = 0;
    let failCount = 0;

    for (const email of scheduledEmails) {
      try {

        // Invoke send-document-email function
        const { data: sendData, error: sendError } = await supabase.functions.invoke(
          "send-document-email",
          {
            body: {
              subject: email.subject,
              body_html: email.body_html,
              reply_to: email.reply_to,
              recipients: email.recipients || [],
              cc: email.cc || [],
              bcc: email.bcc || [],
              distribution_list_ids: email.distribution_list_ids || [],
              contact_ids: email.contact_ids || [],
              document_ids: email.document_ids || [],
              tenant_id: email.tenant_id,
              user_id: email.user_id,
              sender_id: email.sender_id,
            },
          }
        );

        if (sendError) {
          console.error(`Error sending email ${email.id}:`, sendError);
          throw sendError;
        }

        // Update status to sent
        const { error: updateError } = await supabase
          .from("scheduled_emails")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        if (updateError) {
          console.error(`Error updating email ${email.id} status:`, updateError);
        }

        successCount++;
      } catch (error: any) {
        failCount++;
        console.error(`✗ Failed to send scheduled email ${email.id}:`, error.message);

        // Update status to failed
        await supabase
          .from("scheduled_emails")
          .update({
            status: "failed",
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);
      }
    }

    return new Response(
      JSON.stringify({
        processed: scheduledEmails.length,
        success: successCount,
        failed: failCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in process-scheduled-emails function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}));
