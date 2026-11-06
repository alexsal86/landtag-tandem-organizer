import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const dueIn = (d: number) => { const n = new Date(); n.setDate(n.getDate() + d); return n.toISOString(); };

export const taskLifecycleScenario: TestScenario = {
  id: "task-lifecycle",
  title: "Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt)",
  description: "Legt eine Aufgabe an, weist sie zu, setzt eine Frist, erstellt daraus eine Entscheidung, markiert sie für den Jour fixe und schließt sie ab.",
  touches: ["tasks", "task_decisions"],
  features: ["tasks", "decisions"],
  writes: [
    { table: "tasks", columns: ["title", "description", "status", "priority", "user_id", "tenant_id", "assigned_to", "due_date", "progress", "pending_for_jour_fixe"] },
    { table: "task_decisions", columns: ["title", "description", "status", "created_by", "tenant_id", "task_id"] },
  ],
  steps: [
    {
      id: "create", label: "Aufgabe anlegen", critical: true,
      run: async (ctx) => {
        const payload = { title: `${SELFTEST_PREFIX} Aufgabe (${ctx.runId})`, description: SELFTEST_MARKER, status: "todo", priority: "high", user_id: ctx.userId, tenant_id: ctx.tenantId };
        const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "tasks", id: data.id });
        ctx.data.taskId = data.id;
        return expectFields("tasks", data.id, payload, "Aufgabe");
      },
    },
    {
      id: "assign", label: "Zuweisen (mehrere Personen, CSV) + Frist",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const update = { assigned_to: `${ctx.userId},${ctx.userId}`, due_date: dueIn(5), status: "in_progress", progress: 30 };
        const { error } = await supabase.from("tasks").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("tasks", id, update, "Zuweisung");
      },
    },
    {
      id: "decision", label: "Entscheidung aus Aufgabe erstellen",
      run: async (ctx) => {
        const payload = { title: `${SELFTEST_PREFIX} Aufgaben-Entscheidung (${ctx.runId})`, description: SELFTEST_MARKER, status: "active", created_by: ctx.userId, tenant_id: ctx.tenantId, task_id: ctx.data.taskId as string, visible_to_all: false };
        const { data, error } = await supabase.from("task_decisions").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "task_decisions", id: data.id });
        return expectFields("task_decisions", data.id, payload, "Entscheidung");
      },
    },
    {
      id: "jour-fixe", label: "Für Jour fixe markieren",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const { error } = await supabase.from("tasks").update({ pending_for_jour_fixe: true }).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("tasks", id, { pending_for_jour_fixe: true }, "Jour fixe");
      },
    },
    {
      id: "complete", label: "Status → completed",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const { error } = await supabase.from("tasks").update({ status: "completed", progress: 100 }).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("tasks", id, { status: "completed", progress: 100 }, "completed");
      },
    },
  ],
};
