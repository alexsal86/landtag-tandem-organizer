import { useState } from "react";
import { CaseFileTask } from "@/hooks/useCaseFileDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Plus, Calendar } from "lucide-react";
import { format, isPast } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

interface CaseFileNextStepsProps {
  tasks: CaseFileTask[];
  caseFileId: string;
  caseFileTitle?: string;
  assignedTo?: string | null;
  onCompleteTask: (taskId: string) => Promise<boolean>;
  onAddTask: (taskId: string, notes?: string, taskTitle?: string) => Promise<boolean>;
  onRefresh: () => void;
}

export function CaseFileNextSteps({
  tasks,
  caseFileId,
  caseFileTitle,
  assignedTo,
  onCompleteTask,
  onAddTask,
  onRefresh,
}: CaseFileNextStepsProps) {
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  // Filter for open tasks only
  const openTasks = tasks
    .filter((t) => t.task && t.task.status !== "completed" && t.task.status !== "cancelled")
    .sort((a, b) => {
      const aOverdue = a.task?.due_date ? isPast(new Date(a.task.due_date)) : false;
      const bOverdue = b.task?.due_date ? isPast(new Date(b.task.due_date)) : false;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (a.task?.due_date && b.task?.due_date) {
        return new Date(a.task.due_date).getTime() - new Date(b.task.due_date).getTime();
      }
      if (a.task?.due_date) return -1;
      if (b.task?.due_date) return 1;
      return 0;
    });

  const completedCount = tasks.filter(
    (t) => t.task?.status === "completed"
  ).length;

  const findOrCreateParentTask = async (): Promise<string | null> => {
    if (!user || !currentTenant || !caseFileTitle) return null;

    // Check if a parent task already exists for this case file
    const { data: existingLinks } = await supabase
      .from("case_file_tasks")
      .select("task_id, task:tasks(id, title, parent_task_id)")
      .eq("case_file_id", caseFileId);

    // Find a task that has no parent (= it IS the parent task)
    const parentLink = (existingLinks || []).find(
      (link: any) => link.task && !link.task.parent_task_id
    );

    if (parentLink?.task?.id) return parentLink.task.id;

    // Create parent task
    const { data: parentTask, error } = await supabase
      .from("tasks")
      .insert({
        title: `📂 ${caseFileTitle}`,
        status: "todo",
        priority: "medium",
        category: "general",
        user_id: user.id,
        tenant_id: currentTenant.id,
        assigned_to: assignedTo || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Link parent task to case file
    await onAddTask(parentTask.id, undefined, parentTask.title);

    return parentTask.id;
  };

  const handleQuickAdd = async () => {
    if (!quickTaskTitle.trim() || !user || !currentTenant) return;
    setIsAdding(true);

    try {
      // Find or create parent task
      const parentTaskId = await findOrCreateParentTask();

      // Create sub-task
      const { data: newTask, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: quickTaskTitle.trim(),
          status: "todo",
          priority: "medium",
          category: "general",
          user_id: user.id,
          tenant_id: currentTenant.id,
          assigned_to: assignedTo || null,
          parent_task_id: parentTaskId,
        } as any)
        .select()
        .single();

      if (taskError) throw taskError;

      // Link to case file
      await onAddTask(newTask.id, undefined, newTask.title);
      setQuickTaskTitle("");
      onRefresh();
    } catch (error) {
      console.error("Error creating quick task:", error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Nächste Schritte
          </span>
          {tasks.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {completedCount}/{tasks.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {openTasks.length === 0 && (
          <p className="text-xs text-muted-foreground py-1">
            Keine offenen Aufgaben
          </p>
        )}

        {openTasks.map((item) => {
          const isOverdue = item.task?.due_date
            ? isPast(new Date(item.task.due_date))
            : false;

          return (
            <div
              key={item.id}
              className="flex items-start gap-2 py-1.5"
            >
              <Checkbox
                className="mt-0.5"
                onCheckedChange={() => {
                  if (item.task?.id) onCompleteTask(item.task.id);
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight truncate">
                  {item.task?.title}
                </p>
                {(item.task as any)?.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {(item.task as any).description}
                  </p>
                )}
                {item.task?.due_date && (
                  <div
                    className={cn(
                      "flex items-center gap-1 text-[10px] mt-0.5",
                      isOverdue
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    <Calendar className="h-3 w-3" />
                    {format(new Date(item.task.due_date), "dd.MM.yyyy", {
                      locale: de,
                    })}
                    {isOverdue && " (überfällig)"}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Quick-Add */}
        <div className="flex items-center gap-1.5 pt-2">
          <Input
            value={quickTaskTitle}
            onChange={(e) => setQuickTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleQuickAdd();
            }}
            placeholder="Schnell-Aufgabe..."
            className="h-8 text-sm"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={handleQuickAdd}
            disabled={!quickTaskTitle.trim() || isAdding}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
