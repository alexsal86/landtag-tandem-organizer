import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ResendInvitationRequest {
  pollId: string;
  participantEmail: string;
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

    const { pollId, participantEmail }: ResendInvitationRequest = await req.json();

    console.log("Resending poll invitation for poll:", pollId, "to:", participantEmail);

    // Get poll information
    const { data: poll, error: pollError } = await supabase
      .from('appointment_polls')
      .select('title, description, user_id')
      .eq('id', pollId)
      .single();

    if (pollError || !poll) {
      throw new Error('Poll not found');
    }

    // Get creator information
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', poll.user_id)
      .single();

    const creatorName = profile?.display_name || 'Unbekannt';

    // Get participant information
    const { data: participant, error: participantError } = await supabase
      .from('poll_participants')
      .select('token, name')
      .eq('poll_id', pollId)
      .eq('email', participantEmail)
      .maybeSingle();

    if (participantError) {
      console.error('Database error getting participant:', participantError);
      throw new Error('Database error');
    }

    if (!participant) {
      console.error('Participant not found for email:', participantEmail);
      throw new Error('Participant not found');
    }

    if (!participant.token) {
      console.error('No token found for participant:', participantEmail);
      throw new Error('No token found for participant');
    }

    // Get current domain dynamically
    const origin = req.headers.get('origin') || req.headers.get('referer');
    const domain = origin ? new URL(origin).origin : 'https://wawofclbehbkebjivdte.supabase.co';
    const pollUrl = `${domain}/poll-guest/${pollId}?token=${participant.token || 'guest'}`;
    
    console.log("Sending email to:", participantEmail, "with URL:", pollUrl);

    // Send invitation email
    const emailResponse = await resend.emails.send({
      from: "Terminabstimmung <noreply@alexander-salomon.de>",
      to: [participantEmail],
      subject: `Erinnerung: Terminabstimmung - ${poll.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; font-size: 24px;">Erinnerung: Terminabstimmung</h1>
          <p style="color: #666; font-size: 16px;">Hallo${participant.name ? ` ${participant.name}` : ''},</p>
          <p style="color: #666; font-size: 16px;">
            Dies ist eine Erinnerung an die Terminabstimmung von ${creatorName}:
          </p>
          <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 8px 0; color: #333;">${poll.title}</h3>
            ${poll.description ? `<p style="margin: 0; color: #666;">${poll.description}</p>` : ''}
          </div>
          <p style="color: #666; font-size: 16px;">
            Falls Sie noch nicht geantwortet haben, klicken Sie bitte auf den folgenden Link:
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

    if (emailResponse.error || !emailResponse.data) {
      console.error("Email send error:", emailResponse.error);
      
      // Check if it's a domain verification issue
      const isTestModeError = emailResponse.error && 
        (emailResponse.error.toString().includes('testing emails') || 
         emailResponse.error.toString().includes('verify a domain'));
      
      if (isTestModeError) {
        throw new Error('Domain nicht verifiziert - E-Mails können nur an verifizierte Adressen gesendet werden. Bitte verifizieren Sie Ihre Domain bei Resend.');
      } else {
        throw new Error(`Email send failed: ${JSON.stringify(emailResponse.error)}`);
      }
    }

    console.log("Reminder email sent successfully to:", participantEmail, "ID:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Reminder invitation sent successfully",
        messageId: emailResponse.data?.id
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in resend-poll-invitation function:", error);
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