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
  recipients?: string[];
  recipient_emails?: string[];
  cc?: string[];
  bcc?: string[];
  distribution_list_ids?: string[];
  contact_ids?: string[];
  document_ids?: string[];
  tenant_id: string;
  user_id: string;
  sender_id?: string;
}

interface FailedRecipient {
  email: string;
  error: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const {
      subject,
      body_html,
      recipients = [],
      recipient_emails = [],
      cc = [],
      bcc = [],
      distribution_list_ids = [],
      contact_ids = [],
      document_ids = [],
      tenant_id,
      user_id,
      sender_id,
    }: SendEmailRequest = await req.json();

    console.log("Email request:", {
      subject,
      recipients_count: recipients.length + recipient_emails.length,
      contact_ids_count: contact_ids.length,
      distribution_list_ids_count: distribution_list_ids.length,
    });

    // Collect recipients with contact data for personalization
    const allRecipients: Array<{ email: string; contact_data?: any }> = [];

    // Add manual recipients
    recipients.forEach(email => allRecipients.push({ email }));
    recipient_emails.forEach(email => allRecipients.push({ email }));

    // Get emails from distribution lists with contact data
    if (distribution_list_ids.length > 0) {
      const { data: listMembers, error: listError } = await supabase
        .from("distribution_list_members")
        .select("contact_id, contacts(id, name, email, organization, phone)")
        .in("distribution_list_id", distribution_list_ids);

      if (listError) {
        console.error("Distribution list error:", listError);
      } else if (listMembers) {
        listMembers.forEach((member: any) => {
          if (member.contacts?.email) {
            allRecipients.push({
              email: member.contacts.email,
              contact_data: member.contacts,
            });
          }
        });
      }
    }

    // Get contact data
    if (contact_ids.length > 0) {
      const { data: contacts, error: contactError } = await supabase
        .from("contacts")
        .select("id, name, email, organization, phone")
        .in("id", contact_ids);

      if (contactError) {
        console.error("Contacts error:", contactError);
      } else if (contacts) {
        contacts.forEach((contact: any) => {
          if (contact.email) {
            allRecipients.push({
              email: contact.email,
              contact_data: contact,
            });
          }
        });
      }
    }

    // Get sender info
    let fromEmail = "onboarding@resend.dev";
    let fromName = "Team";

    if (sender_id) {
      const { data: senderInfo, error: senderError } = await supabase
        .from("sender_information")
        .select("name, landtag_email")
        .eq("id", sender_id)
        .single();

      if (!senderError && senderInfo) {
        fromEmail = senderInfo.landtag_email || fromEmail;
        fromName = senderInfo.name || fromName;
      }
    }

    // Remove duplicates
    const uniqueRecipients = Array.from(
      new Map(allRecipients.map(r => [r.email, r])).values()
    );

    console.log(`Sending to ${uniqueRecipients.length} unique recipients`);

    if (uniqueRecipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Replace variables function
    const replaceVariables = (text: string, contactData?: any) => {
      if (!contactData) return text;
      
      return text
        .replace(/\{\{name\}\}/g, contactData.name || "")
        .replace(/\{\{email\}\}/g, contactData.email || "")
        .replace(/\{\{organization\}\}/g, contactData.organization || "")
        .replace(/\{\{phone\}\}/g, contactData.phone || "");
    };

    // Send personalized emails
    let sent = 0;
    let failed = 0;
    const failedRecipients: FailedRecipient[] = [];
    const personalizationData: Record<string, any> = {};

    for (const recipient of uniqueRecipients) {
      try {
        const personalizedSubject = replaceVariables(subject, recipient.contact_data);
        const personalizedBody = replaceVariables(body_html, recipient.contact_data);

        const emailResponse = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [recipient.email],
          cc: cc.length > 0 ? cc : undefined,
          bcc: bcc.length > 0 ? bcc : undefined,
          subject: personalizedSubject,
          html: personalizedBody,
        });

        if (emailResponse.error) {
          throw emailResponse.error;
        }

        sent++;
        
        if (recipient.contact_data) {
          personalizationData[recipient.email] = {
            name: recipient.contact_data.name,
            organization: recipient.contact_data.organization,
          };
        }

        console.log(`✓ Sent to ${recipient.email}`);
      } catch (error: any) {
        failed++;
        failedRecipients.push({
          email: recipient.email,
          error: error.message || "Unknown error",
        });
        console.error(`✗ Failed ${recipient.email}:`, error.message);
      }
    }

    // Log to database
    const emailLogData = {
      tenant_id,
      user_id,
      subject,
      body_html,
      recipients: uniqueRecipients.map(r => r.email),
      cc,
      bcc,
      status: failed > 0 ? (sent > 0 ? "partially_sent" : "failed") : "sent",
      error_message: failed > 0 ? `${failed} emails failed` : null,
      sent_at: new Date().toISOString(),
      personalization_data: personalizationData,
      failed_recipients: failedRecipients.length > 0 ? failedRecipients : null,
    };

    const { error: logError } = await supabase
      .from("email_logs")
      .insert(emailLogData);

    if (logError) {
      console.error("Log error:", logError);
    }

    console.log(`Results: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: sent > 0,
        sent,
        failed,
        total: uniqueRecipients.length,
        failed_recipients: failedRecipients,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
