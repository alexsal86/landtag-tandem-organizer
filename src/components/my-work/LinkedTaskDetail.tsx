import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { TaskDetailSidebar } from "@/features/tasks/components/TaskDetailSidebar";
import type { Task } from "@/components/task-detail/types";
import { supabase } from "@/integrations/supabase/client";

export function LinkedTaskDetail({ taskId, tenantId, taskCategories, taskStatuses, onClose, onUpdate }: {
  taskId: string;
  tenantId: string;
  taskCategories: Array<{ name: string; label: string }>;
  taskStatuses: Array<{ name: string; label: string }>;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const query = useQuery({
    queryKey: ["my-work-linked-task", tenantId, taskId],
    queryFn: async () => {
      const live = await supabase.from("tasks")
        .select("id, title, description, priority, status, category, due_date, assigned_to, progress, tenant_id, parent_task_id")
        .eq("id", taskId).eq("tenant_id", tenantId).maybeSingle();
      if (live.error) throw live.error;
      if (live.data) return { live: live.data, archived: null };

      const archived = await supabase.from("archived_meeting_protocol_tasks")
        .select("title, description, completed_at")
        .eq("id", taskId).eq("tenant_id", tenantId)
        .order("archived_at", { ascending: false }).limit(1).maybeSingle();
      if (archived.error) throw archived.error;
      return { live: null, archived: archived.data };
    },
  });

  if (query.data?.live) {
    const row = query.data.live;
    const task: Task = {
      ...row,
      description: row.description ?? "",
      category: row.category as Task["category"],
      priority: row.priority as Task["priority"],
      status: row.status as Task["status"],
      dueDate: row.due_date,
      assignedTo: row.assigned_to ?? undefined,
      progress: row.progress ?? undefined,
    };
    const refresh = () => {
      onUpdate();
      void query.refetch();
    };
    return <TaskDetailSidebar task={task} isOpen onClose={onClose} onTaskUpdate={refresh} onTaskRestored={refresh}
      taskCategories={taskCategories} taskStatuses={taskStatuses} />;
  }

  const archived = query.data?.archived;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{archived?.title ?? "Aufgabe"}</DialogTitle>
          <DialogDescription>
            {query.isPending ? "Aufgabe wird geladen …" : archived?.completed_at
              ? `Erledigt am ${new Date(archived.completed_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`
              : "Die Aufgabe konnte nicht geladen werden."}
          </DialogDescription>
        </DialogHeader>
        {archived?.description && <RichTextDisplay className="break-words text-sm" content={archived.description} />}
      </DialogContent>
    </Dialog>
  );
}
