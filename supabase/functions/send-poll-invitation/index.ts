import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      pollId, 
      participantEmails, 
      pollTitle, 
      pollDescription, 
      creatorName 
    }: PollInvitationRequest = await req.json();

    console.log("Sending poll invitations for poll:", pollId);
    console.log("Participant emails:", participantEmails);

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
          console.error("Database error getting participant for", email, ":", participantError);
          emailResults.push({ email, success: false, error: "Database error" });
          continue;
        }

        if (!participant) {
          console.error("Participant not found for", email);
          emailResults.push({ email, success: false, error: "Participant not found" });
          continue;
        }

        if (!participant.token) {
          console.error("No token found for external participant", email);
          emailResults.push({ email, success: false, error: "No token found" });
          continue;
        }

        const participantToken = participant.token || 'guest';

        // Get current domain dynamically
        const origin = req.headers.get('origin') || req.headers.get('referer');
        const domain = origin ? new URL(origin).origin : 'https://wawofclbehbkebjivdte.supabase.co';
        const pollUrl = `${domain}/poll-guest/${pollId}?token=${participantToken}`;
        
        console.log("Sending email to:", email, "with URL:", pollUrl);

        // Send invitation email
        const emailResponse = await resend.emails.send({
          from: "Terminabstimmung <onboarding@resend.dev>",
          to: [email],
          subject: `Einladung zur Terminabstimmung: ${pollTitle}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333; font-size: 24px;">Terminabstimmung</h1>
              <p style="color: #666; font-size: 16px;">Hallo,</p>
              <p style="color: #666; font-size: 16px;">
                ${creatorName} hat Sie zu einer Terminabstimmung eingeladen:
              </p>
              <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
                <h3 style="margin: 0 0 8px 0; color: #333;">${pollTitle}</h3>
                ${pollDescription ? `<p style="margin: 0; color: #666;">${pollDescription}</p>` : ''}
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
          emailResults.push({ email, success: false, error: emailResponse.error });
        } else {
          console.log("Email sent successfully to:", email, "ID:", emailResponse.data?.id);
          emailResults.push({ email, success: true, messageId: emailResponse.data?.id });
        }

      } catch (emailError) {
        console.error("Error sending email to", email, ":", emailError);
        emailResults.push({ email, success: false, error: emailError.message });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    console.log(`Sent ${successCount}/${emailResults.length} emails successfully`);

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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);