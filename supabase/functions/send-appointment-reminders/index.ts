// Termin-Erinnerungen aus reminder_minutes.
//
// Wird ausschließlich vom Scheduler (pg_cron, Service-Role) aufgerufen. Die
// Datenbank übernimmt fällige Erinnerungen atomar (doppelte Läufe erzeugen
// keinen zweiten Versand) und legt dabei die In-App-Benachrichtigung an; deren
// Insert-Trigger stößt den Push an. Diese Function verschickt zusätzlich eine
// Mail, wenn APPOINTMENT_REMINDER_EMAIL=true gesetzt ist und eine App-URL
// bekannt ist (sonst wären die Links in der Mail ungültig).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { escapeHtml } from "../_shared/html.ts";
import { isAppointmentReminderDue } from "../_shared/appointmentReminder.ts";
import {
  forbiddenResponse,
  jsonResponse,
  requireServiceRole,
  withSafeHandler,
} from "../_shared/security.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { resolveAppBaseUrl } from "../_shared/url.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const MAX_REMINDERS_PER_RUN = 200;

interface ReminderRow {
  appointment_id: string;
  user_id: string;
  tenant_id: string;
  title: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  minutes_before: number;
  notification_id: string | null;
  notified: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (!requireServiceRole(req)) {
    return forbiddenResponse("Nur der Scheduler darf Termin-Erinnerungen versenden.");
  }

  const supabase = createServiceRoleClient();

  // Optional: Mail nur mit ausdrücklicher Freigabe und vorhandenem Resend-Key.
  const mailEnabled =
    (Deno.env.get("APPOINTMENT_REMINDER_EMAIL") ?? "").trim().toLowerCase() === "true";
  const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();

  const hostOf = (value: string) => {
    try {
      return new URL(value).host;
    } catch {
      return "";
    }
  };
  const baseUrl = resolveAppBaseUrl(req);
  const supabaseHost = hostOf(Deno.env.get("SUPABASE_URL") ?? "");
  const linkBaseUrl = baseUrl && hostOf(baseUrl) !== supabaseHost ? baseUrl.replace(/\/+$/, "") : "";

  const { data, error } = await supabase.rpc("dispatch_due_appointment_reminders", {
    _limit: MAX_REMINDERS_PER_RUN,
  });
  if (error) throw error;

  const rows = (data ?? []) as ReminderRow[];
  const now = new Date();
  const results: Array<Record<string, unknown>> = [];
  let claimed = 0;
  let notified = 0;
  let emailed = 0;
  let failed = 0;
  let skippedMail = 0;

  for (const row of rows) {
    claimed += 1;

    // Doppelte Sicherung gegen den Datenbank-Claim: nach Terminbeginn oder ohne
    // gültigen Vorlauf wird weder erinnert noch gemailt.
    const stillDue = isAppointmentReminderDue(
      { id: row.appointment_id, startTime: row.start_time, reminderMinutes: row.minutes_before },
      now,
    );
    if (!stillDue) {
      results.push({ appointmentId: row.appointment_id, skipped: "not_due" });
      continue;
    }

    if (!row.notified) {
      // In-App war deaktiviert oder der Typ fehlt; dann auch keine Mail.
      results.push({ appointmentId: row.appointment_id, skipped: "notification_not_created" });
      continue;
    }
    notified += 1;

    if (!mailEnabled) {
      results.push({ appointmentId: row.appointment_id, notified: true, emailed: false });
      continue;
    }
    if (!resendKey || !linkBaseUrl) {
      skippedMail += 1;
      results.push({
        appointmentId: row.appointment_id,
        notified: true,
        emailed: false,
        skipped: !resendKey ? "resend_key_missing" : "app_base_url_missing",
      });
      continue;
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(row.user_id);
    const email = authUser?.user?.email ?? "";
    if (authError || !email) {
      skippedMail += 1;
      results.push({ appointmentId: row.appointment_id, notified: true, emailed: false, skipped: "no_email" });
      continue;
    }

    const start = new Date(row.start_time);
    const end = new Date(row.end_time);
    const formattedDate = start.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Berlin",
    });
    const formattedStart = start.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin",
    });
    const formattedEnd = end.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin",
    });
    const title = row.title ?? "Termin";
    const appointmentUrl = `${linkBaseUrl}/calendar?highlight=${row.appointment_id}`;

    const { error: emailError } = await resend.emails.send({
      from: "Terminerinnerung <noreply@alexander-salomon.de>",
      to: [email],
      subject: `Erinnerung: ${title} am ${formattedDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; font-size: 22px;">Erinnerung an Ihren Termin</h1>
          <p style="color: #666; font-size: 16px;">
            <strong>${escapeHtml(title)}</strong><br>
            ${escapeHtml(formattedDate)}, ${escapeHtml(formattedStart)}–${escapeHtml(formattedEnd)} Uhr
            ${row.location ? `<br>${escapeHtml(row.location)}` : ""}
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${appointmentUrl}"
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Termin öffnen
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            Sie erhalten diese Mail ${row.minutes_before} Minuten vor Terminbeginn.
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Appointment reminder email failed", emailError);
      failed += 1;
      results.push({
        appointmentId: row.appointment_id,
        notified: true,
        emailed: false,
        error: String(emailError.message ?? emailError).slice(0, 300),
      });
      continue;
    }

    emailed += 1;
    const { error: markError } = await supabase
      .from("appointment_reminder_dispatches")
      .update({ emailed_at: new Date().toISOString() })
      .eq("appointment_id", row.appointment_id)
      .eq("minutes_before", row.minutes_before);
    if (markError) console.error("Could not mark appointment reminder as emailed", markError);

    results.push({ appointmentId: row.appointment_id, notified: true, emailed: true });
  }

  return jsonResponse({
    claimed,
    notified,
    emailsSent: emailed,
    emailsFailed: failed,
    mailEnabled,
    skippedMail,
    ...(mailEnabled && !resendKey
      ? { error: "APPOINTMENT_REMINDER_EMAIL ist aktiv, aber RESEND_API_KEY fehlt." }
      : {}),
    ...(mailEnabled && !linkBaseUrl
      ? { error: "APPOINTMENT_REMINDER_EMAIL ist aktiv, aber PUBLIC_APP_URL/APP_URL fehlt oder zeigt auf das Supabase-Host." }
      : {}),
    results,
  });
};

serve(withSafeHandler("send-appointment-reminders", handler));
