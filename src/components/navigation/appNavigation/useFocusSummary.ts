import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { getTaskAssigneeIds } from "@/lib/taskAssignees";
import { taskZone, type StafetteTask } from "@/features/tasks/stafette";
import { isPersonalCaseAction, type TriageItem } from "@/features/cases/items/ball";
import { useSignatureFolderQuery } from "@/components/my-work/signatureFolderData";

export type FocusTask = StafetteTask & {
  id: string;
  category: string | null;
  assigned_to: string | null;
  source_id?: string | null;
  source_type?: string | null;
  task_assignees?: { user_id: string }[] | null;
};

type FocusCase = TriageItem & { id: string; status: string };

export function countFocusActions(tasks: FocusTask[], cases: FocusCase[], userId: string, now = new Date()) {
  const actionable = tasks.filter(task => {
    if (task.status === "completed" || task.ball_owner === "external" ||
      task.category === "call_follow_up" || task.category === "call_followup") return false;
    const assigned = task.ball_assignee_id
      ? task.ball_assignee_id === userId
      : getTaskAssigneeIds(task).includes(userId);
    if (!assigned) return false;
    const zone = taskZone(task, userId, now);
    return zone === "mine" || zone === "nudged";
  });
  const casesWithTask = new Set(actionable.filter(task => task.source_type === "case_step").map(task => task.source_id));
  return {
    taskCount: new Set(actionable.map(task => task.id)).size,
    caseCount: cases.filter(item => !casesWithTask.has(item.id) && isPersonalCaseAction(item, userId, now)).length,
  };
}

export function useFocusSummary(enabled: boolean, canUseSignatureFolder: boolean, canUseCases: boolean) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const userId = user?.id;
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const approvals = useSignatureFolderQuery(tenantId, userId, enabled && canUseSignatureFolder);

  // Only personal assignments, plus the legacy assignment field and explicit ball ownership.
  // This avoids loading workflow details, comments and team tasks for a navigation badge.
  const tasks = useQuery({
    queryKey: ["sidebar-personal-tasks", tenantId, userId],
    enabled: enabled && !!tenantId && !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const columns = "id, category, status, assigned_to, user_id, ball_owner, ball_assignee_id, stafette_resume_on, reminder_at, nudged_by, nudge_seen_at, source_id, source_type";
      const [relation, direct] = await Promise.all([
        supabase.from("tasks").select(`${columns}, task_assignees!inner(user_id)`)
          .eq("tenant_id", tenantId!).eq("task_assignees.user_id", userId!).neq("status", "completed"),
        supabase.from("tasks").select(`${columns}, task_assignees(user_id)`)
          .eq("tenant_id", tenantId!).or(`ball_assignee_id.eq.${userId},assigned_to.ilike.%${userId}%`).neq("status", "completed"),
      ]);
      if (relation.error) throw relation.error;
      if (direct.error) throw direct.error;
      return [...relation.data, ...direct.data];
    },
  });

  const cases = useQuery({
    queryKey: ["sidebar-personal-cases", tenantId, userId],
    enabled: enabled && canUseCases && !!tenantId && !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("case_items")
        .select("id, status, ball_owner, next_action_assignee_id, owner_user_id, next_action_label, next_action_due_at")
        .eq("tenant_id", tenantId!).eq("ball_owner", "office").not("status", "in", "(erledigt,archiviert)")
        .or(`next_action_assignee_id.eq.${userId},and(next_action_assignee_id.is.null,owner_user_id.eq.${userId})`);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!enabled || !tenantId || !userId) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["sidebar-personal-tasks", tenantId, userId] });
    const channel = supabase.channel(`sidebar-personal-tasks:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `tenant_id=eq.${tenantId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees", filter: `user_id=eq.${userId}` }, refresh);
    if (canUseCases) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "case_items", filter: `tenant_id=eq.${tenantId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["sidebar-personal-cases", tenantId, userId] }));
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [enabled, queryClient, tenantId, userId, canUseCases]);

  return {
    approvalCount: canUseSignatureFolder && !approvals.isError ? approvals.data?.length ?? 0 : 0,
    ...countFocusActions(tasks.isError ? [] : tasks.data ?? [], !canUseCases || cases.isError ? [] : cases.data ?? [], userId ?? ""),
  };
}
