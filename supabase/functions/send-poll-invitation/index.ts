import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { escapeHtml, safeUrl, sanitizeEmailHtml } from "../_shared/html.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { requireAppBaseUrl } from "../_shared/url.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

import { withSafeHandler, requireAuth, unauthorizedResponse, forbiddenResponse } from "../_shared/security.ts";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PollInvitationRequest {
  pollId: string;
  participantEmails: string[];
  pollTitle: string;
  pollDescription?: string;
  creatorName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const supabase = createServiceRoleClient();

    const {
      pollId,
      participantEmails,
    }: PollInvitationRequest = await req.json();

    console.log("=== SEND POLL INVITATION DEBUG ===");
    console.log("Poll ID:", pollId);
    console.log("Poll invitation recipients:", Array.isArray(participantEmails) ? participantEmails.length : 0);
    console.log("=== END DEBUG INFO ===");

    if (typeof pollId !== "string" || !Array.isArray(participantEmails)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Only the poll's creator may send its invitation links.
    const { data: ownedPoll } = await supabase
      .from("appointment_polls")
      .select("id, title, description")
      .eq("id", pollId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!ownedPoll) return forbiddenResponse();

    // Email content comes from stored poll data, never from the request.
    const pollTitle: string = ownedPoll.title || "Terminabstimmung";
    const pollDescription: string = ownedPoll.description || "";
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", auth.userId)
      .maybeSingle();
    const creatorName: string = creatorProfile?.display_name || "Ein Teammitglied";

    const emailResults = [];

    // Send emails to existing participants
    for (const email of participantEmails) {
      try {
        // Get existing participant (should already exist from AppointmentPollCreator)
        const { data: participant, error: participantError } = await supabase
          .from('poll_participants')
          .select('token, name')
          .eq('poll_id', pollId)
          .eq('email', email)
          .maybeSingle();

        if (participantError) {
          console.error("Database error getting poll participant:", participantError?.message ?? "");
          emailResults.push({ email, success: false, error: "Database error: " + participantError.message });
          continue;
        }

        if (!participant) {
          console.error("Poll participant not found");
          emailResults.push({ email, success: false, error: "Participant not found in database" });
          continue;
        }

        console.log("Found poll participant:", {
          name: participant.name,
          hasToken: !!participant.token,
          tokenLength: participant.token?.length || 0
        });

        if (!participant.token) {
          console.error("No token found for external poll participant");
          emailResults.push({ email, success: false, error: "No token found for participant" });
          continue;
        }

        const participantToken = participant.token || 'guest';

        // Get current domain dynamically
        const domain = requireAppBaseUrl(req);
        const pollUrl = `${domain}/poll-guest/${pollId}?token=${participantToken}`;

        console.log("Sending poll invitation email");

        // Send invitation email
        const emailResponse = await resend.emails.send({
          from: "Terminabstimmung <noreply@alexander-salomon.de>",
          to: [email],
          subject: `Einladung zur Terminabstimmung: ${pollTitle}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333; font-size: 24px;">Terminabstimmung</h1>
              <p style="color: #666; font-size: 16px;">Hallo,</p>
              <p style="color: #666; font-size: 16px;">
                ${escapeHtml(creatorName)} hat Sie zu einer Terminabstimmung eingeladen:
              </p>
              <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
                <h3 style="margin: 0 0 8px 0; color: #333;">${escapeHtml(pollTitle)}</h3>
                ${pollDescription ? `<p style="margin: 0; color: #666;">${escapeHtml(pollDescription)}</p>` : ''}
              </div>
              <p style="color: #666; font-size: 16px;">
                Bitte klicken Sie auf den folgenden Link, um Ihre Verfügbarkeit mitzuteilen:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${pollUrl}"
                   style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Verfügbarkeit mitteilen
                </a>
              </div>
              <p style="color: #999; font-size: 14px;">
                Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
                <a href="${pollUrl}" style="color: #3b82f6;">${pollUrl}</a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">
                Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
              </p>
            </div>
          `,
        });

        if (emailResponse.error) {
          console.error("Email send error:", emailResponse.error);
          // Check if it's a domain verification issue
          const isTestModeError = emailResponse.error &&
            (emailResponse.error.toString().includes('testing emails') ||
             emailResponse.error.toString().includes('verify a domain'));

          if (isTestModeError) {
            emailResults.push({
              email,
              success: false,
              error: "Domain nicht verifiziert - E-Mails können nur an verifizierte Adressen gesendet werden"
            });
          } else {
            emailResults.push({ email, success: false, error: emailResponse.error });
          }
        } else {
          console.log("Poll invitation sent, ID:", emailResponse.data?.id);
          emailResults.push({ email, success: true, messageId: emailResponse.data?.id });
        }

      } catch (emailError) {
        console.error("Error sending poll invitation:", emailError instanceof Error ? emailError.message : "");
        emailResults.push({ email, success: false, error: emailError instanceof Error ? emailError.message : "Unknown error" });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    console.log("=== EMAIL RESULTS SUMMARY ===");
    console.log(`Sent ${successCount}/${emailResults.length} emails successfully`);
    console.log("=== END SUMMARY ===");

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: `${successCount}/${emailResults.length} invitations sent successfully`,
        results: emailResults
      }),
      {
        status: successCount > 0 ? 200 : 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in send-poll-invitation function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(withSafeHandler("send-poll-invitation", handler));
