import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

export const appointmentRequestLifecycleScenario: TestScenario = {
  id: "appointment-request-lifecycle",
  title: "Terminanfragen-Lifecycle (Eingang → Sperre → Entscheidung → Termin)",
  description: "Legt eine Terminanfrage an, prüft dass der Status nicht direkt geändert werden kann, und entscheidet sie über die gesicherte Freigabe. Dabei muss ein Termin entstehen. Die Freigabe klappt nur mit der Rolle Abgeordnete oder Büroleitung.",
  touches: ["appointment_requests", "appointments"],
  features: ["appointment-requests", "appointments"],
  writes: [{ table: "appointment_requests", columns: ["title", "tenant_id", "requested_date", "requested_time", "duration_minutes", "channel", "requester", "location", "notes"] }],
  links: () => [{ label: "Terminanfragen", href: "/calendar" }],
  steps: [
    {
      id: "create", label: "Anfrage anlegen", critical: true,
      run: async (ctx) => {
        const d = new Date(); d.setDate(d.getDate() + 14);
        const payload = { title: `${SELFTEST_PREFIX} Terminanfrage (${ctx.runId})`, tenant_id: ctx.tenantId, requested_date: d.toISOString().slice(0, 10), requested_time: "10:00:00", duration_minutes: 60, channel: "email", requester: SELFTEST_MARKER, location: "Karlsruhe", notes: SELFTEST_MARKER };
        const { data, error } = await supabase.from("appointment_requests").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "appointment_requests", id: data.id });
        ctx.data.requestId = data.id;
        return expectFields("appointment_requests", data.id, { ...payload, status: "pending" }, "Anfrage");
      },
    },
    {
      id: "guard", label: "Direkte Statusänderung wird blockiert",
      run: async (ctx) => {
        const id = ctx.data.requestId as string;
        const { error } = await supabase.from("appointment_requests").update({ status: "accepted" }).eq("id", id);
        const { data } = await supabase.from("appointment_requests").select("status").eq("id", id).single();
        if (data?.status === "pending") return { ok: true, message: `Gesperrt${error ? ` (${error.message})` : ""}.` };
        return { ok: false, message: `Status wurde direkt auf „${data?.status}“ gesetzt — Sperre umgangen!` };
      },
    },
    {
      id: "decide", label: "Über Freigabe-Funktion zusagen → Termin entsteht", critical: false,
      run: async (ctx) => {
        const id = ctx.data.requestId as string;
        const { error } = await supabase.rpc("decide_appointment_request", { _request_id: id, _decision: "accepted" });
        if (error) return { ok: false, message: `${describeError(error)} (Rolle Abgeordnete/Büroleitung nötig)` };
        const { data } = await supabase.from("appointment_requests").select("status, appointment_id, decided_by").eq("id", id).single();
        if (data?.appointment_id) {
          // Termin vor der Anfrage löschen (Fremdschlüssel)
          const idx = ctx.created.findIndex((c) => c.id === id);
          ctx.created.splice(idx, 0, { table: "appointments", id: data.appointment_id });
        }
        if (data?.status !== "accepted" || !data.appointment_id || data.decided_by !== ctx.userId) return { ok: false, message: "Status, Termin oder Entscheider fehlt.", details: data };
        return { ok: true, message: "Zugesagt, Termin angelegt, Entscheider gespeichert." };
      },
    },
  ],
};
