import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CreatedTask } from "./components/protocol/types";

export function protocolTaskStatus(task: CreatedTask, now = new Date()) {
  if (task.status === "completed") return "completed";
  if (task.due_date) {
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(now);
    const overdue = task.due_date.length === 10
      ? task.due_date < today
      : new Date(task.due_date) < now;
    if (overdue) return "overdue";
  }
  return task.status === "in-progress" || task.status === "in_progress" ? "in-progress" : "open";
}

export function protocolTaskProgress(tasks: CreatedTask[]) {
  return { total: tasks.length, completed: tasks.filter((task) => task.status === "completed").length };
}

export function useProtocolTasks(meetingId?: string, tenantId?: string | null) {
  return useQuery({
    queryKey: ["meeting-protocol-tasks", tenantId, meetingId],
    enabled: Boolean(meetingId && tenantId),
    refetchInterval: 15_000,
    queryFn: async () => {
      const tasks: CreatedTask[] = [];
      const pageSize = 200;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from("meeting_protocol_tasks")
          .select("id, title, assigned_to, parent_task_id, status, due_date, completed_at, archived")
          .eq("tenant_id", tenantId!)
          .eq("meeting_id", meetingId!)
          .order("id")
          .range(offset, offset + pageSize - 1);
        if (error) throw error;

        for (const task of data) {
          if (task.id && task.title !== null) tasks.push({ ...task, id: task.id, title: task.title });
        }
        if (data.length < pageSize) return tasks;
      }
    },
  });
}
