import { supabase } from "@/integrations/supabase/client";

type AssigneeSource = string | string[] | null | undefined;

export const normalizeTaskAssigneeIds = (assignedTo: AssigneeSource): string[] => {
  if (!assignedTo) return [];

  const rawValues = Array.isArray(assignedTo)
    ? assignedTo
    : assignedTo.replace(/[{}]/g, "").split(",");

  return Array.from(
    new Set(
      rawValues
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
};

export const serializeLegacyTaskAssignees = (assigneeIds: string[]): string | null => {
  if (assigneeIds.length === 0) return null;
  if (assigneeIds.length === 1) return assigneeIds[0];
  return `{${assigneeIds.join(",")}}`;
};

export const getTaskAssigneeIds = (task: {
  assigned_to?: string | null;
  task_assignees?: Array<{ user_id: string }> | null;
}): string[] => {
  const joinedIds = (task.task_assignees ?? []).map((entry) => entry.user_id).filter(Boolean);
  if (joinedIds.length > 0) return Array.from(new Set(joinedIds));
  return normalizeTaskAssigneeIds(task.assigned_to);
};

export const syncTaskAssignees = async ({
  taskId,
  assigneeIds,
  assignedBy,
}: {
  taskId: string;
  assigneeIds: string[];
  assignedBy?: string | null;
}) => {
  const normalized = Array.from(new Set(assigneeIds.filter(Boolean)));

  if (normalized.length === 0) {
    const { error: deleteAllError } = await supabase
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId);
    if (deleteAllError) throw deleteAllError;

    const { error: clearError } = await supabase
      .from("tasks")
      .update({ assigned_to: null })
      .eq("id", taskId);
    if (clearError) throw clearError;
    return;
  }

  const { error: deleteRemovedError } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId)
    .not("user_id", "in", `(${normalized.join(",")})`);

  if (deleteRemovedError) throw deleteRemovedError;

  const { error: insertError } = await supabase
    .from("task_assignees")
    .upsert(
      normalized.map((userId) => ({
        task_id: taskId,
        user_id: userId,
        assigned_by: assignedBy ?? null,
      })),
      { onConflict: "task_id,user_id" }
    );

  if (insertError) throw insertError;

  const { error: legacyError } = await supabase
    .from("tasks")
    .update({ assigned_to: serializeLegacyTaskAssignees(normalized) })
    .eq("id", taskId);

  if (legacyError) throw legacyError;
};
