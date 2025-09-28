import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  pollId: string;
  notificationType: 'new_response' | 'poll_updated' | 'poll_deleted' | 'deadline_reminder';
  participantEmails?: string[];
  changes?: string;
  respondentName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { pollId, notificationType, participantEmails, changes, respondentName }: NotificationRequest = await req.json();

    console.log('Sending poll notifications:', { pollId, notificationType, participantEmails, changes });

    // Get poll details
    const { data: poll, error: pollError } = await supabase
      .from('appointment_polls')
      .select('title, description')
      .eq('id', pollId)
      .single();

    if (pollError) {
      console.error('Error fetching poll:', pollError);
      throw pollError;
    }

    // Get poll creator details
    const { data: creator, error: creatorError } = await supabase
      .from('appointment_polls')
      .select(`
        user_id,
        profiles!inner(display_name)
      `)
      .eq('id', pollId)
      .single();

    if (creatorError) {
      console.error('Error fetching creator:', creatorError);
      throw creatorError;
    }

    const creatorName = Array.isArray(creator.profiles) 
      ? (creator.profiles[0] as any)?.display_name || 'Unbekannt'
      : (creator.profiles as any)?.display_name || 'Unbekannt';

    let emailSubject = '';
    let emailHtml = '';

    switch (notificationType) {
      case 'new_response':
        emailSubject = `Neue Antwort bei Terminabstimmung: ${poll.title}`;
        emailHtml = `
          <h2>Neue Antwort erhalten</h2>
          <p><strong>${respondentName}</strong> hat bei der Terminabstimmung "<strong>${poll.title}</strong>" geantwortet.</p>
          <p>Sie können die Ergebnisse in der Übersicht einsehen.</p>
          <p>Mit freundlichen Grüßen,<br>${creatorName}</p>
        `;
        break;
      
      case 'poll_updated':
        emailSubject = `Terminabstimmung aktualisiert: ${poll.title}`;
        emailHtml = `
          <h2>Terminabstimmung wurde aktualisiert</h2>
          <p>Die Terminabstimmung "<strong>${poll.title}</strong>" wurde aktualisiert.</p>
          ${changes ? `<p><strong>Änderungen:</strong> ${changes}</p>` : ''}
          <p>Bitte überprüfen Sie Ihre Antwort und passen Sie diese gegebenenfalls an.</p>
          <p>Mit freundlichen Grüßen,<br>${creatorName}</p>
        `;
        break;
      
      case 'poll_deleted':
        emailSubject = `Terminabstimmung abgesagt: ${poll.title}`;
        emailHtml = `
          <h2>Terminabstimmung wurde abgesagt</h2>
          <p>Die Terminabstimmung "<strong>${poll.title}</strong>" wurde abgesagt.</p>
          <p>Falls Sie Fragen haben, wenden Sie sich bitte an ${creatorName}.</p>
          <p>Mit freundlichen Grüßen,<br>${creatorName}</p>
        `;
        break;
      
      case 'deadline_reminder':
        emailSubject = `Erinnerung: Terminabstimmung läuft ab - ${poll.title}`;
        emailHtml = `
          <h2>Erinnerung: Antwortfrist läuft bald ab</h2>
          <p>Die Antwortfrist für die Terminabstimmung "<strong>${poll.title}</strong>" läuft bald ab.</p>
          <p>Bitte geben Sie Ihre Verfügbarkeit rechtzeitig bekannt.</p>
          <p>Mit freundlichen Grüßen,<br>${creatorName}</p>
        `;
        break;
    }

    // Send emails to specified participants or all external participants
    let targetEmails = participantEmails;
    
    if (!targetEmails) {
      // Get all external participants
      const { data: participants, error: participantsError } = await supabase
        .from('poll_participants')
        .select('email')
        .eq('poll_id', pollId)
        .eq('is_external', true);
      
      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
        throw participantsError;
      }
      
      targetEmails = participants.map(p => p.email);
    }

    const emailPromises = targetEmails.map(async (email) => {
      try {
        const emailResponse = await resend.emails.send({
          from: 'Büro-Management <noreply@resend.dev>',
          to: [email],
          subject: emailSubject,
          html: emailHtml,
        });

        console.log(`Email sent to ${email}:`, emailResponse);
        return { email, success: true, response: emailResponse };
      } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
        return { email, success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Notification results: ${successful} successful, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      sent: successful,
      failed: failed,
      results: results
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-poll-notifications function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);