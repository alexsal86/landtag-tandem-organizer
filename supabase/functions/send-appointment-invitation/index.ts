import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

const handler = async (req: Request): Promise<Response> => {
  console.log("=== APPOINTMENT INVITATION FUNCTION CALLED ===");
  console.log("Method:", req.method);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    console.log("Creating Supabase client...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Parsing request body...");
    const { appointmentId, guestIds, sendToAll }: InvitationRequest = await req.json();

    console.log("=== SEND APPOINTMENT INVITATION DEBUG ===");
    console.log("Appointment ID:", appointmentId);
    console.log("Guest IDs:", guestIds);
    console.log("Send to all:", sendToAll);
    console.log("=== END DEBUG INFO ===");

    // Get appointment data
    console.log("Fetching appointment data...");
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error("Error getting appointment:", appointmentError);
      throw new Error('Termin nicht gefunden');
    }

    console.log("Appointment found:", appointment.title);

    // Get organizer data
    console.log("Fetching organizer data...");
    const { data: organizer, error: organizerError } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', appointment.user_id)
      .single();

    if (organizerError) {
      console.error("Error getting organizer:", organizerError);
      throw new Error('Organisator nicht gefunden');
    }

    // Get organizer email from auth.users using service role
    console.log("Fetching organizer email...");
    const { data: authUserData, error: authError } = await supabase.auth.admin.getUserById(appointment.user_id);
    
    if (authError || !authUserData.user?.email) {
      console.error("Error getting organizer email:", authError);
      throw new Error('Organisator E-Mail nicht gefunden');
    }

    const organizerName = organizer?.display_name || 'Unbekannter Organisator';
    const organizerEmail = authUserData.user.email;

    console.log("Organizer:", organizerName, organizerEmail);

    // Get guests to invite
    console.log("Fetching guests...");
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
      throw new Error('Gäste nicht gefunden');
    }

    if (!guests || guests.length === 0) {
      console.log("No guests found to invite");
      throw new Error('Keine Gäste zum Einladen gefunden');
    }

    console.log(`Found ${guests.length} guests to invite`);

    const emailResults = [];

    // Format appointment dates
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

    // Send invitations to each guest
    for (const guest of guests) {
      try {
        console.log("Processing guest:", guest.name, guest.email);

        // Get current domain dynamically
        const origin = req.headers.get('origin') || req.headers.get('referer');
        const domain = origin ? new URL(origin).origin : 'https://wawofclbehbkebjivdte.supabase.co';
        
        // Generate response URL with guest token
        const responseUrl = `${domain}/guest-response/${guest.invitation_token}`;

        console.log("Sending email via Resend...");
        
        // Send appointment invitation email
        const emailResponse = await resend.emails.send({
          from: "Termineinladung <noreply@alexander-salomon.de>",
          to: [guest.email],
          subject: `Termineinladung: ${appointment.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Termineinladung</h1>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 16px;">Hallo ${guest.name},</p>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                ${organizerName} lädt Sie zu folgendem Termin ein:
              </p>
              
              <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 8px 0; color: #333; font-size: 18px;">${appointment.title}</h3>
                <p style="margin: 5px 0; color: #666;"><strong>📅 Datum:</strong> ${formatDate(startDate)}</p>
                <p style="margin: 5px 0; color: #666;"><strong>🕐 Zeit:</strong> ${formatTime(startDate)} - ${formatTime(endDate)}</p>
                ${appointment.location ? `<p style="margin: 5px 0; color: #666;"><strong>📍 Ort:</strong> ${appointment.location}</p>` : ''}
                ${appointment.description ? `<p style="margin: 8px 0 0 0; color: #666;">${appointment.description}</p>` : ''}
              </div>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                Bitte bestätigen Sie Ihre Teilnahme:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${responseUrl}" 
                   style="background: #22c55e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.2);">
                  ✅ Teilnahme bestätigen
                </a>
              </div>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 10px;">
                Vielen Dank!
              </p>
              
              <p style="color: #666; font-size: 16px; font-weight: 500;">
                ${organizerName}
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">
                Diese E-Mail wurde automatisch generiert. Bei Fragen können Sie direkt auf diese E-Mail antworten.
              </p>
            </div>
          `,
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
              email: guest.email,
              success: false, 
              error: "Domain nicht verifiziert - E-Mails können nur an verifizierte Adressen gesendet werden" 
            });
          } else {
            emailResults.push({ 
              guestId: guest.id, 
              email: guest.email,
              success: false, 
              error: errorMessage 
            });
          }
        } else {
          console.log("Email sent successfully to:", guest.email, "ID:", emailResponse.data?.id);
          
          // Update guest status
          await supabase
            .from('appointment_guests')
            .update({ 
              status: 'invited',
              invited_at: new Date().toISOString()
            })
            .eq('id', guest.id);

          emailResults.push({ 
            guestId: guest.id, 
            email: guest.email,
            success: true, 
            messageId: emailResponse.data?.id 
          });
        }

      } catch (emailError: any) {
        console.error("Error sending email to guest", guest.email, ":", emailError);
        emailResults.push({ 
          guestId: guest.id, 
          email: guest.email,
          success: false, 
          error: emailError.message || "Unbekannter Fehler" 
        });
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
        results: emailResults,
        totalSent: successCount,
        totalFailed: emailResults.length - successCount
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
        message: "Fehler beim Einladungsversand"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);