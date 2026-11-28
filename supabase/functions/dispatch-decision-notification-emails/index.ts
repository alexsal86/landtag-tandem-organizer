// Entscheidungs-Meldungen per E-Mail aus der Outbox.
//
// Wird ausschließlich vom Scheduler (pg_cron, Service-Role) aufgerufen. Die
// Datenbank übernimmt fällige Zeilen atomar; dieser Worker prüft die
// Empfänger-Einstellung erneut, holt die Adresse aus auth.users, rendert die
// Meldung und versendet sie über Resend. Erfolg, Übersprung und Fehler werden
// in der Outbox verbucht.
//
// Benötigte Secrets: RESEND_API_KEY sowie eine App-URL
// (PUBLIC_APP_URL / APP_URL / SITE_URL / VITE_PUBLIC_APP_URL).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import {
  forbiddenResponse,
  jsonResponse,
  requireServiceRole,
  withSafeHandler,
} from "../_shared/security.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const MAX_DISPATCHES_PER_RUN = 100;
const FROM_ADDRESS = "Entscheidungs-Meldungen <noreply@alexander-salomon.de>";

interface EmailDispatchRow {
  dispatch_id: string;
  notification_id: string;
  notification_type_id: string;
  tenant_id: string;
  user_id: string;
  type_name: string;
  title: string | null;
  message: string | null;
  priority: string | null;
  decision_id: string | null;
}

const toOrigin = (value: string | null | undefined): string => {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
};

const appBaseUrl = (): string =>
  ["PUBLIC_APP_URL", "APP_URL", "SITE_URL", "VITE_PUBLIC_APP_URL"]
    .map((key) => toOrigin(Deno.env.get(key)))
    .find(Boolean) ?? "";

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const renderHtml = (row: EmailDispatchRow, link: string): string => {
  const title = escapeHtml(row.title ?? "Entscheidungs-Meldung");
  const message = escapeHtml(row.message ?? "").replace(/\r?\n/g, "<br>");
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; font-size: 22px; margin-bottom: 16px;">${title}</h1>
      <p style="color: #444; font-size: 15px; line-height: 1.5;">${message}</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${link}"
           style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Entscheidung öffnen
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">
        Diese E-Mail wurde automatisch versendet, weil Sie E-Mail-Benachrichtigungen für
        diesen Meldungstyp aktiviert haben. Sie können den Versand jederzeit in den
        Benachrichtigungseinstellungen abschalten.
      </p>
    </div>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (!requireServiceRole(req)) {
    return forbiddenResponse("Nur der Scheduler darf Entscheidungs-Meldungen per E-Mail versenden.");
  }

  const baseUrl = appBaseUrl();
  if (!baseUrl) {
    return jsonResponse({
      success: false,
      error: "PUBLIC_APP_URL/APP_URL/SITE_URL fehlt; E-Mail-Versand bleibt aus",
    }, 503);
  }

  const apiKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  if (!apiKey) {
    return jsonResponse({
      success: false,
      error: "RESEND_API_KEY fehlt; E-Mail-Versand bleibt aus",
    }, 503);
  }

  const supabase = createServiceRoleClient();
  const resend = new Resend(apiKey);

  const { data, error } = await supabase.rpc("claim_decision_notification_email_dispatches", {
    _limit: MAX_DISPATCHES_PER_RUN,
  });
  if (error) throw error;

  const rows = (data ?? []) as EmailDispatchRow[];
  const results: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    try {
      // Einstellung erneut prüfen: zwischen Einstellen und Versand kann die
      // Person den Schalter ausgeschaltet haben.
      const { data: settings, error: settingsError } = await supabase
        .from("user_notification_settings")
        .select("email_enabled, is_enabled")
        .eq("user_id", row.user_id)
        .eq("notification_type_id", row.notification_type_id)
        .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      if (!settings || settings.email_enabled !== true || settings.is_enabled !== true) {
        await supabase.rpc("finish_decision_notification_email_dispatch", {
          _dispatch_id: row.dispatch_id,
          _outcome: "skipped",
          _error: "E-Mail im Profil abgeschaltet",
        });
        results.push({ dispatchId: row.dispatch_id, status: "skipped_by_settings" });
        continue;
      }

      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(row.user_id);
      const recipientEmail = authUser?.user?.email ?? "";
      if (authError || !recipientEmail) {
        await supabase.rpc("finish_decision_notification_email_dispatch", {
          _dispatch_id: row.dispatch_id,
          _outcome: "skipped",
          _error: "Keine E-Mail-Adresse",
        });
        results.push({ dispatchId: row.dispatch_id, status: "skipped_no_address" });
        continue;
      }

      const link = row.decision_id
        ? `${baseUrl}/decisions?highlight=${encodeURIComponent(row.decision_id)}`
        : `${baseUrl}/decisions`;

      const { error: sendError } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [recipientEmail],
        subject: row.title ?? "Entscheidungs-Meldung",
        html: renderHtml(row, link),
      });

      if (sendError) {
        throw new Error(sendError.message ?? "Resend-Fehler");
      }

      await supabase.rpc("finish_decision_notification_email_dispatch", {
        _dispatch_id: row.dispatch_id,
        _outcome: "sent",
        _error: null,
      });
      results.push({ dispatchId: row.dispatch_id, status: "sent" });
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : String(dispatchError);
      console.error("Entscheidungs-Meldung per E-Mail fehlgeschlagen:", row.dispatch_id, message);
      await supabase.rpc("finish_decision_notification_email_dispatch", {
        _dispatch_id: row.dispatch_id,
        _outcome: "retry",
        _error: message,
      });
      results.push({ dispatchId: row.dispatch_id, status: "retry", error: message });
    }
  }

  return jsonResponse({
    success: true,
    claimed: rows.length,
    sent: results.filter((entry) => entry.status === "sent").length,
    skipped: results.filter((entry) => String(entry.status).startsWith("skipped")).length,
    retry: results.filter((entry) => entry.status === "retry").length,
    results,
  }, 200);
};

serve(withSafeHandler("dispatch-decision-notification-emails", handler));
