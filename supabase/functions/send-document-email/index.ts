import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import {
  buildRequestId,
  createCorsHeaders,
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  safeErrorResponse,
  userCanAccessTenant,
} from "../_shared/security.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
  reply_to?: string;
  scheduled_at?: string;
}

interface FailedRecipient {
  email: string;
  error: string;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = buildRequestId();

  try {
    const authResult = await getAuthenticatedUser(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }

    const user = authResult.user;
    const supabase = createServiceClient();

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
      reply_to,
      scheduled_at,
    }: SendEmailRequest = await req.json();

    if (!tenant_id || !user_id || !subject || !body_html) {
      return safeErrorResponse(
        "tenant_id, user_id, subject and body_html are required",
        400,
        corsHeaders,
        requestId,
      );
    }

    if (user.id !== user_id) {
      return safeErrorResponse(
        "user_id does not match authenticated user",
        403,
        corsHeaders,
        requestId,
      );
    }

    const canSendEmail = await userCanAccessTenant(
      supabase,
      user_id,
      tenant_id,
    );
    if (!canSendEmail) {
      return safeErrorResponse(
        "No tenant membership found for user",
        403,
        corsHeaders,
        requestId,
      );
    }

    console.log(`[${requestId}] Email request`, {
      recipients_count: recipients.length + recipient_emails.length,
      contact_ids_count: contact_ids.length,
      distribution_list_ids_count: distribution_list_ids.length,
      document_ids_count: document_ids.length,
    });

    const allRecipients: Array<{
      email: string;
      contact_data?: Record<string, unknown>;
    }> = [];
    recipients.forEach((email) => allRecipients.push({ email }));
    recipient_emails.forEach((email) => allRecipients.push({ email }));

    if (distribution_list_ids.length > 0) {
      const { data: listMembers, error: listError } = await supabase
        .from("distribution_list_members")
        .select(
          "contact_id, contacts(id, tenant_id, name, email, organization, phone)",
        )
        .in("distribution_list_id", distribution_list_ids);

      if (listError) {
        console.error(`[${requestId}] Distribution list error:`, listError);
      } else if (listMembers) {
        listMembers.forEach((member: any) => {
          if (
            member.contacts?.email &&
            member.contacts?.tenant_id === tenant_id
          ) {
            allRecipients.push({
              email: member.contacts.email,
              contact_data: member.contacts,
            });
          }
        });
      }
    }

    if (contact_ids.length > 0) {
      const { data: contacts, error: contactError } = await supabase
        .from("contacts")
        .select("id, name, email, organization, phone, tenant_id")
        .in("id", contact_ids)
        .eq("tenant_id", tenant_id);

      if (contactError) {
        console.error(`[${requestId}] Contacts error:`, contactError);
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

    let fromEmail = "onboarding@resend.dev";
    let fromName = "Team";

    if (sender_id) {
      const { data: senderInfo, error: senderError } = await supabase
        .from("sender_information")
        .select("name, landtag_email")
        .eq("id", sender_id)
        .eq("tenant_id", tenant_id)
        .single();

      if (!senderError && senderInfo) {
        fromEmail = senderInfo.landtag_email || fromEmail;
        fromName = senderInfo.name || fromName;
      }
    }

    const uniqueRecipients = Array.from(
      new Map(
        allRecipients.map((recipient) => [recipient.email, recipient]),
      ).values(),
    );

    if (uniqueRecipients.length === 0) {
      return safeErrorResponse(
        "No recipients found",
        400,
        corsHeaders,
        requestId,
      );
    }

    const replaceVariables = (
      text: string,
      contactData?: Record<string, any>,
    ) => {
      if (!contactData) return text;

      return text
        .replace(/\{\{name\}\}/g, contactData.name || "")
        .replace(/\{\{email\}\}/g, contactData.email || "")
        .replace(/\{\{organization\}\}/g, contactData.organization || "")
        .replace(/\{\{phone\}\}/g, contactData.phone || "");
    };

    let sent = 0;
    let failed = 0;
    const failedRecipients: FailedRecipient[] = [];
    const personalizationData: Record<string, unknown> = {};

    for (const recipient of uniqueRecipients) {
      try {
        const personalizedSubject = replaceVariables(
          subject,
          recipient.contact_data,
        );
        const personalizedBody = replaceVariables(
          body_html,
          recipient.contact_data,
        );

        const emailPayload: Record<string, unknown> = {
          from: `${fromName} <${fromEmail}>`,
          to: [recipient.email],
          reply_to: reply_to || undefined,
          cc: cc.length > 0 ? cc : undefined,
          bcc: bcc.length > 0 ? bcc : undefined,
          subject: personalizedSubject,
          html: personalizedBody,
        };

        if (scheduled_at) {
          emailPayload.scheduledAt = scheduled_at;
        }

        const emailResponse = await resend.emails.send(emailPayload as any);

        if (emailResponse.error) {
          throw emailResponse.error;
        }

        sent += 1;

        if (recipient.contact_data) {
          personalizationData[recipient.email] = {
            name: recipient.contact_data.name,
            organization: recipient.contact_data.organization,
          };
        }
      } catch (error: any) {
        failed += 1;
        failedRecipients.push({
          email: recipient.email,
          error: error?.message || "Unknown error",
        });
      }
    }

    const emailLogData = {
      tenant_id,
      user_id,
      subject,
      body_html,
      recipients: uniqueRecipients.map((recipient) => recipient.email),
      cc,
      bcc,
      reply_to: reply_to || null,
      scheduled_at: scheduled_at || null,
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
      console.error(`[${requestId}] Log error:`, logError);
    }

    return jsonResponse(
      {
        success: sent > 0,
        sent,
        failed,
        total: uniqueRecipients.length,
        failed_recipients: failedRecipients,
        request_id: requestId,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(`[${requestId}] Function error:`, error);
    return safeErrorResponse(
      "Internal server error",
      500,
      corsHeaders,
      requestId,
    );
  }
});
