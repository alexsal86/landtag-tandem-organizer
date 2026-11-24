import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { escapeHtml, safeUrl } from "../_shared/html.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { requireAppBaseUrl } from "../_shared/url.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import {
  appointmentInviteUid,
  buildAppointmentIcs,
  invitationUpdateRequired,
  nextCalendarSequence,
  nextGuestStatusAfterSend,
  normalizeSequence,
  selectInvitationRecipients,
  type InvitationGuestLike,
  type InvitationReason,
} from "../_shared/appointmentInvite.ts";

import { withSafeHandler, requireAuth, unauthorizedResponse } from "../_shared/security.ts";
import { requireTenantAccess } from "../_shared/tenant-access.ts";

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
  tenant_id?: string;
  appointmentId: string;
  /** Nur diese Gäste anschreiben (z. B. neu hinzugefügte). */
  guestIds?: string[];
  /** Erlaubt alten Aufrufern, weiterhin alle Gäste zu adressieren. */
  sendToAll?: boolean;
  /**
   * manual = Knopfdruck, update = echte Zeit-/Ortsänderung,
   * cancel = Absage. Ohne Angabe wird manuell versendet.
   */
  reason?: InvitationReason;
}

interface EmailInput {
  guestName: string;
  organizerName: string;
  appointment: Record<string, unknown>;
  reason: InvitationReason;
  formattedDate: string;
  formattedStartTime: string;
  formattedEndTime: string;
  responseUrl: string | null;
}

function emailSubject(reason: InvitationReason, title: string): string {
  if (reason === "cancel") return `Termin abgesagt: ${title}`;
  if (reason === "update") return `Terminänderung: ${title}`;
  return `Einladung: ${title}`;
}

function emailIntro(reason: InvitationReason, organizerName: string): string {
  if (reason === "cancel") return `${escapeHtml(organizerName)} hat den folgenden Termin abgesagt:`;
  if (reason === "update") return `${escapeHtml(organizerName)} hat den folgenden Termin geändert:`;
  return `${escapeHtml(organizerName)} hat Sie zu folgendem Termin eingeladen:`;
}

function renderEmail(input: EmailInput): string {
  const { appointment, reason, responseUrl } = input;
  const heading = reason === "cancel" ? "Terminabsage" : reason === "update" ? "Terminänderung" : "Termineinladung";
  const calendarNote = reason === "cancel"
    ? "📅 <strong>Kalender-Datei:</strong> Diese E-Mail enthält eine Absage im Kalenderformat. Öffnen Sie die angehängte .ics-Datei, um den Termin aus Ihrem Kalender zu entfernen."
    : "📅 <strong>Kalender-Datei:</strong> Diese E-Mail enthält eine Kalender-Datei im Anhang. Öffnen Sie die angehängte .ics-Datei, um den Termin zu Ihrem Kalender hinzuzufügen. Bei einer Änderung ersetzt sie den bereits gespeicherten Termin.";

  const buttons = responseUrl
    ? `
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
              </p>`
    : "";

  return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">${heading}</h1>

              <p style="color: #666; font-size: 16px; margin-bottom: 16px;">Hallo ${escapeHtml(input.guestName)},</p>

              <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                ${emailIntro(reason, input.organizerName)}
              </p>

              <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 8px 0; color: #333; font-size: 18px;">${escapeHtml(String(appointment.title ?? ""))}</h3>
                ${appointment.description ? `<p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${escapeHtml(String(appointment.description))}</p>` : ''}
                <p style="margin: 4px 0; color: #666; font-size: 14px;"><strong>Datum:</strong> ${input.formattedDate}</p>
                <p style="margin: 4px 0; color: #666; font-size: 14px;"><strong>Zeit:</strong> ${input.formattedStartTime} - ${input.formattedEndTime}</p>
                ${appointment.location ? `<p style="margin: 4px 0; color: #666; font-size: 14px;"><strong>Ort:</strong> ${escapeHtml(String(appointment.location))}</p>` : ''}
                ${appointment.meeting_link ? `<p style="margin: 4px 0; color: #666; font-size: 14px;"><strong>Meeting-Link:</strong> <a href="${safeUrl(String(appointment.meeting_link))}">${escapeHtml(String(appointment.meeting_link))}</a></p>` : ''}
              </div>

              <div style="background: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 12px; margin: 20px 0;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  ${calendarNote}
                </p>
              </div>
              ${buttons}

              <p style="color: #666; font-size: 16px; font-weight: 500;">
                ${escapeHtml(input.organizerName)}
              </p>

              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">
                Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
              </p>
            </div>
          `;
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

    const body: InvitationRequest = await req.json();
    const { appointmentId, guestIds, tenant_id } = body;
    const reason: InvitationReason = body.reason === "update" || body.reason === "cancel" ? body.reason : "manual";
    const access = await requireTenantAccess({ req, functionName: "send-appointment-invitation", requestedTenantId: tenant_id });
    if ("response" in access) return access.response;

    console.log("=== SEND APPOINTMENT INVITATION ===", { appointmentId, reason, guestIds: guestIds?.length ?? 0 });

    // Get appointment data
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('tenant_id', access.tenantId)
      .maybeSingle();

    if (appointmentError) {
      console.error("Error getting appointment data:", appointmentError);
    }

    if (!appointment) {
      console.error("Appointment not found:", appointmentId);
      throw new Error('Termin nicht gefunden');
    }

    // Caller must be an active member of the appointment's tenant.
    const { data: membership } = await supabase
      .from('user_tenant_memberships')
      .select('tenant_id')
      .eq('user_id', auth.userId)
      .eq('tenant_id', appointment.tenant_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!appointment.tenant_id || !membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const calendarSequence = normalizeSequence(appointment.calendar_sequence);
    const requestedGuestIds = Array.isArray(guestIds) ? guestIds.filter(Boolean) : [];

    // Ein Update geht nur raus, wenn Zeit oder Ort tatsächlich geändert wurden
    // (der Trigger erhöht dann die SEQUENCE) oder neue Gäste dazugekommen sind.
    if (
      reason === "update" &&
      requestedGuestIds.length === 0 &&
      !invitationUpdateRequired(calendarSequence, appointment.last_invitation_sequence)
    ) {
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        sent: 0,
        total: 0,
        message: 'Zeit und Ort unverändert – keine erneute Einladung nötig.',
        results: [],
      }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
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
    const { data: guests, error: guestsError } = await supabase
      .from('appointment_guests')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('name');

    if (guestsError) {
      console.error("Error getting guests:", guestsError);
      throw new Error('Fehler beim Laden der Gäste');
    }

    const recipients = selectInvitationRecipients((guests ?? []) as InvitationGuestLike[], {
      reason,
      guestIds: requestedGuestIds,
    });

    if (recipients.length === 0) {
      if (reason === "manual") {
        throw new Error('Keine Gäste zum Einladen gefunden');
      }
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        sent: 0,
        total: 0,
        message: reason === "cancel" ? 'Keine eingeladenen Gäste – keine Absage nötig.' : 'Keine eingeladenen Gäste – keine Änderung nötig.',
        results: [],
      }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Eine UID pro Termin: alle Gäste und alle späteren Updates/Absagen beziehen
    // sich auf dieselbe Kalender-UID. Die Absage nutzt eine höhere SEQUENCE.
    const calendarUid = String(appointment.calendar_uid ?? '').trim() || appointmentInviteUid(appointment.id as string);
    const sequence = reason === "cancel" ? nextCalendarSequence(appointment.calendar_sequence) : calendarSequence;

    if (!String(appointment.calendar_uid ?? '').trim()) {
      const { error: uidError } = await supabase
        .from('appointments')
        .update({ calendar_uid: calendarUid })
        .eq('id', appointmentId);
      if (uidError) console.error('Error storing stable calendar UID:', uidError);
    }

    const icsContent = buildAppointmentIcs({
      uid: calendarUid,
      sequence,
      method: reason === "cancel" ? "CANCEL" : "REQUEST",
      title: String(appointment.title ?? 'Termin'),
      description: appointment.description ?? null,
      location: appointment.location ?? null,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      organizer: { name: organizerName, email: organizerEmail },
      notice: reason === "cancel"
        ? 'Der Termin wurde abgesagt.'
        : reason === "update"
          ? 'Der Termin wurde geändert. Bitte prüfen Sie Datum, Uhrzeit und Ort.'
          : null,
    });

    const icsBase64 = encode(new TextEncoder().encode(icsContent).buffer);
    const encoder = new TextEncoder();
    console.log("ICS generated:", { uid: calendarUid, sequence, bytes: encoder.encode(icsContent).length });

    // Basis-URL nur auflösen, wenn Antwortlinks gebraucht werden – eine Absage
    // funktioniert auch ohne konfigurierte App-URL.
    let baseUrl: string | null = null;
    const resolveBaseUrl = (): string => (baseUrl ??= requireAppBaseUrl(req));

    const startDate = new Date(appointment.start_time);
    const endDate = new Date(appointment.end_time);

    const formattedDate = startDate.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Europe/Berlin',
    });
    const formattedStartTime = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
    const formattedEndTime = endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

    const emailResults = [];

    // Send invitations to each guest
    for (const guest of recipients) {
      try {
        const responseUrl = reason === "cancel" || !guest.invitation_token
          ? null
          : `${resolveBaseUrl()}/guest-response/${guest.invitation_token}`;

        const emailResponse = await resend.emails.send({
          from: "Termineinladung <noreply@alexander-salomon.de>",
          to: [guest.email],
          subject: emailSubject(reason, String(appointment.title ?? 'Termin')),
          html: renderEmail({
            guestName: guest.name || guest.email,
            organizerName,
            appointment: appointment as Record<string, unknown>,
            reason,
            formattedDate,
            formattedStartTime,
            formattedEndTime,
            responseUrl,
          }),
          attachments: [
            {
              filename: reason === "cancel" ? "termin-absage.ics" : "termin.ics",
              content: icsBase64,
              contentType: "text/calendar",
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
          console.log("Invitation email sent, ID:", emailResponse.data?.id);
          emailResults.push({ guestId: guest.id, success: true, messageId: emailResponse.data?.id });

          if (reason !== "cancel") {
            // RSVP-Status und Antwortlink bleiben erhalten: bestätigte oder
            // abgelehnte Gäste werden nicht auf "invited" zurückgesetzt.
            await supabase
              .from('appointment_guests')
              .update({
                status: nextGuestStatusAfterSend(guest.status),
                invited_at: new Date().toISOString(),
              })
              .eq('id', guest.id);
          }
        }

      } catch (emailError: unknown) {
        const message = emailError instanceof Error ? emailError.message : "Unbekannter Fehler";
        console.error("Error sending email to guest", guest.id, ":", emailError);
        emailResults.push({ guestId: guest.id, success: false, error: message });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;

    if (successCount > 0) {
      if (reason === "cancel") {
        // Absage-Sequence bleibt erhalten, auch wenn der Termin danach gelöscht wird.
        await supabase
          .from('appointments')
          .update({ calendar_sequence: sequence })
          .eq('id', appointmentId);
      } else {
        await supabase
          .from('appointments')
          .update({
            last_invitation_sent_at: new Date().toISOString(),
            last_invitation_sequence: calendarSequence,
          })
          .eq('id', appointmentId);
      }
    }

    console.log(`Sent ${successCount}/${emailResults.length} emails successfully (${reason}, sequence ${sequence})`);

    const message = reason === "cancel"
      ? `${successCount}/${emailResults.length} Absagen erfolgreich versendet`
      : reason === "update"
        ? `${successCount}/${emailResults.length} Terminänderungen erfolgreich versendet`
        : `${successCount}/${emailResults.length} Einladungen erfolgreich versendet`;

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        skipped: false,
        sent: successCount,
        total: emailResults.length,
        message,
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

  } catch (error: unknown) {
    console.error("Error in send-appointment-invitation function:", error);
    return new Response(
      JSON.stringify({
        error: { code: 'internal_error', message: 'Internal server error' },
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

serve(withSafeHandler("send-appointment-invitation", handler));
