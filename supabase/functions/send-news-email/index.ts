import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  senderName: string;
  personalMessage?: string;
}

serve(async (req: Request): Promise<Response> => {
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
      senderName,
      personalMessage,
    }: SendNewsEmailRequest = await req.json();

    if (!article) {
      throw new Error("Missing required fields");
    }

    const externalRecipients = [...new Set(
      recipients
        .map((email) => email.trim())
        .filter((email) => email && email.includes("@"))
    )];

    const uniqueInternalRecipientUserIds = [...new Set(
      internalRecipientUserIds
        .map((userId) => userId.trim())
        .filter(Boolean)
    )];

    const resolvedInternalEmails: string[] = [];
    const unresolvedInternalRecipientUserIds: string[] = [];

    if (uniqueInternalRecipientUserIds.length > 0) {
      const internalLookupResults = await Promise.all(
        uniqueInternalRecipientUserIds.map(async (userId) => {
          const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(userId);

          if (authUserError || !authUserData.user?.email) {
            return { userId, email: null };
          }

          return { userId, email: authUserData.user.email };
        })
      );

      for (const result of internalLookupResults) {
        if (result.email) {
          resolvedInternalEmails.push(result.email);
        } else {
          unresolvedInternalRecipientUserIds.push(result.userId);
        }
      }
    }

    const allRecipients = [...new Set([...resolvedInternalEmails, ...externalRecipients])];

    if (allRecipients.length === 0) {
      throw new Error("No resolvable recipients found");
    }

    // Get template from database (use first available or default)
    const { data: templates } = await supabase
      .from("news_email_templates")
      .select("*")
      .limit(1)
      .single();

    const template = templates || {
      subject: "News-Empfehlung",
      greeting: "Hallo,",
      introduction: `${senderName} möchte folgende News mit Ihnen teilen:`,
      closing: "Viel Spaß beim Lesen!",
      signature: "Ihr Team"
    };

    // Build HTML email
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
            <h1 style="margin: 0; font-size: 24px;">📰 ${template.subject}</h1>
          </div>

          <div class="content">
            <p>${template.greeting}</p>
            <p>${template.introduction}</p>

            ${personalMessage ? `
              <div class="personal-message">
                <strong>💬 Persönliche Nachricht von ${senderName}:</strong><br>
                ${personalMessage.replace(/\n/g, '<br>')}
              </div>
            ` : ''}

            <div class="article">
              <div class="article-title">${article.title}</div>
              <div class="article-desc">${article.description}</div>
              <div class="article-source">Quelle: ${article.source}</div>
              <a href="${article.link}" class="cta-button" target="_blank">Artikel lesen →</a>
            </div>

            <p>${template.closing}</p>
            <p><strong>${template.signature}</strong></p>
          </div>

          <div class="footer">
            Empfohlen von ${senderName}
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to all recipients
    const emailPromises = allRecipients.map((recipient) =>
      resend.emails.send({
        from: "News <onboarding@resend.dev>",
        to: [recipient],
        subject: template.subject,
        html: htmlBody,
      })
    );

    await Promise.all(emailPromises);

    const partialFailure = unresolvedInternalRecipientUserIds.length > 0
      ? {
          message: `${unresolvedInternalRecipientUserIds.length} interne Empfänger konnten nicht aufgelöst werden und wurden nicht per E-Mail benachrichtigt.`,
          unresolvedInternalRecipientUserIds,
        }
      : null;

    console.log(`✅ Sent news email to ${allRecipients.length} recipients`, {
      unresolvedInternalRecipientUserIds,
    });

    return new Response(
      JSON.stringify({
        success: true,
        recipients: allRecipients.length,
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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
