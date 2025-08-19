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

    // Create participants and send emails
    for (const email of participantEmails) {
      // Generate unique token for this participant
      const { data: tokenData } = await supabase.rpc('generate_participant_token');
      const token = tokenData;

      // Create participant record
      const { data: participant, error: participantError } = await supabase
        .from('poll_participants')
        .insert({
          poll_id: pollId,
          email: email,
          name: email.split('@')[0], // Use email prefix as default name
          token: token,
          is_external: true
        })
        .select()
        .single();

      if (participantError) {
        console.error("Error creating participant:", participantError);
        continue;
      }

      // Send invitation email
      const pollUrl = `${Deno.env.get("SUPABASE_URL")?.replace('supabase.co', 'vercel.app') || 'https://your-app.vercel.app'}/poll/${pollId}?token=${token}`;
      
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

      console.log("Email sent to:", email, emailResponse);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Invitations sent successfully" }),
      {
        status: 200,
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