import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';
import { getTaskAssigneeIds } from "@/lib/taskAssignees";

export interface MyWorkTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  user_id: string;
  created_at: string;
  category?: string;
  meeting_id?: string | null;
  pending_for_jour_fixe?: boolean | null;
  parent_task_id?: string | null;
  tenant_id?: string;
  task_assignees?: Array<{ user_id: string }> | null;
}

const TASK_LIST_SELECT = "id, title, description, priority, status, due_date, assigned_to, user_id, created_at, category, meeting_id, pending_for_jour_fixe, parent_task_id, tenant_id, task_assignees!left(user_id)";
const TASK_ASSIGNED_SELECT = "id, title, description, priority, status, due_date, assigned_to, user_id, created_at, category, meeting_id, pending_for_jour_fixe, parent_task_id, tenant_id, task_assignees!inner(user_id)";

interface TasksQueryResult {
  assignedTasks: MyWorkTask[];
  createdTasks: MyWorkTask[];
  subtasks: Record<string, MyWorkTask[]>;
  taskSnoozes: Record<string, string>;
  taskCommentCounts: Record<string, number>;
}

const TASKS_QUERY_KEY = (userId?: string) => ['my-work-tasks', userId] as const;

const isTaskVisibleInDataset = (taskId: string, data?: TasksQueryResult) => {
  if (!data) return false;
  if (data.createdTasks.some((task) => task.id === taskId)) return true;
  if (data.assignedTasks.some((task) => task.id === taskId)) return true;
  return Object.values(data.subtasks).some((children) => children.some((task) => task.id === taskId));
};

const getVisibleTaskIds = (data?: TasksQueryResult): Set<string> => {
  if (!data) return new Set();
  const ids = new Set<string>();
  data.createdTasks.forEach((task) => ids.add(task.id));
  data.assignedTasks.forEach((task) => ids.add(task.id));
  Object.values(data.subtasks).forEach((children) => children.forEach((task) => ids.add(task.id)));
  return ids;
};

const fetchTasks = async (userId: string, tenantId?: string): Promise<TasksQueryResult> => {
  const withTenantFilter = <T extends { eq: (column: string, value: string) => T }>(query: T) =>
    (tenantId ? query.eq("tenant_id", tenantId) : query);

  const [assignedResult, legacyAssignedResult, createdResult] = await Promise.all([
    withTenantFilter(supabase.from("tasks").select(TASK_ASSIGNED_SELECT))
      .eq("task_assignees.user_id", userId)
      .neq("status", "completed")
      .is("parent_task_id", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
    withTenantFilter(supabase.from("tasks").select(TASK_LIST_SELECT))
      .or(`assigned_to.eq.${userId},assigned_to.ilike.%${userId}%`)
      .neq("status", "completed")
      .is("parent_task_id", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
    withTenantFilter(supabase.from("tasks").select(TASK_LIST_SELECT))
      .eq("user_id", userId)
      .neq("status", "completed")
      .is("parent_task_id", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  if (assignedResult.error) throw assignedResult.error;
  if (legacyAssignedResult.error) throw legacyAssignedResult.error;
  if (createdResult.error) throw createdResult.error;

  const allAssigned = [...(assignedResult.data || []), ...(legacyAssignedResult.data || [])]
    .filter((task, index, arr) => arr.findIndex((candidate) => candidate.id === task.id) === index);
  const allCreated = createdResult.data || [];

  const createdByMe = allCreated.filter(
    (task: Record<string, any>) => !(task.category === "meeting" && getTaskAssigneeIds(task).includes(userId))
  );

  const meetingTasksAssignedToMe = allCreated.filter(
    (task: Record<string, any>) => task.category === "meeting" && getTaskAssigneeIds(task).includes(userId)
  );

  const assignedByOthers = [
    ...allAssigned.filter((task) => task.user_id !== userId),
    ...meetingTasksAssignedToMe,
  ];

  const allTaskIds = [...new Set([...createdByMe, ...assignedByOthers].map((task) => task.id))];
  if (allTaskIds.length === 0) {
    return { assignedTasks: assignedByOthers, createdTasks: createdByMe, subtasks: {}, taskSnoozes: {}, taskCommentCounts: {} };
  }

  const [snoozesSettled, commentsSettled] = await Promise.allSettled([
    supabase.from("task_snoozes").select("task_id, snoozed_until").eq("user_id", userId),
    supabase.from("task_comments").select("task_id").in("task_id", allTaskIds),
  ]);

  const snoozesData = snoozesSettled.status === 'fulfilled' && !snoozesSettled.value.error ? snoozesSettled.value.data || [] : [];
  const commentsData = commentsSettled.status === 'fulfilled' && !commentsSettled.value.error ? commentsSettled.value.data || [] : [];

  const allSubtasksData: MyWorkTask[] = [];
  const subtaskBatchSize = 150;
  const queuedParentIds = [...allTaskIds];
  const seenParentIds = new Set<string>();

  while (queuedParentIds.length > 0) {
    const batchParentIds = queuedParentIds.splice(0, subtaskBatchSize).filter((id) => !seenParentIds.has(id));
    if (batchParentIds.length === 0) continue;
    batchParentIds.forEach((id) => seenParentIds.add(id));

    let subtaskQuery = supabase
      .from("tasks")
      .select(TASK_LIST_SELECT)
      .in("parent_task_id", batchParentIds)
      .neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false });

    if (tenantId) {
      subtaskQuery = subtaskQuery.eq("tenant_id", tenantId);
    }

    const { data: subtaskData, error: subtaskError } = await subtaskQuery;
    if (subtaskError) {
      debugConsole.warn("Failed to load subtasks batch", subtaskError);
      continue;
    }

    (subtaskData || []).forEach((subtask: MyWorkTask) => {
      allSubtasksData.push(subtask);
      if (subtask.id && !seenParentIds.has(subtask.id)) queuedParentIds.push(subtask.id);
    });
  }

  // Build subtask tree
  const childrenByParent = new Map<string, MyWorkTask[]>();
  allSubtasksData.forEach((task) => {
    if (!task.parent_task_id) return;
    const siblings = childrenByParent.get(task.parent_task_id) || [];
    siblings.push(task);
    childrenByParent.set(task.parent_task_id, siblings);
  });

  const grouped: Record<string, MyWorkTask[]> = {};
  const queue = [...allTaskIds];
  const visited = new Set<string>();
  const visibleTaskIds = new Set<string>(allTaskIds);
  while (queue.length > 0) {
    const parentId = queue.shift();
    if (!parentId || visited.has(parentId)) continue;
    visited.add(parentId);
    const children = childrenByParent.get(parentId) || [];
    if (children.length > 0) {
      grouped[parentId] = children;
      children.forEach((childTask) => {
        visibleTaskIds.add(childTask.id);
        if (!visited.has(childTask.id)) queue.push(childTask.id);
      });
    }
  }

  const snoozeMap: Record<string, string> = {};
  snoozesData.forEach((snooze: Record<string, any>) => {
    if (snooze.task_id) snoozeMap[snooze.task_id] = snooze.snoozed_until;
  });

  const commentCounts: Record<string, number> = {};
  commentsData.forEach((comment: Record<string, any>) => {
    if (!comment.task_id || !visibleTaskIds.has(comment.task_id)) return;
    commentCounts[comment.task_id] = (commentCounts[comment.task_id] || 0) + 1;
  });

  return {
    assignedTasks: assignedByOthers,
    createdTasks: createdByMe,
    subtasks: grouped,
    taskSnoozes: snoozeMap,
    taskCommentCounts: commentCounts,
  };
};

export function useMyWorkTasksData(userId?: string, tenantId?: string) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: TASKS_QUERY_KEY(userId),
    queryFn: () => fetchTasks(userId!, tenantId),
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const assignedTasks = data?.assignedTasks ?? [];
  const createdTasks = data?.createdTasks ?? [];
  const subtasks = data?.subtasks ?? {};
  const taskSnoozes = data?.taskSnoozes ?? {};
  const taskCommentCounts = data?.taskCommentCounts ?? {};

  // Provide setters for optimistic UI updates — support both direct values and functional updaters
  const [localOverrides, setLocalOverrides] = useState<Partial<TasksQueryResult>>({});
  const effectiveAssigned = localOverrides.assignedTasks ?? assignedTasks;
  const effectiveCreated = localOverrides.createdTasks ?? createdTasks;
  const effectiveSubtasks = localOverrides.subtasks ?? subtasks;
  const effectiveSnoozes = localOverrides.taskSnoozes ?? taskSnoozes;
  const effectiveComments = localOverrides.taskCommentCounts ?? taskCommentCounts;

  // Reset overrides when query data changes
  useEffect(() => {
    setLocalOverrides({});
  }, [data]);

  const loadTasks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY(userId) });
  }, [queryClient, userId]);

  type SetterArg<T> = T | ((prev: T) => T);
  const resolveArg = <T,>(arg: SetterArg<T>, prev: T): T => (typeof arg === 'function' ? (arg as (prev: T) => T)(prev) : arg);

  // Realtime: tasks subscription needs to be broad (cross-user assignments)
  // but we filter task_snoozes by user_id
  useEffect(() => {
    if (!userId) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY(userId) });
      }, 300);
    };

    const getCurrentData = () => queryClient.getQueryData<TasksQueryResult>(TASKS_QUERY_KEY(userId));
    const updateData = (updater: (prev: TasksQueryResult) => TasksQueryResult) => {
      queryClient.setQueryData<TasksQueryResult>(TASKS_QUERY_KEY(userId), (prev) => (prev ? updater(prev) : prev));
    };

    const handleTaskSnoozeChange = (payload: { eventType: string; old: Record<string, unknown> | null; new: Record<string, unknown> | null }) => {
      const row = (payload.new ?? payload.old) as { task_id?: string | null; user_id?: string | null; snoozed_until?: string | null } | null;
      const taskId = row?.task_id ?? null;
      if (!taskId || row?.user_id !== userId) return;

      const currentData = getCurrentData();
      if (!isTaskVisibleInDataset(taskId, currentData)) return;

      updateData((prev) => {
        const next = { ...prev, taskSnoozes: { ...prev.taskSnoozes } };
        if (payload.eventType === "DELETE") {
          delete next.taskSnoozes[taskId];
        } else if (row.snoozed_until) {
          next.taskSnoozes[taskId] = row.snoozed_until;
        } else {
          delete next.taskSnoozes[taskId];
        }
        return next;
      });
    };

    const handleTaskCommentChange = (payload: { eventType: string; old: Record<string, unknown> | null; new: Record<string, unknown> | null }) => {
      const row = (payload.new ?? payload.old) as { task_id?: string | null } | null;
      const taskId = row?.task_id ?? null;
      if (!taskId) return;

      const currentData = getCurrentData();
      const visibleTaskIds = getVisibleTaskIds(currentData);
      if (!visibleTaskIds.has(taskId)) return;

      updateData((prev) => {
        const currentCount = prev.taskCommentCounts[taskId] || 0;
        const delta = payload.eventType === "DELETE" ? -1 : 1;
        return {
          ...prev,
          taskCommentCounts: {
            ...prev.taskCommentCounts,
            [taskId]: Math.max(0, currentCount + delta),
          },
        };
      });
    };

    const handleTaskChange = (payload: { eventType: string; old: Record<string, unknown> | null; new: Record<string, unknown> | null }) => {
      const nextRow = payload.new as Partial<MyWorkTask> | null;
      const oldRow = payload.old as Partial<MyWorkTask> | null;
      const changedTaskId = nextRow?.id ?? oldRow?.id;
      if (!changedTaskId) return;

      const currentData = getCurrentData();
      const isKnownTask = isTaskVisibleInDataset(changedTaskId, currentData);
      const maybeMineByAuthor = (nextRow?.user_id ?? oldRow?.user_id) === userId;
      const maybeMineByLegacyAssignee = String(nextRow?.assigned_to ?? oldRow?.assigned_to ?? "").includes(userId);

      if (!isKnownTask && !maybeMineByAuthor && !maybeMineByLegacyAssignee) return;

      if (!isKnownTask || payload.eventType === "INSERT" || payload.eventType === "DELETE") {
        scheduleRefresh();
        return;
      }

      const becameCompleted = (nextRow?.status ?? oldRow?.status) === "completed";
      const movedBetweenParent = (nextRow?.parent_task_id ?? null) !== (oldRow?.parent_task_id ?? null);
      if (becameCompleted || movedBetweenParent) {
        scheduleRefresh();
        return;
      }

      updateData((prev) => {
        const patch = (task: MyWorkTask) => (task.id === changedTaskId ? { ...task, ...nextRow } : task);
        const nextCreated = prev.createdTasks.map(patch);
        const nextAssigned = prev.assignedTasks.map(patch);
        const nextSubtasks = Object.fromEntries(
          Object.entries(prev.subtasks).map(([parentId, children]) => [parentId, children.map(patch)])
        );
        return { ...prev, createdTasks: nextCreated, assignedTasks: nextAssigned, subtasks: nextSubtasks };
      });
    };

    const handleTaskAssigneeChange = (payload: { old: Record<string, unknown> | null; new: Record<string, unknown> | null }) => {
      const row = (payload.new ?? payload.old) as { task_id?: string | null; user_id?: string | null } | null;
      const taskId = row?.task_id ?? null;
      if (!taskId) return;

      const currentData = getCurrentData();
      const relevantForCurrentUser = row?.user_id === userId;
      const relevantForVisibleTask = isTaskVisibleInDataset(taskId, currentData);
      if (!relevantForCurrentUser && !relevantForVisibleTask) return;

      scheduleRefresh();
    };

    const channel = supabase
      .channel(`my-work-tasks-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {}) },
        handleTaskChange
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees", filter: `user_id=eq.${userId}` }, handleTaskAssigneeChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_snoozes", filter: `user_id=eq.${userId}` }, handleTaskSnoozeChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, handleTaskCommentChange)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [userId, tenantId, queryClient]);

  return {
    assignedTasks: effectiveAssigned,
    setAssignedTasks: (val: SetterArg<MyWorkTask[]>) => setLocalOverrides(prev => ({ ...prev, assignedTasks: resolveArg(val, prev.assignedTasks ?? assignedTasks) })),
    createdTasks: effectiveCreated,
    setCreatedTasks: (val: SetterArg<MyWorkTask[]>) => setLocalOverrides(prev => ({ ...prev, createdTasks: resolveArg(val, prev.createdTasks ?? createdTasks) })),
    subtasks: effectiveSubtasks,
    setSubtasks: (val: SetterArg<Record<string, MyWorkTask[]>>) => setLocalOverrides(prev => ({ ...prev, subtasks: resolveArg(val, prev.subtasks ?? subtasks) })),
    taskSnoozes: effectiveSnoozes,
    setTaskSnoozes: (val: SetterArg<Record<string, string>>) => setLocalOverrides(prev => ({ ...prev, taskSnoozes: resolveArg(val, prev.taskSnoozes ?? taskSnoozes) })),
    taskCommentCounts: effectiveComments,
    setTaskCommentCounts: (val: SetterArg<Record<string, number>>) => setLocalOverrides(prev => ({ ...prev, taskCommentCounts: resolveArg(val, prev.taskCommentCounts ?? taskCommentCounts) })),
    data: { assignedTasks: effectiveAssigned, createdTasks: effectiveCreated, subtasks: effectiveSubtasks, taskSnoozes: effectiveSnoozes, taskCommentCounts: effectiveComments },
    isLoading,
    loading: isLoading,
    error: null,
    refetch: loadTasks,
    loadTasks,
  };
}
