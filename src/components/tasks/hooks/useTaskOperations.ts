import { useState, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import type { AppUserRef, TenantRef } from "@/components/shared/featureDomainTypes";
import type { Subtask, Task } from "../types";

interface CallLogRecord {
  id: string;
  contact_id: string | null;
  caller_phone: string | null;
  caller_name: string | null;
  call_date: string;
  call_type: "incoming" | "outgoing";
  priority: string;
  notes: string | null;
}

interface ContactRecord {
  id: string;
  notes: string | null;
}

type AssignedSubtask = Subtask & { task_title: string };

interface UseTaskOperationsProps {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  user: AppUserRef | null;
  currentTenant: TenantRef | null;
  loadTasks: () => Promise<void>;
  loadTaskComments: () => Promise<void>;
  loadTaskSnoozes: () => Promise<void>;
  loadAssignedSubtasks: () => Promise<void>;
  loadTodos: () => Promise<void>;
  loadAllSnoozes: () => Promise<void>;
  assignedSubtasks: AssignedSubtask[];
}

export interface UseTaskOperationsReturn {
  processingTaskIds: Set<string>;
  showCelebration: boolean;
  setShowCelebration: Dispatch<SetStateAction<boolean>>;
  toggleTaskStatus: (taskId: string) => Promise<void>;
  addComment: (taskId: string, content: string) => Promise<boolean | undefined>;
  snoozeTask: (taskId: string, snoozeUntil: string) => Promise<void>;
  snoozeSubtask: (subtaskId: string, snoozeUntil: string) => Promise<void>;
  updateSnooze: (snoozeId: string, newDate: string) => Promise<void>;
  deleteSnooze: (snoozeId: string) => Promise<void>;
  handleSubtaskComplete: (subtaskId: string, isCompleted: boolean, result?: string) => Promise<void>;
  createQuickNoteFromTask: (taskId: string, content: string) => Promise<boolean | undefined>;
  completeTodo: (todoId: string) => Promise<void>;
}

export function useTaskOperations({
  tasks, setTasks, user, currentTenant,
  loadTasks, loadTaskComments, loadTaskSnoozes,
  loadAssignedSubtasks, loadTodos, loadAllSnoozes,
  assignedSubtasks,
}: UseTaskOperationsProps): UseTaskOperationsReturn {
  const { toast } = useToast();
  const [processingTaskIds, setProcessingTaskIds] = useState<Set<string>>(new Set());
  const [showCelebration, setShowCelebration] = useState(false);

  const toggleTaskStatus = async (taskId: string): Promise<void> => {
    if (processingTaskIds.has(taskId)) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !user) return;

    const newStatus = task.status === "completed" ? "todo" : "completed";
    const originalStatus = task.status;
    const originalProgress = task.progress || 0;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setProcessingTaskIds(prev => new Set(prev).add(taskId));

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, progress: newStatus === "completed" ? 100 : originalProgress })
        .eq("id", taskId);

      if (error) {
        const isNetworkError = error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError");
        if (isNetworkError) {
          setTimeout(async () => {
            const { data: freshTask } = await supabase.from("tasks").select("*").eq("id", taskId).single();
            if (!freshTask) {
              setTasks(prev => prev.filter(t => t.id !== taskId));
              setShowCelebration(true);
            } else if (freshTask.status === "completed" && newStatus === "completed") {
              const { data: existingArchive } = await supabase.from("archived_tasks").select("id").eq("task_id", taskId).maybeSingle();
              if (!existingArchive) {
                await supabase.from("archived_tasks").insert([{
                  task_id: taskId,
                  user_id: user.id,
                  title: freshTask.title,
                  description: freshTask.description,
                  priority: freshTask.priority,
                  category: freshTask.category,
                  assigned_to: freshTask.assigned_to || "",
                  progress: 100,
                  due_date: freshTask.due_date,
                  completed_at: new Date().toISOString(),
                }]);
                await supabase.from("tasks").delete().eq("id", taskId);
              }
              setTasks(prev => prev.filter(t => t.id !== taskId));
              setShowCelebration(true);
            } else if (freshTask.status !== newStatus) {
              setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: originalStatus } : t));
            }
            setProcessingTaskIds(prev => {
              const next = new Set(prev);
              next.delete(taskId);
              return next;
            });
          }, 500);
          return;
        }
        throw error;
      }

      if (newStatus === "completed") {
        const { error: archiveError } = await supabase.from("archived_tasks").insert([{
          task_id: taskId,
          user_id: user.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          category: task.category,
          assigned_to: task.assignedTo || "",
          progress: 100,
          due_date: task.dueDate,
          completed_at: new Date().toISOString(),
        }]);

        if (archiveError) {
          const isNetworkError = archiveError.message?.includes("Failed to fetch") || archiveError.message?.includes("NetworkError");
          if (isNetworkError) {
            setTimeout(async () => {
              const { data: archived } = await supabase.from("archived_tasks").select("id").eq("task_id", taskId).single();
              if (archived) {
                await supabase.from("tasks").delete().eq("id", taskId);
                setTasks(prev => prev.filter(t => t.id !== taskId));
                setShowCelebration(true);
              }
              await loadTasks();
              setProcessingTaskIds(prev => {
                const next = new Set(prev);
                next.delete(taskId);
                return next;
              });
            }, 500);
            return;
          }
          await supabase.from("tasks").update({ status: originalStatus, progress: originalProgress }).eq("id", taskId);
          throw archiveError;
        }

        await supabase.from("tasks").delete().eq("id", taskId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
        void supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("navigation_context", "tasks");
        setShowCelebration(true);
      } else {
        await loadTasks();
      }

      toast({
        title: "Status aktualisiert",
        description: newStatus === "completed"
          ? "Aufgabe wurde als erledigt markiert und archiviert."
          : "Aufgabe wurde als offen markiert.",
      });
    } catch (error: unknown) {
      debugConsole.error("Error updating task:", error);
      const msg = error instanceof Error ? error.message : String(error);
      const isNetworkError = msg?.includes("Failed to fetch") || msg?.includes("NetworkError");
      if (isNetworkError) {
        setTimeout(() => void loadTasks(), 500);
        setProcessingTaskIds(prev => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
        return;
      }
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: originalStatus } : t));
      toast({ title: "Fehler", description: msg || "Status konnte nicht aktualisiert werden.", variant: "destructive" });
    } finally {
      setProcessingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const addComment = async (taskId: string, content: string): Promise<boolean | undefined> => {
    if (!content.trim() || !user) return undefined;
    try {
      const { error } = await supabase.from("task_comments").insert([{ task_id: taskId, user_id: user.id, content: content.trim() }]);
      if (error) throw error;
      await loadTaskComments();
      toast({ title: "Kommentar hinzugefügt" });
      return true;
    } catch (error: unknown) {
      debugConsole.error("Error adding comment:", error);
      toast({ title: "Fehler", description: "Kommentar konnte nicht hinzugefügt werden.", variant: "destructive" });
      return false;
    }
  };

  const snoozeTask = async (taskId: string, snoozeUntil: string): Promise<void> => {
    if (!user) return;
    try {
      const { data: existingSnooze } = await supabase.from("task_snoozes").select("id").eq("task_id", taskId).eq("user_id", user.id).single();
      if (existingSnooze) {
        const { error } = await supabase.from("task_snoozes").update({ snoozed_until: snoozeUntil }).eq("id", existingSnooze.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task_snoozes").insert([{ user_id: user.id, task_id: taskId, snoozed_until: snoozeUntil }]);
        if (error) throw error;
      }
      await loadTaskSnoozes();
      toast({ title: "Wiedervorlage gesetzt", description: `Aufgabe wird bis ${new Date(snoozeUntil).toLocaleDateString("de-DE")} ausgeblendet.` });
    } catch (error: unknown) {
      debugConsole.error("Error snoozing task:", error);
      toast({ title: "Fehler", description: "Wiedervorlage konnte nicht gesetzt werden.", variant: "destructive" });
    }
  };

  const snoozeSubtask = async (subtaskId: string, snoozeUntil: string): Promise<void> => {
    if (!user) return;
    try {
      const { data: existingSnooze } = await supabase.from("task_snoozes").select("id").eq("subtask_id", subtaskId).eq("user_id", user.id).single();
      if (existingSnooze) {
        const { error } = await supabase.from("task_snoozes").update({ snoozed_until: snoozeUntil }).eq("id", existingSnooze.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task_snoozes").insert([{ user_id: user.id, subtask_id: subtaskId, snoozed_until: snoozeUntil }]);
        if (error) throw error;
      }
      await loadTaskSnoozes();
      await loadAssignedSubtasks();
      toast({ title: "Wiedervorlage gesetzt", description: `Unteraufgabe wird bis ${new Date(snoozeUntil).toLocaleDateString("de-DE")} ausgeblendet.` });
    } catch (error: unknown) {
      debugConsole.error("Error snoozing subtask:", error);
      toast({ title: "Fehler", description: "Wiedervorlage konnte nicht gesetzt werden.", variant: "destructive" });
    }
  };

  const updateSnooze = async (snoozeId: string, newDate: string): Promise<void> => {
    try {
      const { error } = await supabase.from("task_snoozes").update({ snoozed_until: newDate }).eq("id", snoozeId);
      if (error) throw error;
      await loadAllSnoozes();
      await loadTaskSnoozes();
      toast({ title: "Erfolgreich", description: "Wiedervorlage wurde aktualisiert." });
    } catch (error) {
      debugConsole.error("Error updating snooze:", error);
      toast({ title: "Fehler", description: "Wiedervorlage konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const deleteSnooze = async (snoozeId: string): Promise<void> => {
    try {
      const { error } = await supabase.from("task_snoozes").delete().eq("id", snoozeId);
      if (error) throw error;
      await loadAllSnoozes();
      await loadTaskSnoozes();
      toast({ title: "Erfolgreich", description: "Wiedervorlage wurde gelöscht." });
    } catch (error) {
      debugConsole.error("Error deleting snooze:", error);
      toast({ title: "Fehler", description: "Wiedervorlage konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const handleSubtaskComplete = async (subtaskId: string, isCompleted: boolean, result = ""): Promise<void> => {
    try {
      const subtask = assignedSubtasks.find((s) => s.id === subtaskId);
      if (!subtask) return;

      if (subtask.source_type === "call_followup" && isCompleted && subtask.call_log_id) {
        await handleCallFollowUpComplete(subtask.call_log_id, result);
        await supabase.from("tasks").update({ status: "completed" }).eq("id", subtaskId);
      } else if (subtask.source_type === "task_child") {
        const { error } = await supabase.from("tasks").update({ status: isCompleted ? "completed" : "todo" }).eq("id", subtaskId);
        if (error) throw error;
      } else {
        const updateData: { is_completed: boolean; completed_at: string | null; result_text?: string } = {
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        };
        if (result) updateData.result_text = result;
        const { error } = await supabase.from("planning_item_subtasks").update(updateData).eq("id", subtaskId);
        if (error) throw error;
      }

      await loadAssignedSubtasks();
      if (isCompleted) setShowCelebration(true);
      toast({
        title: isCompleted ? "Unteraufgabe erledigt" : "Unteraufgabe wieder geöffnet",
        description: isCompleted ? "Die Unteraufgabe wurde als erledigt markiert." : "Die Unteraufgabe wurde wieder geöffnet.",
      });
    } catch (error: unknown) {
      debugConsole.error("Error updating subtask:", error);
      toast({ title: "Fehler", description: "Unteraufgabe konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const handleCallFollowUpComplete = async (callLogId: string, resultText?: string): Promise<void> => {
    const { data: callLog, error: callLogError } = await supabase
      .from("call_logs")
      .select("id, contact_id, caller_phone, caller_name, call_date, call_type, priority, notes")
      .eq("id", callLogId)
      .single();
    if (callLogError || !callLog) throw callLogError;

    if (callLog.contact_id) {
      await supabase.from("call_logs").update({ follow_up_completed: true, completion_notes: resultText || null }).eq("id", callLogId);
    } else {
      await createArchiveContact(callLog, resultText);
    }

    const { data: appointment } = await supabase.from("appointments").select("title").eq("call_log_id", callLogId).single();
    if (appointment && !appointment.title.startsWith("Erledigt:")) {
      await supabase.from("appointments").update({ title: `Erledigt: ${appointment.title}`, status: "completed" }).eq("call_log_id", callLogId);
    }
  };

  const createArchiveContact = async (callLog: CallLogRecord, resultText?: string): Promise<void> => {
    if (!user) return;
    const phone = callLog.caller_phone;
    const name = callLog.caller_name || `Unbekannter Anrufer (${phone ?? "ohne Nummer"})`;

    let archiveContact: ContactRecord | null = null;
    if (phone) {
      const { data } = await supabase
        .from("contacts")
        .select("id, notes")
        .eq("phone", phone)
        .eq("contact_type", "archive")
        .eq("user_id", user.id)
        .single();
      archiveContact = data;
    }

    if (archiveContact) {
      const newNotes = (archiveContact.notes || "") +
        `\n\n--- Follow-Up vom ${new Date().toLocaleDateString("de-DE")} ---\n` +
        `Ursprünglicher Anruf: ${new Date(callLog.call_date).toLocaleString("de-DE")}\n` +
        `Anruftyp: ${callLog.call_type === "incoming" ? "Eingehend" : "Ausgehend"}\n` +
        `Priorität: ${callLog.priority}\n` +
        `Ursprüngliche Notizen: ${callLog.notes || "Keine"}\n` +
        `Follow-Up Ergebnis: ${resultText || "Keine Notizen"}`;
      await supabase.from("contacts").update({ notes: newNotes, last_contact: "heute", updated_at: new Date().toISOString() }).eq("id", archiveContact.id);
    } else {
      await supabase.from("contacts").insert([{
        user_id: user.id,
        name,
        phone,
        contact_type: "archive",
        category: "citizen",
        priority: "low",
        last_contact: "heute",
        notes: `=== CALL FOLLOW-UP ARCHIV ===\nUrsprünglicher Anruf: ${new Date(callLog.call_date).toLocaleString("de-DE")}\nAnruftyp: ${callLog.call_type === "incoming" ? "Eingehend" : "Ausgehend"}\nPriorität: ${callLog.priority}\nUrsprüngliche Notizen: ${callLog.notes || "Keine"}\nFollow-Up Ergebnis: ${resultText || "Keine Notizen"}\n\nDieser Kontakt wurde automatisch aus Call Follow-Ups erstellt.`,
        additional_info: "Automatisch erstellt aus Call Follow-Up",
        tenant_id: currentTenant?.id || "",
      }]);
    }

    await supabase.from("call_logs").update({ follow_up_completed: true, completion_notes: resultText || null }).eq("id", callLog.id);
  };

  const createQuickNoteFromTask = async (taskId: string, content: string): Promise<boolean | undefined> => {
    if (!user || !content.trim()) return undefined;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return undefined;
    try {
      const { error } = await supabase.from("quick_notes").insert([{
        user_id: user.id,
        title: `Task Note: ${task.title}`,
        content: content.trim(),
        category: "task",
        color: "#3b82f6",
        is_pinned: false,
        tags: ["task", task.category],
      }]);
      if (error) throw error;
      toast({ title: "Notiz erstellt", description: "Quick Note wurde erfolgreich erstellt." });
      return true;
    } catch (error) {
      debugConsole.error("Error creating quick note:", error);
      toast({ title: "Fehler", description: "Notiz konnte nicht erstellt werden.", variant: "destructive" });
      return false;
    }
  };

  const completeTodo = async (todoId: string): Promise<void> => {
    try {
      const { error } = await supabase.from("todos").update({ is_completed: true, completed_at: new Date().toISOString() }).eq("id", todoId);
      if (error) throw error;
      await loadTodos();
      setShowCelebration(true);
      toast({ title: "ToDo erledigt", description: "Das ToDo wurde als erledigt markiert." });
    } catch (error) {
      debugConsole.error("Error completing todo:", error);
      toast({ title: "Fehler", description: "ToDo konnte nicht als erledigt markiert werden.", variant: "destructive" });
    }
  };

  return {
    processingTaskIds,
    showCelebration,
    setShowCelebration,
    toggleTaskStatus,
    addComment,
    snoozeTask,
    snoozeSubtask,
    updateSnooze,
    deleteSnooze,
    handleSubtaskComplete,
    createQuickNoteFromTask,
    completeTodo,
  };
}
