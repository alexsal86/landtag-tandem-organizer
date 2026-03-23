import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MyWorkTask } from "@/hooks/useMyWorkTasksData";
import { debugConsole } from "@/utils/debugConsole";
import { notifyTaskShared } from "@/utils/shareNotifications";

interface Profile {
  user_id: string;
  display_name: string | null;
}

interface UseMyWorkTaskActionsParams {
  userId?: string;
  assignedTasks: MyWorkTask[];
  setAssignedTasks: (value: MyWorkTask[] | ((prev: MyWorkTask[]) => MyWorkTask[])) => void;
  createdTasks: MyWorkTask[];
  setCreatedTasks: (value: MyWorkTask[] | ((prev: MyWorkTask[]) => MyWorkTask[])) => void;
  subtasks: Record<string, MyWorkTask[]>;
  setSubtasks: (value: Record<string, MyWorkTask[]> | ((prev: Record<string, MyWorkTask[]>) => Record<string, MyWorkTask[]>)) => void;
  taskSnoozes: Record<string, string>;
  setTaskSnoozes: (value: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  profiles: Profile[];
  taskStatuses: { name: string; label: string }[];
  taskCategories: { name: string; label: string }[];
  onCelebrate: () => void;
}

const DEFAULT_EDIT_PRIORITY = "medium";
const DEFAULT_EDIT_STATUS = "todo";
const DEFAULT_EDIT_CATEGORY = "personal";

const toEditorHtml = (value: string | null | undefined) => {
  if (!value) return "";
  if (/<[^>]+>/.test(value)) return value;
  return `<p>${value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</p>`;
};

export const normalizeAssignedTo = (assignedTo: string | null | undefined) => {
  if (!assignedTo) return [];

  return assignedTo
    .replace(/[{}]/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export function useMyWorkTaskActions({
  userId,
  assignedTasks,
  setAssignedTasks,
  createdTasks,
  setCreatedTasks,
  subtasks,
  setSubtasks,
  taskSnoozes,
  setTaskSnoozes,
  profiles,
  taskStatuses,
  taskCategories,
  onCelebrate,
}: UseMyWorkTaskActionsParams) {
  const { toast } = useToast();

  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [snoozeTaskId, setSnoozeTaskId] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);
  const [assignSelectedUserIds, setAssignSelectedUserIds] = useState<string[]>([]);
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(false);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionTaskId, setDecisionTaskId] = useState<string | null>(null);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [documentTaskId, setDocumentTaskId] = useState<string | null>(null);
  const [meetingSelectorOpen, setMeetingSelectorOpen] = useState(false);
  const [meetingTaskId, setMeetingTaskId] = useState<string | null>(null);
  const [taskEditDialogOpen, setTaskEditDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState(DEFAULT_EDIT_PRIORITY);
  const [editTaskStatus, setEditTaskStatus] = useState(DEFAULT_EDIT_STATUS);
  const [editTaskCategory, setEditTaskCategory] = useState(DEFAULT_EDIT_CATEGORY);

  const allTasks = useMemo(
    () => [...assignedTasks, ...createdTasks, ...Object.values(subtasks).flat()],
    [assignedTasks, createdTasks, subtasks]
  );

  const availableTaskStatuses = taskStatuses.length > 0 ? taskStatuses : [{ name: "todo", label: "Offen" }, { name: "in-progress", label: "In Bearbeitung" }, { name: "completed", label: "Erledigt" }];
  const availableTaskCategories = taskCategories.length > 0 ? taskCategories : [{ name: "legislation", label: "Gesetzgebung" }, { name: "committee", label: "Ausschuss" }, { name: "constituency", label: "Wahlkreis" }, { name: "personal", label: "Persönlich" }];

  const getTaskById = (taskId: string | null) => (taskId ? allTasks.find((task) => task.id === taskId) : undefined);

  const getTaskTitle = (taskId: string | null) => getTaskById(taskId)?.title;

  const updateTaskInCollections = (taskId: string, updater: (task: MyWorkTask) => MyWorkTask) => {
    setAssignedTasks((prev) => prev.map((task) => (task.id === taskId ? updater(task) : task)));
    setCreatedTasks((prev) => prev.map((task) => (task.id === taskId ? updater(task) : task)));
    setSubtasks((prev) => {
      const next: Record<string, MyWorkTask[]> = {};
      Object.entries(prev).forEach(([parentId, list]) => {
        next[parentId] = list.map((task) => (task.id === taskId ? updater(task) : task));
      });
      return next;
    });
  };

  const handleToggleComplete = async (taskId: string) => {
    const task = getTaskById(taskId);
    if (!task || !userId) return;

    try {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ status: "completed", progress: 100 })
        .eq("id", taskId)
        .select();

      if (updateError) throw updateError;

      await supabase.from("archived_tasks").insert([{
        task_id: taskId,
        user_id: userId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: "personal",
        assigned_to: task.assigned_to || "",
        progress: 100,
        due_date: task.due_date,
        completed_at: new Date().toISOString(),
        auto_delete_after_days: null,
      }]);

      await supabase.from("tasks").delete().eq("id", taskId);

      setAssignedTasks((prev) => prev.filter((taskItem) => taskItem.id !== taskId));
      setCreatedTasks((prev) => prev.filter((taskItem) => taskItem.id !== taskId));
      setSubtasks((prev) => {
        const next = { ...prev };
        delete next[taskId];
        Object.keys(next).forEach((parentId) => {
          next[parentId] = next[parentId].filter((taskItem) => taskItem.id !== taskId);
        });
        return next;
      });

      onCelebrate();
      toast({ title: "Aufgabe erledigt und archiviert" });
    } catch (error: unknown) {
      debugConsole.error("Error completing task:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleToggleSubtaskComplete = async (subtaskId: string) => {
    const previousSubtasks = subtasks;
    setSubtasks((prev) => {
      const next: Record<string, MyWorkTask[]> = {};
      Object.entries(prev).forEach(([parentId, list]) => {
        next[parentId] = list.filter((subtask) => subtask.id !== subtaskId);
      });
      return next;
    });

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "completed", progress: 100 })
        .eq("id", subtaskId)
        .select();

      if (error) throw error;
      onCelebrate();
      toast({ title: "Unteraufgabe erledigt" });
    } catch (error) {
      setSubtasks(previousSubtasks);
      debugConsole.error("Error completing subtask:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleUpdateTitle = async (taskId: string, title: string) => {
    try {
      const { error } = await supabase.from("tasks").update({ title }).eq("id", taskId).select();
      if (error) throw error;
      updateTaskInCollections(taskId, (task) => ({ ...task, title }));
      toast({ title: "Titel aktualisiert" });
    } catch (error) {
      debugConsole.error("Error updating title:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  const handleUpdateDescription = async (taskId: string, description: string) => {
    try {
      const { error } = await supabase.from("tasks").update({ description }).eq("id", taskId).select();
      if (error) throw error;
      updateTaskInCollections(taskId, (task) => ({ ...task, description }));
      toast({ title: "Beschreibung aktualisiert" });
    } catch (error) {
      debugConsole.error("Error updating description:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  const handleUpdateDueDate = async (taskId: string, date: Date | null) => {
    try {
      const dueDate = date?.toISOString() || null;
      const { error } = await supabase.from("tasks").update({ due_date: dueDate }).eq("id", taskId).select();
      if (error) throw error;
      updateTaskInCollections(taskId, (task) => ({ ...task, due_date: dueDate }));
      toast({ title: "Frist aktualisiert" });
    } catch (error) {
      debugConsole.error("Error updating due date:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  const handleReminder = (taskId: string) => {
    setSnoozeTaskId(taskId);
    setSnoozeDialogOpen(true);
  };

  const clearSnoozeForTask = async (taskId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("task_snoozes").delete().eq("task_id", taskId).eq("user_id", userId);
    if (error) throw error;
  };

  const handleSetSnooze = async (date: Date) => {
    if (!snoozeTaskId || !userId) return;
    const targetTaskId = snoozeTaskId;

    try {
      const { data: existingSnooze } = await supabase
        .from("task_snoozes")
        .select("id")
        .eq("task_id", snoozeTaskId)
        .eq("user_id", userId)
        .single();

      if (existingSnooze) {
        const { error } = await supabase
          .from("task_snoozes")
          .update({ snoozed_until: date.toISOString() })
          .eq("id", existingSnooze.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("task_snoozes")
          .insert([{ user_id: userId, task_id: snoozeTaskId, snoozed_until: date.toISOString() }]);
        if (error) throw error;
      }

      toast({ title: "Wiedervorlage gesetzt" });
      setTaskSnoozes((prev) => ({ ...prev, [targetTaskId]: date.toISOString() }));
      setSnoozeDialogOpen(false);
      setSnoozeTaskId(null);
    } catch (error) {
      debugConsole.error("Error setting snooze:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleClearSnooze = async () => {
    if (!snoozeTaskId || !userId) return;
    const targetTaskId = snoozeTaskId;

    try {
      await clearSnoozeForTask(snoozeTaskId);
      toast({ title: "Wiedervorlage entfernt" });
      setTaskSnoozes((prev) => {
        const next = { ...prev };
        delete next[targetTaskId];
        return next;
      });
      setSnoozeDialogOpen(false);
      setSnoozeTaskId(null);
    } catch (error) {
      debugConsole.error("Error clearing snooze:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleQuickClearSnooze = async (taskId: string) => {
    try {
      await clearSnoozeForTask(taskId);
      toast({ title: "Wiedervorlage entfernt" });
      setTaskSnoozes((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    } catch (error) {
      debugConsole.error("Error clearing snooze:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleAssign = (taskId: string) => {
    const task = getTaskById(taskId);
    setAssignSelectedUserIds(normalizeAssignedTo(task?.assigned_to ?? null));
    setAssignTaskId(taskId);
    setAssignDialogOpen(true);
  };

  const handleUpdateAssignee = async (userIds: string[]) => {
    if (!assignTaskId || !userId) return;
    const normalizedAssignees = userIds.map((id) => id.trim()).filter(Boolean);
    const assignedToValue = normalizedAssignees.length > 0 ? normalizedAssignees.join(",") : null;

    const existingTask = getTaskById(assignTaskId);
    const previousAssignees = normalizeAssignedTo(existingTask?.assigned_to ?? null);
    const newlyAssignedUserIds = normalizedAssignees.filter((id) => id !== userId && !previousAssignees.includes(id));

    try {
      const { error } = await supabase.from("tasks").update({ assigned_to: assignedToValue }).eq("id", assignTaskId).select();
      if (error) throw error;

      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();

      await Promise.all(
        newlyAssignedUserIds.map((recipientUserId) =>
          notifyTaskShared({
            recipientUserId,
            senderName: senderProfile?.display_name,
            itemTitle: existingTask?.title,
            itemId: assignTaskId,
          })
        )
      );

      updateTaskInCollections(assignTaskId, (task) => ({ ...task, assigned_to: assignedToValue }));
      toast({ title: "Zuweisung aktualisiert" });
      setAssignDialogOpen(false);
      setAssignTaskId(null);
      setAssignSelectedUserIds([]);
    } catch (error) {
      debugConsole.error("Error updating assignee:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleComment = (taskId: string) => {
    setCommentTaskId(taskId);
    setCommentSidebarOpen(true);
  };

  const handleDecision = (taskId: string) => {
    setDecisionTaskId(taskId);
    setDecisionDialogOpen(true);
  };

  const handleDocuments = (taskId: string) => {
    setDocumentTaskId(taskId);
    setDocumentDialogOpen(true);
  };

  const handleAddToMeeting = (taskId: string) => {
    setMeetingTaskId(taskId);
    setMeetingSelectorOpen(true);
  };

  const handleSelectMeeting = async (meetingId: string, meetingTitle: string) => {
    if (!meetingTaskId || !userId) return;

    try {
      const { data, error } = await supabase
        .from("tasks")
        .update({ meeting_id: meetingId, pending_for_jour_fixe: false })
        .eq("id", meetingTaskId)
        .select();

      if (error) {
        debugConsole.error("Error adding task to meeting:", error);
        toast({ title: "Fehler", description: error.message || "Aufgabe konnte nicht zugeordnet werden.", variant: "destructive" });
        return;
      }

      if (!data || data.length === 0) {
        toast({ title: "Warnung", description: "Keine Aufgabe aktualisiert.", variant: "destructive" });
        return;
      }

      updateTaskInCollections(meetingTaskId, (task) => ({ ...task, meeting_id: meetingId, pending_for_jour_fixe: false }));
      toast({ title: `Aufgabe zu "${meetingTitle}" hinzugefügt` });
    } catch (error: unknown) {
      debugConsole.error("Error adding task to meeting:", error);
      toast({ title: "Fehler", description: error instanceof Error ? error.message : "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setMeetingTaskId(null);
      setMeetingSelectorOpen(false);
    }
  };

  const handleMarkForNextJourFixe = async () => {
    if (!meetingTaskId || !userId) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ pending_for_jour_fixe: true, meeting_id: null })
        .eq("id", meetingTaskId)
        .select();

      if (error) {
        debugConsole.error("Error marking task:", error);
        toast({ title: "Fehler", description: error.message || "Aufgabe konnte nicht vorgemerkt werden.", variant: "destructive" });
        return;
      }

      updateTaskInCollections(meetingTaskId, (task) => ({ ...task, pending_for_jour_fixe: true, meeting_id: null }));
      toast({ title: "Aufgabe für nächsten Jour Fixe vorgemerkt" });
    } catch (error: unknown) {
      debugConsole.error("Error marking task for next jour fixe:", error);
      toast({ title: "Fehler", description: error instanceof Error ? error.message : "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setMeetingTaskId(null);
      setMeetingSelectorOpen(false);
    }
  };

  const handleCreateChildTask = async (parentTaskId: string) => {
    if (!userId) return;

    const parentTask = getTaskById(parentTaskId);
    if (!parentTask?.tenant_id) {
      toast({ title: "Fehler", description: "Übergeordnete Aufgabe nicht gefunden.", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          user_id: userId,
          tenant_id: parentTask.tenant_id,
          parent_task_id: parentTaskId,
          title: "Neue Unteraufgabe",
          description: null,
          status: "todo",
          priority: DEFAULT_EDIT_PRIORITY,
          category: parentTask.category || DEFAULT_EDIT_CATEGORY,
          assigned_to: userId,
        }])
        .select("id, title, description, priority, status, due_date, assigned_to, user_id, created_at, category, meeting_id, pending_for_jour_fixe, parent_task_id, tenant_id")
        .single();

      if (error) throw error;
      if (!data) return;
      toast({ title: "Unteraufgabe erstellt" });
      setSubtasks((prev) => ({
        ...prev,
        [parentTaskId]: [...(prev[parentTaskId] || []), data],
      }));
    } catch (error) {
      debugConsole.error("Error creating child task:", error);
      toast({ title: "Fehler", description: "Unteraufgabe konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const openTaskEditDialog = (taskId: string) => {
    const task = getTaskById(taskId);
    if (!task) return;

    setEditingTaskId(taskId);
    setEditTaskTitle(task.title || "");
    setEditTaskDescription(toEditorHtml(task.description));
    setEditTaskPriority(task.priority || DEFAULT_EDIT_PRIORITY);
    setEditTaskStatus(task.status || DEFAULT_EDIT_STATUS);
    setEditTaskCategory(task.category || DEFAULT_EDIT_CATEGORY);
    setTaskEditDialogOpen(true);
  };

  const handleSaveTaskEdit = async () => {
    if (!editingTaskId) return;

    const updates = {
      title: editTaskTitle.trim() || "Ohne Titel",
      description: editTaskDescription || null,
      priority: editTaskPriority,
      status: editTaskStatus,
      category: editTaskCategory,
    };

    try {
      const { error } = await supabase.from("tasks").update(updates).eq("id", editingTaskId).select();
      if (error) throw error;
      updateTaskInCollections(editingTaskId, (task) => ({ ...task, ...updates }));
      toast({ title: "Aufgabe aktualisiert" });
      setTaskEditDialogOpen(false);
      setEditingTaskId(null);
    } catch (error) {
      debugConsole.error("Error updating task:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  const getChildTasks = (parentId: string) => subtasks[parentId] || [];

  const profileNameMap = useMemo(
    () => profiles.reduce((acc, profile) => {
      acc[profile.user_id] = profile.display_name || profile.user_id;
      return acc;
    }, {} as Record<string, string>),
    [profiles]
  );

  const resolveAssigneeName = (assignedTo: string | null | undefined) => {
    const assigneeIds = normalizeAssignedTo(assignedTo);
    if (assigneeIds.length === 0) return undefined;
    return assigneeIds.map((id) => profileNameMap[id] || id).join(", ");
  };

  return {
    availableTaskStatuses,
    availableTaskCategories,
    dialogState: {
      snoozeDialogOpen,
      setSnoozeDialogOpen,
      snoozeTaskId,
      assignDialogOpen,
      setAssignDialogOpen,
      assignSelectedUserIds,
      setAssignSelectedUserIds,
      commentSidebarOpen,
      setCommentSidebarOpen,
      commentTaskId,
      setCommentTaskId,
      decisionDialogOpen,
      setDecisionDialogOpen,
      decisionTaskId,
      setDecisionTaskId,
      documentDialogOpen,
      setDocumentDialogOpen,
      documentTaskId,
      setDocumentTaskId,
      meetingSelectorOpen,
      setMeetingSelectorOpen,
      meetingTaskId,
      setMeetingTaskId,
      taskEditDialogOpen,
      setTaskEditDialogOpen,
      editTaskTitle,
      setEditTaskTitle,
      editTaskDescription,
      setEditTaskDescription,
      editTaskPriority,
      setEditTaskPriority,
      editTaskStatus,
      setEditTaskStatus,
      editTaskCategory,
      setEditTaskCategory,
    },
    helpers: {
      getTaskTitle,
      getChildTasks,
      resolveAssigneeName,
    },
    actions: {
      handleToggleComplete,
      handleToggleSubtaskComplete,
      handleUpdateTitle,
      handleUpdateDescription,
      handleUpdateDueDate,
      handleReminder,
      handleSetSnooze,
      handleClearSnooze,
      handleQuickClearSnooze,
      handleAssign,
      handleUpdateAssignee,
      handleComment,
      handleDecision,
      handleDocuments,
      handleAddToMeeting,
      handleSelectMeeting,
      handleMarkForNextJourFixe,
      handleCreateChildTask,
      openTaskEditDialog,
      handleSaveTaskEdit,
    },
  };
}
