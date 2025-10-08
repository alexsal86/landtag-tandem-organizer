import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  subject: string;
  body_html: string;
  recipients: string[]; // Email addresses
  cc?: string[];
  bcc?: string[];
  distribution_list_ids?: string[];
  contact_ids?: string[];
  document_ids?: string[];
  template_id?: string;
  variables?: Record<string, string>;
  tenant_id: string;
  user_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const {
      subject,
      body_html,
      recipients,
      cc = [],
      bcc = [],
      distribution_list_ids = [],
      contact_ids = [],
      document_ids = [],
      template_id,
      variables = {},
      tenant_id,
      user_id,
    }: SendEmailRequest = await req.json();

    console.log("Send email request received:", {
      subject,
      recipients: recipients.length,
      distribution_list_ids: distribution_list_ids.length,
      contact_ids: contact_ids.length,
    });

    // Collect all email addresses
    const allRecipients = new Set(recipients);

    // Resolve distribution lists to email addresses
    if (distribution_list_ids.length > 0) {
      const { data: listMembers, error: listError } = await supabase
        .from("distribution_list_members")
        .select("contact_id, contacts!inner(email)")
        .in("distribution_list_id", distribution_list_ids);

      if (listError) throw listError;

      listMembers?.forEach((member: any) => {
        if (member.contacts?.email) {
          allRecipients.add(member.contacts.email);
        }
      });
    }

    // Resolve contact IDs to email addresses
    if (contact_ids.length > 0) {
      const { data: contacts, error: contactError } = await supabase
        .from("contacts")
        .select("email, name")
        .in("id", contact_ids);

      if (contactError) throw contactError;

      contacts?.forEach((contact: any) => {
        if (contact.email) {
          allRecipients.add(contact.email);
        }
      });
    }

    // Get sender information
    const { data: senderInfo } = await supabase
      .from("sender_information")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .limit(1)
      .single();

    const fromEmail = senderInfo?.email || "noreply@example.com";
    const fromName = senderInfo?.name || "Absender";

    // Process body_html with variables
    let processedBody = body_html;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      processedBody = processedBody.replace(regex, value);
    });

    // Send emails
    const recipientArray = Array.from(allRecipients);
    const emailPromises: Promise<any>[] = [];

    console.log(`Sending to ${recipientArray.length} recipients`);

    for (const recipient of recipientArray) {
      emailPromises.push(
        resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [recipient],
          cc: cc.length > 0 ? cc : undefined,
          bcc: bcc.length > 0 ? bcc : undefined,
          subject,
          html: processedBody,
        })
      );
    }

    const results = await Promise.allSettled(emailPromises);
    
    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failureCount = results.filter(r => r.status === "rejected").length;

    console.log(`Email results: ${successCount} sent, ${failureCount} failed`);

    // Log email in database
    const { error: logError } = await supabase.from("email_logs").insert({
      tenant_id,
      user_id,
      subject,
      recipients: recipientArray,
      cc,
      bcc,
      body_html: processedBody,
      status: failureCount > 0 ? "failed" : "sent",
      error_message: failureCount > 0 ? `${failureCount} emails failed` : null,
      document_ids: document_ids || [],
      sent_at: new Date().toISOString(),
    });

    if (logError) {
      console.error("Error logging email:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        total: recipientArray.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-document-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});