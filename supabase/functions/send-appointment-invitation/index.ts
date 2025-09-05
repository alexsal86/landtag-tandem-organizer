import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

console.log('🚀 send-appointment-invitation function starting...');

// Initialize Resend with error handling
let resend: Resend;
try {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY is not available');
    throw new Error('RESEND_API_KEY environment variable is required');
  }
  resend = new Resend(apiKey);
  console.log('✅ Resend initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Resend:', error);
  throw error;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  appointmentId: string;
  guestIds?: string[];
  sendToAll?: boolean;
}

// ICS Calendar generation functions
function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2)}@lovable.app`;
}

function formatDateToICS(date: string): string {
  return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICSValue(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function generateICS(appointment: any, organizer: { name: string; email: string }): string {
  const uid = generateUID();
  const startTime = formatDateToICS(appointment.start_time);
  const endTime = formatDateToICS(appointment.end_time);
  const now = formatDateToICS(new Date().toISOString());
  
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lovable//Appointment Scheduler//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${startTime}`,
    `DTEND:${endTime}`,
    `SUMMARY:${escapeICSValue(appointment.title)}`,
    `ORGANIZER;CN=${escapeICSValue(organizer.name)}:mailto:${organizer.email}`,
  ];

  if (appointment.description) {
    icsContent.push(`DESCRIPTION:${escapeICSValue(appointment.description)}`);
  }

  if (appointment.location) {
    icsContent.push(`LOCATION:${escapeICSValue(appointment.location)}`);
  }

  icsContent.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return icsContent.join('\r\n');
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

    const { appointmentId, guestIds, sendToAll }: InvitationRequest = await req.json();

    console.log("=== SEND APPOINTMENT INVITATION DEBUG ===");
    console.log("Appointment ID:", appointmentId);
    console.log("Guest IDs:", guestIds);
    console.log("Send to all:", sendToAll);
    console.log("=== END DEBUG INFO ===");

    // Get appointment data
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .maybeSingle();

    if (appointmentError) {
      console.error("Error getting appointment data:", appointmentError);
    }

    if (!appointment) {
      console.error("Appointment not found:", appointmentId);
      throw new Error('Termin nicht gefunden');
    }

    // Get organizer data
    const { data: organizer, error: organizerError } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', appointment.user_id)
      .maybeSingle();

    if (organizerError) {
      console.error("Error getting organizer profile:", organizerError);
    }

    // Get organizer email from auth.users using service role
    const { data: authUserData, error: authError } = await supabase.auth.admin.getUserById(appointment.user_id);
    
    if (authError || !authUserData.user?.email) {
      console.error("Error getting organizer email:", authError);
      throw new Error('Organisator E-Mail nicht gefunden');
    }

    const organizerName = organizer?.display_name || 'Unbekannter Organisator';
    const organizerEmail = authUserData.user.email;

    // Get guests to invite
    let guestsQuery = supabase
      .from('appointment_guests')
      .select('*')
      .eq('appointment_id', appointmentId);

    if (!sendToAll && guestIds && guestIds.length > 0) {
      guestsQuery = guestsQuery.in('id', guestIds);
    }

    const { data: guests, error: guestsError } = await guestsQuery;

    if (guestsError) {
      console.error("Error getting guests:", guestsError);
      throw new Error('Fehler beim Laden der Gäste');
    }

    if (!guests || guests.length === 0) {
      throw new Error('Keine Gäste zum Einladen gefunden');
    }

    const emailResults = [];

    // Send invitations to each guest
    for (const guest of guests) {
      try {
        console.log("Processing guest:", guest.name, guest.email);

        // Format dates
        const startDate = new Date(appointment.start_time);
        const endDate = new Date(appointment.end_time);
        
        const dateOptions: Intl.DateTimeFormatOptions = {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Europe/Berlin'
        };
        
        const timeOptions: Intl.DateTimeFormatOptions = {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Berlin'
        };

        const formattedDate = startDate.toLocaleDateString('de-DE', dateOptions);
        const formattedStartTime = startDate.toLocaleTimeString('de-DE', timeOptions);
        const formattedEndTime = endDate.toLocaleTimeString('de-DE', timeOptions);

        // Get current domain dynamically
        const origin = req.headers.get('origin') || req.headers.get('referer');
        const domain = origin ? new URL(origin).origin : 'https://wawofclbehbkebjivdte.supabase.co';
        
        // Generate response URL with guest token
        const responseUrl = `${domain}/guest-response/${guest.invitation_token}`;

        console.log("About to send email to:", guest.email, "for guest:", guest.name);

        // Generate ICS calendar file
        const icsContent = generateICS(appointment, { 
          name: organizerName, 
          email: organizerEmail 
        });
        
        console.log("Generated ICS content:", icsContent.substring(0, 200) + "...");
        console.log("Generated ICS content length:", icsContent.length);
        
        // Convert ICS content to base64 using Deno's built-in encoding
        const encoder = new TextEncoder();
        const data = encoder.encode(icsContent);
        const icsBase64 = encode(data);
        
        console.log("Base64 encoded ICS length:", icsBase64.length);

        // Send appointment invitation email with ICS attachment
        const emailResponse = await resend.emails.send({
          from: "Termineinladung <noreply@alexander-salomon.de>",
          to: [guest.email],
          subject: `Einladung: ${appointment.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Termineinladung</h1>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 16px;">Hallo ${guest.name},</p>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                ${organizerName} hat Sie zu folgendem Termin eingeladen:
              </p>
              
              <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 8px 0; color: #333; font-size: 18px;">${appointment.title}</h3>
                ${appointment.description ? `<p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${appointment.description}</p>` : ''}
                <p style="margin: 4px 0; color: #666; font-size: 14px;"><strong>Datum:</strong> ${formattedDate}</p>
                <p style="margin: 4px 0; color: #666; font-size: 14px;"><strong>Zeit:</strong> ${formattedStartTime} - ${formattedEndTime}</p>
                ${appointment.location ? `<p style="margin: 4px 0; color: #666; font-size: 14px;"><strong>Ort:</strong> ${appointment.location}</p>` : ''}
                ${appointment.meeting_link ? `<p style="margin: 4px 0; color: #666; font-size: 14px;"><strong>Meeting-Link:</strong> <a href="${appointment.meeting_link}">${appointment.meeting_link}</a></p>` : ''}
              </div>
              
              <div style="background: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 12px; margin: 20px 0;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  📅 <strong>Kalender-Datei:</strong> Diese E-Mail enthält eine Kalender-Datei im Anhang. 
                  Öffnen Sie die angehängte .ics-Datei, um den Termin zu Ihrem Kalender hinzuzufügen.
                </p>
              </div>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                Bitte bestätigen Sie Ihre Teilnahme:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${responseUrl}?response=accepted" 
                   style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 5px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.2);">
                  ✓ Zusagen
                </a>
                <a href="${responseUrl}?response=declined" 
                   style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 5px; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);">
                  ✗ Absagen
                </a>
              </div>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 10px;">
                Vielen Dank für Ihre Rückmeldung!
              </p>
              
              <p style="color: #666; font-size: 16px; font-weight: 500;">
                ${organizerName}
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">
                Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
              </p>
            </div>
          `,
          attachments: [
            {
              filename: "termin.ics",
              content: icsBase64,
              type: "text/calendar",
            }
          ]
        });

        if (emailResponse.error) {
          console.error("Email send error:", emailResponse.error);
          const errorMessage = emailResponse.error.toString();
          const isTestModeError = errorMessage.includes('testing emails') || 
                                 errorMessage.includes('verify a domain') ||
                                 errorMessage.includes('Domain not found');
          
          if (isTestModeError) {
            emailResults.push({ 
              guestId: guest.id, 
              success: false, 
              error: "Domain nicht verifiziert - E-Mails können nur an verifizierte Adressen gesendet werden" 
            });
          } else {
            emailResults.push({ guestId: guest.id, success: false, error: errorMessage });
          }
        } else {
          console.log("Email sent successfully to:", guest.email, "ID:", emailResponse.data?.id);
          emailResults.push({ guestId: guest.id, success: true, messageId: emailResponse.data?.id });

          // Update guest status and invitation timestamp
          await supabase
            .from('appointment_guests')
            .update({ 
              status: 'invited',
              invited_at: new Date().toISOString()
            })
            .eq('id', guest.id);
        }

      } catch (emailError: any) {
        console.error("Error sending email to guest", guest.id, ":", emailError);
        emailResults.push({ guestId: guest.id, success: false, error: emailError.message || "Unbekannter Fehler" });
      }
    }

    // Update appointment with last invitation sent timestamp
    if (emailResults.some(r => r.success)) {
      await supabase
        .from('appointments')
        .update({ last_invitation_sent_at: new Date().toISOString() })
        .eq('id', appointmentId);
    }

    const successCount = emailResults.filter(r => r.success).length;
    console.log("=== EMAIL RESULTS SUMMARY ===");
    console.log(`Sent ${successCount}/${emailResults.length} emails successfully`);
    console.log("Results:", JSON.stringify(emailResults, null, 2));
    console.log("=== END SUMMARY ===");

    return new Response(
      JSON.stringify({ 
        success: successCount > 0, 
        message: `${successCount}/${emailResults.length} Einladungen erfolgreich versendet`,
        results: emailResults
      }),
      {
        status: 200, // Always return 200 for better debugging
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in send-appointment-invitation function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        success: false,
        message: "Fehler beim Versenden der Einladungen"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);