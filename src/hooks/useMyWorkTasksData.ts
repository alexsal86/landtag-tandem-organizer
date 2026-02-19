import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const normalizeAssignedTo = (assignedTo: string | null | undefined) => {
  if (!assignedTo) return [];

  return assignedTo
    .replace(/[{}]/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export function useMyWorkTasksData(userId?: string) {
  const [assignedTasks, setAssignedTasks] = useState<MyWorkTask[]>([]);
  const [createdTasks, setCreatedTasks] = useState<MyWorkTask[]>([]);
  const [subtasks, setSubtasks] = useState<Record<string, MyWorkTask[]>>({});
  const [taskSnoozes, setTaskSnoozes] = useState<Record<string, string>>({});
  const [taskCommentCounts, setTaskCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!userId) return;

    try {
      const [assignedResult, createdResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .or(`assigned_to.eq.${userId},assigned_to.ilike.%${userId}%`)
          .neq("status", "completed")
          .is("parent_task_id", null)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("tasks")
          .select("*")
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

      setCreatedTasks(createdByMe);
      setAssignedTasks(assignedByOthers);

      const allTaskIds = [...new Set([...createdByMe, ...assignedByOthers].map((task) => task.id))];
      if (allTaskIds.length === 0) {
        setSubtasks({});
        setTaskSnoozes({});
        setTaskCommentCounts({});
        return;
      }

      const { data: snoozesData, error: snoozesError } = await supabase
        .from("task_snoozes")
        .select("task_id, snoozed_until")
        .eq("user_id", userId);

      if (snoozesError) throw snoozesError;

      const grouped: Record<string, MyWorkTask[]> = {};
      const tenantIds = [...new Set([...createdByMe, ...assignedByOthers].map((task) => task.tenant_id).filter(Boolean))] as string[];

      const subtasksQuery = supabase
        .from("tasks")
        .select("*")
        .neq("status", "completed")
        .not("parent_task_id", "is", null)
        .order("due_date", { ascending: true, nullsFirst: false });

      const { data: allSubtasksData, error: allSubtasksError } = tenantIds.length > 0
        ? await subtasksQuery.in("tenant_id", tenantIds)
        : await subtasksQuery;

      if (allSubtasksError) throw allSubtasksError;

      const childrenByParent = new Map<string, MyWorkTask[]>();
      (allSubtasksData || []).forEach((task) => {
        if (!task.parent_task_id) return;
        const siblings = childrenByParent.get(task.parent_task_id) || [];
        siblings.push(task);
        childrenByParent.set(task.parent_task_id, siblings);
      });

      const queue = [...allTaskIds];
      const visited = new Set<string>();
      while (queue.length > 0) {
        const parentId = queue.shift();
        if (!parentId || visited.has(parentId)) continue;
        visited.add(parentId);

        const children = childrenByParent.get(parentId) || [];
        if (children.length > 0) {
          grouped[parentId] = children;
          children.forEach((childTask) => {
            if (!visited.has(childTask.id)) queue.push(childTask.id);
          });
        }
      }

      setSubtasks(grouped);

      const snoozeMap: Record<string, string> = {};
      (snoozesData || []).forEach((snooze) => {
        if (snooze.task_id) snoozeMap[snooze.task_id] = snooze.snoozed_until;
      });
      setTaskSnoozes(snoozeMap);

      const { data: commentsData } = await supabase
        .from("task_comments")
        .select("task_id")
        .in("task_id", allTaskIds);

      const commentCounts: Record<string, number> = {};
      (commentsData || []).forEach((comment) => {
        if (!comment.task_id) return;
        commentCounts[comment.task_id] = (commentCounts[comment.task_id] || 0) + 1;
      });
      setTaskCommentCounts(commentCounts);
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void loadTasks();
  }, [userId, loadTasks]);

  return {
    assignedTasks,
    setAssignedTasks,
    createdTasks,
    setCreatedTasks,
    subtasks,
    setSubtasks,
    taskSnoozes,
    setTaskSnoozes,
    taskCommentCounts,
    setTaskCommentCounts,
    loading,
    loadTasks,
  };
}
