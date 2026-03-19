import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';

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
}

const TASK_LIST_SELECT = "id, title, description, priority, status, due_date, assigned_to, user_id, created_at, category, meeting_id, pending_for_jour_fixe, parent_task_id, tenant_id";

const normalizeAssignedTo = (assignedTo: string | null | undefined) => {
  if (!assignedTo) return [];
  return assignedTo
    .replace(/[{}]/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

interface TasksQueryResult {
  assignedTasks: MyWorkTask[];
  createdTasks: MyWorkTask[];
  subtasks: Record<string, MyWorkTask[]>;
  taskSnoozes: Record<string, string>;
  taskCommentCounts: Record<string, number>;
}

const fetchTasks = async (userId: string): Promise<TasksQueryResult> => {
  const [assignedResult, createdResult] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_LIST_SELECT)
      .or(`assigned_to.eq.${userId},assigned_to.ilike.%${userId}%`)
      .neq("status", "completed")
      .is("parent_task_id", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("tasks")
      .select(TASK_LIST_SELECT)
      .eq("user_id", userId)
      .neq("status", "completed")
      .is("parent_task_id", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  if (assignedResult.error) throw assignedResult.error;
  if (createdResult.error) throw createdResult.error;

  const allAssigned = assignedResult.data || [];
  const allCreated = createdResult.data || [];

  const createdByMe = allCreated.filter(
    (task) => !(task.category === "meeting" && normalizeAssignedTo(task.assigned_to).includes(userId))
  );

  const meetingTasksAssignedToMe = allCreated.filter(
    (task) => task.category === "meeting" && normalizeAssignedTo(task.assigned_to).includes(userId)
  );

  const assignedByOthers = [
    ...allAssigned.filter((task) => task.user_id !== userId),
    ...meetingTasksAssignedToMe,
  ];

  const allTaskIds = [...new Set([...createdByMe, ...assignedByOthers].map((task) => task.id))];
  if (allTaskIds.length === 0) {
    return { assignedTasks: assignedByOthers, createdTasks: createdByMe, subtasks: {}, taskSnoozes: {}, taskCommentCounts: {} };
  }

  const [snoozesSettled, subtasksSettled, commentsSettled] = await Promise.allSettled([
    supabase.from("task_snoozes").select("task_id, snoozed_until").eq("user_id", userId),
    supabase
      .from("tasks")
      .select(TASK_LIST_SELECT)
      .not("parent_task_id", "is", null)
      .neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("task_comments").select("task_id").in("task_id", allTaskIds),
  ]);

  const snoozesData = snoozesSettled.status === 'fulfilled' && !snoozesSettled.value.error ? snoozesSettled.value.data || [] : [];
  const allSubtasksData: MyWorkTask[] = subtasksSettled.status === 'fulfilled' && !subtasksSettled.value.error ? subtasksSettled.value.data || [] : [];
  const commentsData = commentsSettled.status === 'fulfilled' && !commentsSettled.value.error ? commentsSettled.value.data || [] : [];

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
  snoozesData.forEach((snooze) => {
    if (snooze.task_id) snoozeMap[snooze.task_id] = snooze.snoozed_until;
  });

  const commentCounts: Record<string, number> = {};
  commentsData.forEach((comment) => {
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

export function useMyWorkTasksData(userId?: string) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-work-tasks', userId],
    queryFn: () => fetchTasks(userId!),
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
    queryClient.invalidateQueries({ queryKey: ['my-work-tasks', userId] });
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
        queryClient.invalidateQueries({ queryKey: ['my-work-tasks', userId] });
      }, 300);
    };

    const channel = supabase
      .channel(`my-work-tasks-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_snoozes", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return {
    assignedTasks: effectiveAssigned,
    setAssignedTasks: (val: MyWorkTask[]) => setLocalOverrides(prev => ({ ...prev, assignedTasks: val })),
    createdTasks: effectiveCreated,
    setCreatedTasks: (val: MyWorkTask[]) => setLocalOverrides(prev => ({ ...prev, createdTasks: val })),
    subtasks: effectiveSubtasks,
    setSubtasks: (val: Record<string, MyWorkTask[]>) => setLocalOverrides(prev => ({ ...prev, subtasks: val })),
    taskSnoozes: effectiveSnoozes,
    setTaskSnoozes: (val: Record<string, string>) => setLocalOverrides(prev => ({ ...prev, taskSnoozes: val })),
    taskCommentCounts: effectiveComments,
    setTaskCommentCounts: (val: Record<string, number>) => setLocalOverrides(prev => ({ ...prev, taskCommentCounts: val })),
    loading: isLoading,
    loadTasks,
  };
}
