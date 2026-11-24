import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { escapeHtml, safeUrl } from "../_shared/html.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

import { filterTenantUserIds, filterTenantContactEmails } from "../_shared/recipient-scope.ts";
import { requireTenantAccess } from "../_shared/tenant-access.ts";
import { withSafeHandler } from "../_shared/security.ts";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tenant-id",
};

const BATCH_SIZE = 50;

interface NewsArticle {
  title: string;
  description: string;
  link: string;
  source: string;
}

interface SendNewsEmailRequest {
  article: NewsArticle;
  recipients?: string[];
  internalRecipientUserIds?: string[];
  senderName?: string;
  personalMessage?: string;
  tenant_id?: string;
}

interface EmailTemplate {
  subject: string;
  greeting: string;
  introduction: string;
  closing: string;
  signature: string;
}

interface EmailRecipient {
  email: string;
  name: string;
}

const DEFAULT_TEMPLATE: EmailTemplate = {
  subject: "News-Empfehlung",
  greeting: "Hallo {recipient_name},",
  introduction: "{sender_name} möchte folgende News mit Ihnen teilen:",
  closing: "Viel Spaß beim Lesen!",
  signature: "Ihr Team",
};

/** Fills the documented placeholders in every template field. */
function fillTemplate(value: string | null | undefined, senderName: string, recipientName: string): string {
  return String(value ?? "")
    .replaceAll("{recipient_name}", recipientName)
    .replaceAll("{sender_name}", senderName);
}

/** Derives a readable recipient name for contacts that have no profile. */
function fallbackRecipientName(email: string): string {
  const localPart = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!localPart) return "zusammen";
  return localPart
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function renderEmail(options: {
  template: EmailTemplate;
  article: NewsArticle;
  senderName: string;
  recipientName: string;
  personalMessage?: string;
}): string {
  const { article, senderName, recipientName, personalMessage } = options;
  const template: EmailTemplate = {
    subject: fillTemplate(options.template.subject, senderName, recipientName),
    greeting: fillTemplate(options.template.greeting, senderName, recipientName),
    introduction: fillTemplate(options.template.introduction, senderName, recipientName),
    closing: fillTemplate(options.template.closing, senderName, recipientName),
    signature: fillTemplate(options.template.signature, senderName, recipientName),
  };

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
          .article { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .article-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #1a1a1a; }
          .article-desc { font-size: 14px; color: #666; margin-bottom: 15px; }
          .article-source { font-size: 12px; color: #999; margin-bottom: 15px; }
          .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-top: 10px; }
          .personal-message { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #e5e5e5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">📰 ${escapeHtml(template.subject)}</h1>
          </div>

          <div class="content">
            <p>${escapeHtml(template.greeting)}</p>
            <p>${escapeHtml(template.introduction)}</p>

            ${personalMessage ? `
              <div class="personal-message">
                <strong>💬 Persönliche Nachricht von ${escapeHtml(senderName)}:</strong><br>
                ${escapeHtml(personalMessage).replace(/\n/g, '<br>')}
              </div>
            ` : ''}

            <div class="article">
              <div class="article-title">${escapeHtml(article.title)}</div>
              <div class="article-desc">${escapeHtml(article.description)}</div>
              <div class="article-source">Quelle: ${escapeHtml(article.source)}</div>
              <a href="${safeUrl(article.link)}" class="cta-button" target="_blank">Artikel lesen →</a>
            </div>

            <p>${escapeHtml(template.closing)}</p>
            <p><strong>${escapeHtml(template.signature)}</strong></p>
          </div>

          <div class="footer">
            Empfohlen von ${escapeHtml(senderName)}
          </div>
        </div>
      </body>
      </html>
    `;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

serve(withSafeHandler("send-news-email", async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      article,
      recipients = [],
      internalRecipientUserIds = [],
      senderName: requestedSenderName,
      personalMessage,
      tenant_id: requestedTenantId,
    }: SendNewsEmailRequest = await req.json();

    const access = await requireTenantAccess({
      req,
      functionName: "send-news-email",
      requestedTenantId: requestedTenantId ?? null,
    });
    if ("response" in access) return access.response;

    const tenantId = access.tenantId;

    if (!article) {
      throw new Error("Missing required fields");
    }

    // External recipients must be known contacts of this office.
    const externalRecipients = await filterTenantContactEmails(
      supabase,
      [tenantId],
      recipients.slice(0, 200),
    );

    // Internal recipients must be members of this office.
    const uniqueInternalRecipientUserIds = await filterTenantUserIds(
      supabase,
      [tenantId],
      internalRecipientUserIds.slice(0, 200).map((userId) => String(userId).trim()),
    );

    const resolvedInternal: EmailRecipient[] = [];
    const unresolvedInternalRecipientUserIds: string[] = [];

    if (uniqueInternalRecipientUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .eq("tenant_id", tenantId)
        .in("user_id", uniqueInternalRecipientUserIds)
        .order("display_name");

      const names = new Map(
        (profiles ?? []).map((profile: { user_id: string; display_name: string | null }) => [
          profile.user_id,
          profile.display_name?.trim() ?? "",
        ]),
      );

      for (const userId of uniqueInternalRecipientUserIds) {
        const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(userId);

        if (authUserError || !authUserData.user?.email) {
          unresolvedInternalRecipientUserIds.push(userId);
          continue;
        }

        resolvedInternal.push({
          email: authUserData.user.email,
          name: names.get(userId) || authUserData.user.user_metadata?.display_name || "",
        });
      }
    }

    const uniqueByEmail = new Map<string, EmailRecipient>();
    for (const recipient of resolvedInternal) {
      uniqueByEmail.set(recipient.email.toLowerCase(), recipient);
    }
    for (const email of externalRecipients) {
      if (!uniqueByEmail.has(email.toLowerCase())) uniqueByEmail.set(email.toLowerCase(), { email, name: "" });
    }
    const allRecipients = [...uniqueByEmail.values()];

    if (allRecipients.length === 0) {
      throw new Error("No resolvable recipients found");
    }

    // The sender name always comes from the caller's own profile.
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", access.user.id)
      .maybeSingle();
    const senderName = callerProfile?.display_name?.trim()
      || (typeof requestedSenderName === "string" ? requestedSenderName.trim() : "")
      || "Ein Kollege";

    // Templates are office-specific; the newest row wins.
    const { data: templateRow } = await supabase
      .from("news_email_templates")
      .select("subject, greeting, introduction, closing, signature")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const template: EmailTemplate = { ...DEFAULT_TEMPLATE, ...(templateRow ?? {}) };

    // The sender address belongs to the office; the provider sandbox is never a silent fallback.
    const { data: senderInfo } = await supabase
      .from("sender_information")
      .select("name, landtag_email")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    const fromEmail = Deno.env.get("NEWS_EMAIL_FROM")?.trim() || senderInfo?.landtag_email?.trim();
    if (!fromEmail) {
      console.error("❌ News email sender not configured", { tenant_id: tenantId });
      return new Response(
        JSON.stringify({
          error: "Kein Absender für News-E-Mails konfiguriert. Bitte in der Büroverwaltung einen Standard-Absender mit E-Mail-Adresse hinterlegen oder NEWS_EMAIL_FROM setzen.",
        }),
        { status: 422, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    const fromName = (Deno.env.get("NEWS_EMAIL_FROM_NAME") || senderInfo?.name || "News")
      .replace(/[<>"\r\n]/g, "")
      .trim() || "News";
    const from = `${fromName} <${fromEmail}>`;

    const failedRecipients: string[] = [];
    let sentCount = 0;

    // Send in bounded batches so large offices do not hit the provider rate limit.
    for (const batch of chunk(allRecipients, BATCH_SIZE)) {
      const results = await Promise.allSettled(batch.map((recipient) => {
        const recipientName = recipient.name.trim() || fallbackRecipientName(recipient.email);
        const subject = fillTemplate(template.subject, senderName, recipientName);

        return resend.emails.send({
          from,
          to: [recipient.email],
          subject,
          html: renderEmail({ template, article, senderName, recipientName, personalMessage }),
        });
      }));

      results.forEach((result, index) => {
        const recipient = batch[index];
        if (result.status === "rejected" || result.value?.error) {
          console.error("❌ News email failed", {
            recipient: recipient.email,
            error: result.status === "rejected" ? result.reason : result.value?.error,
          });
          failedRecipients.push(recipient.email);
        } else {
          sentCount += 1;
        }
      });
    }

    const partialFailure = unresolvedInternalRecipientUserIds.length > 0 || failedRecipients.length > 0
      ? {
          message: [
            unresolvedInternalRecipientUserIds.length > 0
              ? `${unresolvedInternalRecipientUserIds.length} interne Empfänger konnten nicht aufgelöst werden und wurden nicht per E-Mail benachrichtigt.`
              : null,
            failedRecipients.length > 0
              ? `${failedRecipients.length} E-Mails konnten nicht zugestellt werden.`
              : null,
          ].filter(Boolean).join(" "),
          unresolvedInternalRecipientUserIds,
          failedRecipients: failedRecipients.slice(0, 50),
        }
      : null;

    console.log("📧 News email dispatch", {
      tenant_id: tenantId,
      from,
      requested: allRecipients.length,
      sent: sentCount,
      failed: failedRecipients.length,
      unresolvedInternal: unresolvedInternalRecipientUserIds.length,
    });

    if (sentCount === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "E-Mail-Versand fehlgeschlagen", partialFailure }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    return new Response(
      JSON.stringify({
        success: failedRecipients.length === 0,
        recipients: sentCount,
        partialFailure,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-news-email function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}));
