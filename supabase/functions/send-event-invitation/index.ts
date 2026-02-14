import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { eventPlanningId, eventTitle, rsvpIds } = await req.json();

    console.log('Sending event invitations:', { eventPlanningId, eventTitle, rsvpIds });

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('event_plannings')
      .select('title, description, confirmed_date, location, user_id')
      .eq('id', eventPlanningId)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // Get creator name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', event.user_id)
      .single();

    const creatorName = profile?.display_name || 'Unbekannt';

    // Get RSVPs with tokens
    const { data: rsvps, error: rsvpError } = await supabase
      .from('event_rsvps')
      .select('id, email, name, token')
      .in('id', rsvpIds);

    if (rsvpError) throw rsvpError;

    const origin = req.headers.get('origin') || req.headers.get('referer');
    const domain = origin ? new URL(origin).origin : 'https://wawofclbehbkebjivdte.supabase.co';

    const results = await Promise.all(
      (rsvps || []).map(async (rsvp) => {
        const rsvpUrl = `${domain}/event-rsvp/${eventPlanningId}?token=${rsvp.token}`;
        
        try {
          const emailResponse = await resend.emails.send({
            from: 'Veranstaltung <noreply@alexander-salomon.de>',
            to: [rsvp.email],
            subject: `Einladung: ${event.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; font-size: 24px;">Einladung zur Veranstaltung</h1>
                <p style="color: #666;">Hallo ${rsvp.name},</p>
                <p style="color: #666;">${creatorName} lädt Sie herzlich ein:</p>
                <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
                  <h3 style="margin: 0 0 8px 0; color: #333;">${event.title}</h3>
                  ${event.description ? `<p style="margin: 0 0 4px 0; color: #666;">${event.description}</p>` : ''}
                  ${event.confirmed_date ? `<p style="margin: 0 0 4px 0; color: #666;">📅 ${event.confirmed_date}</p>` : ''}
                  ${event.location ? `<p style="margin: 0; color: #666;">📍 ${event.location}</p>` : ''}
                </div>
                <p style="color: #666;">Bitte teilen Sie uns mit, ob Sie teilnehmen können:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${rsvpUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Zu-/Absage mitteilen
                  </a>
                </div>
                <p style="color: #999; font-size: 14px;">
                  <a href="${rsvpUrl}" style="color: #3b82f6;">${rsvpUrl}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">
                  Diese E-Mail wurde automatisch generiert.
                </p>
              </div>
            `,
          });

          console.log(`Email sent to ${rsvp.email}:`, emailResponse);
          return { email: rsvp.email, success: true };
        } catch (error) {
          console.error(`Error sending to ${rsvp.email}:`, error);
          return { email: rsvp.email, success: false, error: String(error) };
        }
      })
    );

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in send-event-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
