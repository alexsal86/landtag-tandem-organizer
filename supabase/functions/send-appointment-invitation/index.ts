import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationRequest {
  appointmentId: string;
  guestIds?: string[];
  sendToAll?: boolean;
}

interface AppointmentData {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  user_id: string;
  calendar_uid?: string;
}

interface GuestData {
  id: string;
  name: string;
  email: string;
  invitation_token: string;
}

interface OrganizerData {
  display_name: string;
  email: string;
}

function generateCalendarLinks(appointment: AppointmentData, guestToken: string) {
  const startDate = new Date(appointment.start_time);
  const endDate = new Date(appointment.end_time);
  const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('https://', '').replace('.supabase.co', '');
  const responseUrl = `https://${baseUrl}.lovable.app/guest-response/${guestToken}`;
  
  // Format dates for URL encoding
  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(appointment.title)}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${encodeURIComponent((appointment.description || '') + `\n\nTeilnahme bestätigen: ${responseUrl}`)}&location=${encodeURIComponent(appointment.location || '')}`;
  
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(appointment.title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${encodeURIComponent((appointment.description || '') + `\n\nTeilnahme bestätigen: ${responseUrl}`)}&location=${encodeURIComponent(appointment.location || '')}`;
  
  return { googleUrl, outlookUrl, responseUrl };
}

function generateEmailTemplate(appointment: AppointmentData, guest: GuestData, organizer: OrganizerData, calendarLinks: any) {
  const startDate = new Date(appointment.start_time);
  const endDate = new Date(appointment.end_time);
  
  const formatDate = (date: Date) => date.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const formatTime = (date: Date) => date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Termineinladung</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 300;">Termineinladung</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Sie wurden zu einem Termin eingeladen</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
        <h2 style="margin-top: 0; color: #667eea; font-size: 24px;">${appointment.title}</h2>
        
        <div style="margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>📅 Datum:</strong> ${formatDate(startDate)}</p>
          <p style="margin: 5px 0;"><strong>🕐 Zeit:</strong> ${formatTime(startDate)} - ${formatTime(endDate)}</p>
          ${appointment.location ? `<p style="margin: 5px 0;"><strong>📍 Ort:</strong> ${appointment.location}</p>` : ''}
          <p style="margin: 5px 0;"><strong>👤 Organisator:</strong> ${organizer.display_name}</p>
        </div>

        ${appointment.description ? `
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef;">
            <h3 style="margin-top: 0; color: #495057;">Beschreibung:</h3>
            <p style="color: #6c757d;">${appointment.description}</p>
          </div>
        ` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <h3 style="color: #667eea; margin-bottom: 20px;">Termin zu Ihrem Kalender hinzufügen:</h3>
        
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
          <a href="${calendarLinks.googleUrl}" 
             style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 25px; font-weight: 500; display: inline-block; min-width: 120px;">
            📅 Google Calendar
          </a>
          
          <a href="${calendarLinks.outlookUrl}"
             style="background: #0078d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 25px; font-weight: 500; display: inline-block; min-width: 120px;">
            📅 Outlook
          </a>
        </div>
      </div>

      <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
        <h3 style="margin-top: 0; color: #1976d2;">Teilnahme bestätigen</h3>
        <p style="margin-bottom: 20px; color: #424242;">Bitte bestätigen Sie Ihre Teilnahme an diesem Termin:</p>
        <a href="${calendarLinks.responseUrl}" 
           style="background: #4caf50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; font-size: 16px; display: inline-block;">
          ✅ Teilnahme bestätigen
        </a>
      </div>

      <div style="border-top: 1px solid #e9ecef; padding-top: 20px; margin-top: 40px; color: #6c757d; font-size: 14px; text-align: center;">
        <p>Wenn Sie Fragen haben, antworten Sie einfach auf diese E-Mail.</p>
        <p style="margin-top: 15px; font-style: italic;">Diese Einladung wurde automatisch generiert.</p>
      </div>

    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { appointmentId, guestIds, sendToAll }: InvitationRequest = await req.json();
    
    // Get appointment data
    const { data: appointment, error: appointmentError } = await supabaseClient
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      throw new Error('Appointment not found');
    }

    // Get organizer data
    const { data: organizer, error: organizerError } = await supabaseClient
      .from('profiles')
      .select('display_name')
      .eq('user_id', appointment.user_id)
      .single();

    if (organizerError) {
      throw new Error('Organizer not found');
    }

    // Get organizer email from auth
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    const organizerEmail = user?.email || 'noreply@lovable.app';

    const organizerData = {
      display_name: organizer.display_name || 'Unbekannter Organisator',
      email: organizerEmail
    };

    // Get guests to invite
    let guestsQuery = supabaseClient
      .from('appointment_guests')
      .select('*')
      .eq('appointment_id', appointmentId);
    
    if (!sendToAll && guestIds && guestIds.length > 0) {
      guestsQuery = guestsQuery.in('id', guestIds);
    }

    const { data: guests, error: guestsError } = await guestsQuery;

    if (guestsError) {
      throw new Error('Failed to fetch guests');
    }

    if (!guests || guests.length === 0) {
      throw new Error('No guests found to invite');
    }

    // Generate ICS content
    const { data: icsResponse } = await supabaseClient.functions.invoke('generate-calendar-invite', {
      body: {
        appointmentId,
        title: appointment.title,
        description: appointment.description,
        startTime: appointment.start_time,
        endTime: appointment.end_time,
        location: appointment.location,
        organizer: organizerData,
        attendees: guests.map((g: GuestData) => ({ name: g.name, email: g.email }))
      }
    });

    // Send invitations to each guest
    const results = [];
    
    for (const guest of guests) {
      try {
        const calendarLinks = generateCalendarLinks(appointment, guest.invitation_token);
        const emailHtml = generateEmailTemplate(appointment, guest, organizerData, calendarLinks);
        
        // Send email with ICS attachment
        const emailResponse = await resend.emails.send({
          from: `${organizerData.display_name} <onboarding@resend.dev>`,
          to: [guest.email],
          subject: `Termineinladung: ${appointment.title}`,
          html: emailHtml,
          attachments: icsResponse?.icsContent ? [{
            filename: `${appointment.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`,
            content: icsResponse.icsContent,
            type: 'text/calendar',
          }] : undefined,
        });

        if (emailResponse.error) {
          throw emailResponse.error;
        }

        // Update guest status
        await supabaseClient
          .from('appointment_guests')
          .update({ 
            status: 'invited',
            invited_at: new Date().toISOString()
          })
          .eq('id', guest.id);

        results.push({ 
          guestId: guest.id, 
          email: guest.email, 
          success: true,
          messageId: emailResponse.data?.id
        });

      } catch (error: any) {
        console.error(`Failed to send invitation to ${guest.email}:`, error);
        results.push({ 
          guestId: guest.id, 
          email: guest.email, 
          success: false, 
          error: error.message 
        });
      }
    }

    // Update appointment with last invitation sent timestamp
    await supabaseClient
      .from('appointments')
      .update({ last_invitation_sent_at: new Date().toISOString() })
      .eq('id', appointmentId);

    console.log('Invitation results:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-appointment-invitation function:', error);
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