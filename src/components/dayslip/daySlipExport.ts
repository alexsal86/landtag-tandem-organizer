import { supabase } from "@/integrations/supabase/client";
import { exportId } from "./daySlipState";
import type { DaySlipSource, TaskOptions } from "./dayslipTypes";

export type ExportTarget = "note" | "task" | "decision";

export const isExportTarget = (target: string): target is ExportTarget =>
  target === "note" || target === "task" || target === "decision";

export type ExportTargetInput = {
  userId: string;
  tenantId: string;
  dayKey: string;
  lineId: string;
  text: string;
  target: ExportTarget;
  taskOptions?: TaskOptions;
  entityId?: string;
  /** A linked source of the same type is already the destination, not a new record to duplicate. */
  existingSource?: DaySlipSource;
};

/**
 * Creates the destination for one day-slip line, or returns the existing one.
 * The primary key is derived from account, day, line and target, so a retry after a lost
 * response finds the committed record instead of creating a second one.
 */
export async function createExportTarget(input: ExportTargetInput): Promise<string> {
  const { userId, tenantId, dayKey, lineId, text, target, taskOptions, existingSource } = input;
  if (existingSource?.type === target) return existingSource.id;
  const id = input.entityId ?? await exportId(userId, dayKey, lineId, target);
  const find = () => target === "task"
    ? supabase.from("tasks").select("id").eq("id", id).eq("user_id", userId).maybeSingle()
    : target === "note"
      ? supabase.from("quick_notes").select("id").eq("id", id).eq("user_id", userId).maybeSingle()
      : supabase.from("task_decisions").select("id").eq("id", id).eq("created_by", userId).maybeSingle();
  const found = await find();
  if (found.error) throw found.error;
  if (found.data) return id;
  const title = text.replace(/^!{1,2}\s*/, "").trim();
  if (!title) throw new Error("Der Eintrag benötigt einen Titel.");
  const description = `Aus Tageszettel (${dayKey})`;
  const response = target === "note"
    ? await supabase.from("quick_notes").insert({ id, user_id: userId, tenant_id: tenantId, title, content: description })
    : target === "task"
      ? await supabase.from("tasks").insert({ id, user_id: userId, tenant_id: tenantId, title, description, status: "todo", priority: text.startsWith("!!") ? "high" : "medium", category: "allgemein", assigned_to: taskOptions?.assignedTo || userId, due_date: taskOptions?.dueDate ? new Date(`${taskOptions.dueDate}T12:00:00`).toISOString() : null })
      : await supabase.from("task_decisions").insert({ id, created_by: userId, tenant_id: tenantId, title, description, status: "open" });
  if (response.error) {
    // Concurrent creation or a response lost on a previous attempt: verify the exact destination.
    if (response.error.code !== "23505") throw response.error;
    const concurrent = await find();
    if (concurrent.error || !concurrent.data) throw response.error;
  }
  return id;
}
