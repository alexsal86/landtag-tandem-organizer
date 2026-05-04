import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";

export const taskLifecycleScenario: TestScenario = {
  id: "task-lifecycle",
  title: "Aufgaben-Lifecycle",
  description: "Erstellt eine Aufgabe, ändert den Status mehrfach, verifiziert und löscht sie.",
  steps: [
    {
      id: "create",
      label: "Aufgabe anlegen",
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            title: `${SELFTEST_PREFIX} Aufgabe (${ctx.runId})`,
            description: SELFTEST_MARKER,
            status: "todo",
            priority: "high",
            user_id: ctx.userId,
            tenant_id: ctx.tenantId,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Kein Ergebnis" };
        ctx.created.push({ table: "tasks", id: data.id });
        ctx.data.taskId = data.id;
        return { ok: true, message: `Aufgabe ${data.id} angelegt.` };
      },
    },
    {
      id: "in-progress",
      label: "Status → in_progress",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const { error } = await supabase.from("tasks").update({ status: "in_progress" }).eq("id", id);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "OK" };
      },
    },
    {
      id: "complete",
      label: "Status → completed",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
        if (error) return { ok: false, message: error.message };
        const { data } = await supabase.from("tasks").select("status").eq("id", id).single();
        return { ok: data?.status === "completed", message: `Status: ${data?.status}` };
      },
    },
  ],
};
