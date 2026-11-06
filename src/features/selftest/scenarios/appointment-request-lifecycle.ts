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
  requiredRoles: ["abgeordneter", "bueroleitung"],
  checks: ["Statussperre bei direktem Schreiben", "Zusage über die Anwendungs-RPC", "Verknüpfter Termin", "Wiederholung erzeugt keinen zweiten Termin"],
  limitations: ["Bedienung der Kalenderoberfläche und externe Kalendersynchronisation werden nicht geprüft."],
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
        ctx.trackRecord({ table: "appointment_requests", id: data.id });
        ctx.data.requestId = data.id;
        return expectFields("appointment_requests", data.id, { ...payload, status: "open" }, "Anfrage");
      },
    },
    {
      id: "guard", label: "Direkte Statusänderung wird blockiert",
      run: async (ctx) => {
        const id = ctx.data.requestId as string;
        const { error } = await supabase.from("appointment_requests").update({ status: "accepted" }).eq("id", id);
        const read = await supabase.from("appointment_requests").select("status").eq("id", id).single();
        if (read.error) return { ok: false, message: describeError(read.error) };
        const data = read.data;
        if (error && data?.status === "open") return { ok: true, message: `Gesperrt (${error.message}).` };
        return { ok: false, message: `Status wurde direkt auf „${data?.status}“ gesetzt — Sperre umgangen!` };
      },
    },
    {
      id: "decide", label: "Über Freigabe-Funktion zusagen → Termin entsteht", kind: "workflow",
      run: async (ctx) => {
        const id = ctx.data.requestId as string;
        const { data: appointmentId, error } = await supabase.rpc("decide_appointment_request", { _request_id: id, _decision: "accepted" });
        if (appointmentId) ctx.trackRecord({ table: "appointments", id: appointmentId });
        if (error) return { ok: false, message: `${describeError(error)} (Rolle Abgeordnete/Büroleitung nötig)` };
        const { data, error: readError } = await supabase.from("appointment_requests").select("status, appointment_id, decided_by").eq("id", id).single();
        if (readError) return { ok: false, message: describeError(readError) };
        if (data?.appointment_id) {
          ctx.trackRecord({ table: "appointments", id: data.appointment_id });
          ctx.data.appointmentId = data.appointment_id;
        }
        if (data?.status !== "accepted" || !data.appointment_id || data.decided_by !== ctx.userId) return { ok: false, message: "Status, Termin oder Entscheider fehlt.", details: data };
        return expectFields("appointments", data.appointment_id, { tenant_id: ctx.tenantId, user_id: ctx.userId }, "Erzeugter Termin");
      },
    },
    {
      id: "repeat-decision", label: "Erneute Zusage wird abgewiesen; kein doppelter Termin", kind: "workflow",
      run: async (ctx) => {
        const { error } = await supabase.rpc("decide_appointment_request", { _request_id: ctx.data.requestId as string, _decision: "accepted" });
        if (!error || !/bereits entschieden/.test(error.message)) return { ok: false, message: "Erneute Entscheidung wurde nicht wie erwartet abgewiesen.", details: error };
        const request = await expectFields("appointment_requests", ctx.data.requestId as string, { appointment_id: ctx.data.appointmentId }, "Terminverknüpfung nach Wiederholung");
        if (!request.ok) return request;
        const appointments = await supabase.from("appointments").select("id").eq("tenant_id", ctx.tenantId)
          .eq("title", `${SELFTEST_PREFIX} Terminanfrage (${ctx.runId})`);
        if (appointments.error) return { ok: false, message: describeError(appointments.error) };
        for (const record of appointments.data ?? []) ctx.trackRecord({ table: "appointments", id: record.id });
        return { ok: appointments.data?.length === 1, message: `${appointments.data?.length ?? 0} Termine nach wiederholter Zusage.`, details: { expected: 1, actual: appointments.data?.length } };
      },
    },
  ],
};
