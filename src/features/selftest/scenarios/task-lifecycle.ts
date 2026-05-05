import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

export const taskLifecycleScenario: TestScenario = {
  id: "task-lifecycle",
  title: "Aufgaben-Lifecycle",
  description: "Erstellt eine Aufgabe, ändert den Status mehrfach und liest jedes geschriebene Feld zurück.",
  touches: ["tasks"],
  features: ["tasks"],
  writes: [
    { table: "tasks", columns: ["title", "description", "status", "priority", "user_id", "tenant_id"] },
  ],
  steps: [
    {
      id: "create",
      label: "Aufgabe anlegen",
      run: async (ctx) => {
        const payload = {
          title: `${SELFTEST_PREFIX} Aufgabe (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "todo",
          priority: "high",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
        };
        const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "tasks", id: data.id });
        ctx.data.taskId = data.id;
        return expectFields("tasks", data.id, payload, "Aufgabe");
      },
    },
    {
      id: "in-progress",
      label: "Status → in_progress",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const { error } = await supabase.from("tasks").update({ status: "in_progress" }).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("tasks", id, { status: "in_progress" }, "in_progress");
      },
    },
    {
      id: "complete",
      label: "Status → completed",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("tasks", id, { status: "completed" }, "completed");
      },
    },
  ],
};
