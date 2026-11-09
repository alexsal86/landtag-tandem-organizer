import { canCompleteBriefing, canGoLive, followUpTaskFromLive, mergeLegacy, saveCompact } from "@/features/appointments/briefing/briefingModel";
import { supabase } from "@/integrations/supabase/client";
import { showsInDailyBriefing, canAdvanceBriefing, needsBriefingDecision, suggestBriefingDue } from "@/features/appointments/briefing";
import type { TestScenario } from "../types";
import { SELFTEST_PREFIX } from "../runner";
import { describeError } from "../verify";

const read = async (id: string) => {
  const { data, error } = await supabase.from("appointments").select("briefing_status, briefing_task_id").eq("id", id).single();
  if (error) throw error;
  return data;
};

export const appointmentBriefingLifecycleScenario: TestScenario = {
  id: "appointment-briefing-lifecycle",
  title: "Briefing-Lifecycle (vergeben → Aufgabe → vorlegen → freigeben)",
  description: "Legt einen Termin an, vergibt ein Briefing (es entsteht eine Aufgabe), legt es vor, gibt es frei (Aufgabe erledigt) und prüft „Kein Briefing“.",
  touches: ["appointments", "tasks"],
  features: ["appointments", "tasks"],
  requiredRoles: ["abgeordneter", "bueroleitung"],
  checks: ["Regeln für Freigabe und Fristvorschlag", "Aufgabe entsteht beim Vergeben", "Ball wechselt bei Vorlage", "Freigabe erledigt Aufgabe", "Kein Briefing schließt Aufgabe"],
  limitations: ["Bedienung von Kalender- und Jour-Fixe-Oberfläche wird nicht geprüft."],
  writes: [{ table: "appointments", columns: ["title", "tenant_id", "user_id", "start_time", "end_time"] }],
  links: () => [{ label: "Kalender", href: "/calendar" }],
  steps: [
    {
      id: "rules", label: "Regeln: nur Entscheider geben frei; Frist am Vortag 12:00", kind: "logic",
      run: async () => {
        const due = suggestBriefingDue(new Date(2026, 10, 12, 18), new Date(2026, 10, 1));
        const checks = [
          canAdvanceBriefing("assigned", "submit", { isDecider: false, isAssignee: true }),
          !canAdvanceBriefing("in_review", "approve", { isDecider: false, isAssignee: true }),
          due.getDate() === 11 && due.getHours() === 12,
          showsInDailyBriefing({ briefing_status: "approved", start_time: new Date().toISOString() }),
          !showsInDailyBriefing({ briefing_status: "in_review", start_time: new Date().toISOString() }),
          needsBriefingDecision({ briefing_status: "undecided", start_time: new Date(Date.now() + 86400_000).toISOString() }),
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Regeln bestanden.` };
      },
    },
    {
      id: "model", label: "Regeln: Kurz/Dossier-Umrechnung, Live nur am Termintag, Folgeaufgabe, Abschluss", kind: "logic",
      run: async () => {
        const saved = saveCompact({}, { ...mergeLegacy({}), compact_positions: "Radweg" });
        const today = new Date(); today.setHours(23, 0, 0, 0);
        const checks = [
          Array.isArray(saved.talking_point_items) && (saved.talking_point_items as unknown[]).length === 1,
          mergeLegacy({ objectives: "Ziel" }).compact_goal === "Ziel",
          canGoLive({ briefing_status: "approved", start_time: today.toISOString() }),
          !canGoLive({ briefing_status: "assigned", start_time: today.toISOString() }),
          followUpTaskFromLive("a", { title: " " }) === null,
          canCompleteBriefing("approved", "Ergebnis") && !canCompleteBriefing("approved", ""),
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Regeln bestanden.` };
      },
    },
    {
      id: "create", label: "Termin anlegen (Briefing offen)", critical: true,
      run: async (ctx) => {
        const start = new Date(Date.now() + 5 * 86400_000);
        const id = crypto.randomUUID();
        const { error } = await supabase.from("appointments").insert({ id, title: `${SELFTEST_PREFIX} Briefing-Termin (${ctx.runId})`, tenant_id: ctx.tenantId, user_id: ctx.userId,
          start_time: start.toISOString(), end_time: new Date(start.getTime() + 3600_000).toISOString() });
        if (error) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "appointments", id });
        ctx.data.appointmentId = id;
        const a = await read(id);
        return { ok: a.briefing_status === "undecided", message: `Status: ${a.briefing_status}` };
      },
    },
    {
      id: "assign", label: "Briefing vergeben → Aufgabe entsteht", kind: "workflow", critical: true,
      run: async (ctx) => {
        const id = ctx.data.appointmentId as string;
        const { data: taskId, error } = await supabase.rpc("set_appointment_briefing", { _appointment_id: id, _decision: "assigned", _assignee: ctx.userId, _due: new Date(Date.now() + 86400_000).toISOString(), _instructions: "Selbsttest" });
        if (taskId) ctx.trackRecord({ table: "tasks", id: taskId });
        if (error) return { ok: false, message: describeError(error) };
        ctx.data.taskId = taskId;
        const t = await supabase.from("tasks").select("status, ball_assignee_id, source_type").eq("id", taskId as string).single();
        const a = await read(id);
        const ok = a.briefing_status === "assigned" && t.data?.ball_assignee_id === ctx.userId && t.data?.source_type === "appointment_briefing";
        return { ok, message: ok ? "Aufgabe bei Zuarbeit angelegt." : "Aufgabe/Status unerwartet.", details: { a, t: t.data } };
      },
    },
    {
      id: "submit", label: "Vorlegen → Ball bei Abgeordnete/r", kind: "workflow",
      run: async (ctx) => {
        const { error } = await supabase.rpc("advance_appointment_briefing", { _appointment_id: ctx.data.appointmentId as string, _action: "submit" });
        if (error) return { ok: false, message: describeError(error) };
        const t = await supabase.from("tasks").select("ball_owner").eq("id", ctx.data.taskId as string).single();
        return { ok: t.data?.ball_owner === "deputy", message: `Ball: ${t.data?.ball_owner}` };
      },
    },
    {
      id: "approve", label: "Freigeben → Aufgabe erledigt", kind: "workflow",
      run: async (ctx) => {
        const { error } = await supabase.rpc("advance_appointment_briefing", { _appointment_id: ctx.data.appointmentId as string, _action: "approve" });
        if (error) return { ok: false, message: describeError(error) };
        const t = await supabase.from("tasks").select("status").eq("id", ctx.data.taskId as string).single();
        const a = await read(ctx.data.appointmentId as string);
        return { ok: t.data?.status === "completed" && a.briefing_status === "approved", message: `Aufgabe ${t.data?.status}, Briefing ${a.briefing_status}` };
      },
    },
    {
      id: "none", label: "„Kein Briefing“ setzt Status und löst Aufgabe", kind: "workflow",
      run: async (ctx) => {
        const { error } = await supabase.rpc("set_appointment_briefing", { _appointment_id: ctx.data.appointmentId as string, _decision: "none" });
        if (error) return { ok: false, message: describeError(error) };
        const a = await read(ctx.data.appointmentId as string);
        return { ok: a.briefing_status === "none" && !a.briefing_task_id, message: `Status: ${a.briefing_status}` };
      },
    },
    {
      id: "accept-with-briefing", label: "Zusage im Jour Fixe vergibt Briefing in einem Schritt", kind: "workflow",
      run: async (ctx) => {
        const d = new Date(); d.setDate(d.getDate() + 7);
        const reqId = crypto.randomUUID();
        const ins = await supabase.from("appointment_requests").insert({ id: reqId, title: `${SELFTEST_PREFIX} Briefing-Anfrage (${ctx.runId})`, tenant_id: ctx.tenantId, requested_date: d.toISOString().slice(0, 10), requested_time: "10:00:00", duration_minutes: 60, channel: "email" });
        if (ins.error) return { ok: false, message: describeError(ins.error) };
        ctx.trackRecord({ table: "appointment_requests", id: reqId });
        const { data: apptId, error } = await supabase.rpc("decide_appointment_request", { _request_id: reqId, _decision: "accepted", _briefing: "assigned", _briefing_assignee: ctx.userId, _briefing_due: new Date(Date.now() + 86400_000).toISOString() });
        if (apptId) ctx.trackRecord({ table: "appointments", id: apptId });
        if (error || !apptId) return { ok: false, message: describeError(error) };
        const a = await read(apptId);
        if (a.briefing_task_id) ctx.trackRecord({ table: "tasks", id: a.briefing_task_id });
        return { ok: a.briefing_status === "assigned" && !!a.briefing_task_id, message: `Status ${a.briefing_status}, Aufgabe ${a.briefing_task_id ? "angelegt" : "fehlt"}` };
      },
    },
  ],
};
