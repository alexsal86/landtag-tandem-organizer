// Entscheidungs-Einladungen aus der Outbox.
//
// Wird ausschließlich vom Scheduler (pg_cron, Service-Role) aufgerufen. Die
// Datenbank übernimmt fällige Zeilen atomar; dieser Worker prüft die
// Empfänger-Einstellung, ruft den bestehenden Renderer send-decision-email im
// internen Modus auf und verbucht Erfolg oder Fehler.
//
// Benötigte Secrets in BEIDEN Functions: DECISION_DISPATCH_SECRET.
// Fehlt es, bleibt der Versand aus und die Zeile wird als Fehler verbucht.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  forbiddenResponse,
  jsonResponse,
  requireServiceRole,
  withSafeHandler,
} from "../_shared/security.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const MAX_DISPATCHES_PER_RUN = 100;

interface DispatchRow {
  dispatch_id: string;
  participant_id: string;
  decision_id: string;
  tenant_id: string;
  user_id: string;
  participant_token: string | null;
  decision_title: string | null;
  decision_description: string | null;
  task_title: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (!requireServiceRole(req)) {
    return forbiddenResponse("Nur der Scheduler darf Entscheidungs-Einladungen versenden.");
  }

  // Optional: Ist das Secret gesetzt, wird es mitgeschickt und vom Renderer
  // verlangt. Fehlt es, bleibt der Versand über die Service-Role nutzbar, statt
  // alle Einladungen stillzulegen.
  const dispatchSecret = (Deno.env.get("DECISION_DISPATCH_SECRET") ?? "").trim();

  const toOrigin = (value: string | null | undefined): string => {
    if (!value) return "";
    try {
      return new URL(value).origin;
    } catch {
      return "";
    }
  };
  const appBaseUrl = ["PUBLIC_APP_URL", "APP_URL", "SITE_URL", "VITE_PUBLIC_APP_URL"]
    .map((key) => toOrigin(Deno.env.get(key)))
    .find(Boolean) ?? "";

  if (!appBaseUrl) {
    // Ohne gültige App-URL würden die Antwortlinks ins Leere zeigen. Die Zeilen
    // bleiben pending und werden beim nächsten Lauf erneut versucht.
    return jsonResponse({
      success: false,
      error: "PUBLIC_APP_URL/APP_URL/SITE_URL fehlt; Einladungen bleiben pending",
    }, 503);
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc("claim_decision_invitation_dispatches", {
    _limit: MAX_DISPATCHES_PER_RUN,
  });
  if (error) throw error;

  const rows = (data ?? []) as DispatchRow[];
  const results: Array<Record<string, unknown>> = [];
  const functionUrl = `${(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "")}/functions/v1/send-decision-email`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  for (const row of rows) {
    try {
      if (!row.participant_token) {
        throw new Error("Teilnehmer-Token fehlt");
      }

      // Wer die Entscheidungsanfrage in den eigenen Einstellungen abgeschaltet
      // hat, bekommt keine Mail; die In-App-Meldung respektiert dieselbe Grenze.
      const { data: settings, error: settingsError } = await supabase
        .from("user_notification_settings")
        .select("is_enabled, notification_types!inner(name)")
        .eq("user_id", row.user_id)
        .eq("notification_types.name", "task_decision_request")
        .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      if (settings && settings.is_enabled === false) {
        await supabase.rpc("finish_decision_invitation_dispatch", {
          _dispatch_id: row.dispatch_id,
          _success: true,
          _error: "Vom Empfänger abgeschaltet",
        });
        results.push({ dispatchId: row.dispatch_id, status: "skipped_by_settings" });
        continue;
      }

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          ...(dispatchSecret ? { "x-decision-dispatch-secret": dispatchSecret } : {}),
        },
        body: JSON.stringify({
          decisionId: row.decision_id,
          participantIds: [row.user_id],
          tenant_id: row.tenant_id,
          app_base_url: appBaseUrl,
        }),
      });

      const payload = await response.json().catch(() => null) as
        | { results?: Array<{ success?: boolean; error?: string }>; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || `send-decision-email antwortete ${response.status}`);
      }

      const first = payload?.results?.[0];
      if (!first?.success) {
        throw new Error(first?.error || "E-Mail wurde nicht versendet");
      }

      await supabase.rpc("finish_decision_invitation_dispatch", {
        _dispatch_id: row.dispatch_id,
        _success: true,
        _error: null,
      });
      results.push({ dispatchId: row.dispatch_id, status: "sent" });
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : String(dispatchError);
      console.error("Entscheidungs-Einladung fehlgeschlagen:", row.dispatch_id, message);
      await supabase.rpc("finish_decision_invitation_dispatch", {
        _dispatch_id: row.dispatch_id,
        _success: false,
        _error: message,
      });
      results.push({ dispatchId: row.dispatch_id, status: "failed", error: message });
    }
  }

  return jsonResponse({
    success: true,
    claimed: rows.length,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  }, 200);
};

serve(withSafeHandler("dispatch-decision-invitations", handler));
