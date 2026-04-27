import { useState } from "react";
import { CaseFileTask } from "@/features/cases/files/hooks";
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
import { getCaseTaskDescription, isMatchingCaseParentTaskLink } from "@/features/cases/shared/utils/caseInteropAdapters";
import { debugConsole } from "@/utils/debugConsole";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";

interface CaseFileNextStepsProps {
  tasks: CaseFileTask[];
  caseFileId: string;
  tenantId?: string;
  caseFileTitle?: string;
  assignedTo?: string | null;
  onCompleteTask: (taskId: string) => Promise<boolean>;
  onAddTask: (taskId: string, notes?: string, taskTitle?: string) => Promise<boolean>;
  onRefresh: () => void;
}

export function CaseFileNextSteps({
  tasks,
  caseFileId,
  tenantId,
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
  const { toast } = useToast();
  const resolvedTenantId = currentTenant?.id || tenantId;

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

  const handleCompleteTask = async (taskId: string) => {
    const { data: childTasks, error } = await supabase
      .from("tasks")
      .select("id")
      .eq("parent_task_id", taskId)
      .neq("status", "cancelled");

    if (error) {
      debugConsole.error("Error checking child tasks before completion:", error);
      toast({
        title: "Aufgabe konnte nicht abgeschlossen werden",
        description: "Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
      return;
    }

    if ((childTasks || []).length > 0) {
      toast({
        title: "Container-Aufgabe kann nicht geschlossen werden",
        description:
          "Solange Child-Tasks existieren, bleibt die Hauptaufgabe offen. Sonst werden Child-Tasks nicht mehr sichtbar.",
        variant: "destructive",
      });
      return;
    }

    await onCompleteTask(taskId);
  };

  const findOrCreateParentTask = async (): Promise<string | null> => {
    if (!user || !resolvedTenantId || !caseFileTitle) return null;

    const normalizedCaseFileTitle = caseFileTitle.trim();
    const targetAssignee = assignedTo || user.id;

    // Check if a parent task already exists for this case file
    const { data: existingLinks } = await supabase
      .from("case_file_tasks")
      .select("task_id, task:tasks(id, title, parent_task_id, status)")
      .eq("case_file_id", caseFileId);

    // Find the dedicated parent task for this case file title
    const parentLink = (existingLinks || []).find((link) => isMatchingCaseParentTaskLink(link, normalizedCaseFileTitle));

    if (parentLink?.task?.id) {
      if (parentLink.task.status === "completed" || parentLink.task.status === "cancelled") {
        await supabase
          .from("tasks")
          .update({ status: "todo", assigned_to: targetAssignee })
          .eq("id", parentLink.task.id);
      }

      return parentLink.task.id;
    }

    // Create parent task
    const { data: parentTask, error } = await supabase
      .from("tasks")
      .insert([{
        title: normalizedCaseFileTitle,
        description: "Container-Aufgabe für Schnellaufgaben aus der Fallakte",
        status: "todo",
        priority: "medium",
        category: "personal",
        user_id: user.id,
        tenant_id: resolvedTenantId,
        assigned_to: targetAssignee,
      }])
      .select()
      .single();

    if (error) throw error;

    // Link parent task to case file
    await onAddTask(parentTask.id, undefined, parentTask.title);

    return parentTask.id;
  };

  const handleQuickAdd = async () => {
    if (!quickTaskTitle.trim() || !user || !resolvedTenantId) {
      toast({
        title: "Schnellaufgabe konnte nicht erstellt werden",
        description: "Bitte prüfen Sie die Mandantenzuordnung der Fallakte.",
        variant: "destructive",
      });
      return;
    }
    setIsAdding(true);

    try {
      // Find or create parent task
      const parentTaskId = await findOrCreateParentTask();
      if (!parentTaskId) {
        toast({
          title: "Schnellaufgabe konnte nicht erstellt werden",
          description: "Die Hauptaufgabe der Fallakte konnte nicht ermittelt werden.",
          variant: "destructive",
        });
        return;
      }

      // Create sub-task
      const { data: newTask, error: taskError } = await supabase
        .from("tasks")
        .insert([{
          title: quickTaskTitle.trim(),
          status: "todo",
          priority: "medium",
          category: "personal",
          user_id: user.id,
          tenant_id: resolvedTenantId,
          assigned_to: assignedTo || user.id,
          parent_task_id: parentTaskId,
        }])
        .select()
        .single();

      if (taskError) throw taskError;

      // Link to case file
      await onAddTask(newTask.id, undefined, newTask.title);
      setQuickTaskTitle("");
      onRefresh();
    } catch (error) {
      debugConsole.error("Error creating quick task:", error);
      toast({
        title: "Schnellaufgabe konnte nicht erstellt werden",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const dotClass = (dueDate: string | null | undefined): string => {
    if (!dueDate) return "bg-muted-foreground/30";
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    const diffDays = (due - now) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return "bg-destructive";
    if (diffDays < 3) return "bg-amber-500";
    if (diffDays < 14) return "bg-yellow-400";
    return "bg-primary";
  };

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground flex items-center justify-between">
          <span>
            Offene Aufgaben
            {tasks.length > 0 && (
              <span className="ml-2 text-muted-foreground/70">· {openTasks.length}</span>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              const input = document.getElementById("case-file-quick-task") as HTMLInputElement | null;
              input?.focus();
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-1">
        {openTasks.length === 0 && (
          <p className="text-xs text-muted-foreground italic py-1">
            Keine offenen Aufgaben
          </p>
        )}

        {openTasks.map((item) => {
          const due = item.task?.due_date;
          const owner: string | null = null;

          return (
            <div
              key={item.id}
              className="group flex items-start gap-2.5 py-2 border-b border-border/50 last:border-b-0"
            >
              <Checkbox
                className="mt-0.5"
                onCheckedChange={() => {
                  if (item.task?.id) handleCompleteTask(item.task.id);
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{item.task?.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {due && (
                    <>
                      bis {format(new Date(due), "dd.MM.", { locale: de })}
                    </>
                  )}
                  {due && owner && <span> · </span>}
                  {owner && <span>{owner}</span>}
                  {!due && !owner && <span className="italic">kein Termin</span>}
                </p>
              </div>
              <span
                className={cn("h-2 w-2 rounded-full mt-2 shrink-0", dotClass(due))}
                aria-hidden
              />
            </div>
          );
        })}

        {/* Quick-Add */}
        <div className="flex items-center gap-1.5 pt-3">
          <Input
            id="case-file-quick-task"
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
