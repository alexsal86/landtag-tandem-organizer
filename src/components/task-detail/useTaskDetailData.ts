import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import { useAuth } from "@/hooks/useAuth";
import type { Task, TaskComment, TaskDocument, Subtask } from "./types";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { normalizeTaskAssigneeIds, serializeLegacyTaskAssignees, syncTaskAssignees } from "@/lib/taskAssignees";

type TaskRow = Tables<"tasks">;
type TaskDocumentRow = Tables<"task_documents">;
type TaskCommentRow = Tables<"task_comments">;
type ProfileRow = Pick<Tables<"profiles">, "user_id" | "display_name" | "avatar_url">;
type TaskUpdate = TablesUpdate<"tasks">;

export function useTaskDetailData(task: Task | null) {
  const [editFormData, setEditFormData] = useState<Partial<Task>>({});
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newCommentEditorKey, setNewCommentEditorKey] = useState(0);
  const [editingComment, setEditingComment] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Array<{ user_id: string; display_name?: string }>>([]);
  const [taskDocuments, setTaskDocuments] = useState<TaskDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState({ description: "", assigned_to: "", due_date: "" });
  const [editingSubtask, setEditingSubtask] = useState<Record<string, Partial<Subtask>>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (task) {
      setEditFormData({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        category: task.category,
        assignedTo: task.assignedTo,
        progress: task.progress,
      });
      loadTaskComments(task.id);
      loadTaskDocuments(task.id);
      loadSubtasks(task.id);
    }
    loadUsers();
  }, [task]);

  const loadSubtasks = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, status, assigned_to, due_date, parent_task_id, created_at, updated_at, user_id, progress")
        .eq("parent_task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setSubtasks(
        (data ?? []).map((s: TaskRow, i: number) => ({
          id: s.id,
          task_id: s.parent_task_id ?? '',
          user_id: s.user_id,
          title: s.title,
          description: s.title || s.description || "",
          assigned_to: normalizeTaskAssigneeIds(s.assigned_to),
          due_date: s.due_date,
          is_completed: s.status === "completed",
          order_index: i,
          created_at: s.created_at,
          updated_at: s.updated_at,
          completed_at: s.status === "completed" ? s.updated_at : undefined,
        }))
      );
    } catch (e) {
      debugConsole.error("Error loading subtasks:", e);
    }
  };

  const loadTaskDocuments = async (taskId: string) => {
    try {
      const { data, error } = await supabase.from("task_documents").select("id, task_id, file_name, file_path, file_size, file_type, created_at").eq("task_id", taskId).order("created_at", { ascending: false });
      if (error) throw error;
      setTaskDocuments((data ?? []).map((document: TaskDocumentRow) => ({ ...document, file_size: document.file_size ?? undefined, file_type: document.file_type ?? undefined })));
    } catch (e) {
      debugConsole.error("Error loading task documents:", e);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name").order("display_name");
      if (error) throw error;
      setUsers((data ?? []).map((profile: Pick<ProfileRow, "user_id" | "display_name">) => ({ user_id: profile.user_id, display_name: profile.display_name ?? undefined })));
    } catch (e) {
      debugConsole.error("Error loading users:", e);
    }
  };

  const loadTaskComments = async (taskId: string) => {
    try {
      const { data: commentsData, error } = await supabase.from("task_comments").select("id, task_id, user_id, content, created_at").eq("task_id", taskId).order("created_at", { ascending: true });
      if (error) throw error;
      const userIds = [...new Set((commentsData ?? []).map((comment: TaskCommentRow) => comment.user_id))];
      let profiles: ProfileRow[] = [];
      if (userIds.length > 0) {
        const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
        profiles = data ?? [];
      }
      setComments(
        (commentsData ?? []).map((c: TaskCommentRow) => ({
          id: c.id,
          task_id: c.task_id,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
          profile: profiles.find((p) => p.user_id === c.user_id) || null,
        }))
      );
    } catch (e) {
      debugConsole.error("Error loading task comments:", e);
    }
  };

  const handleSave = async (onTaskUpdate: (t: Task) => void) => {
    if (!task) return;
    setSaving(true);
    try {
      const assigneeIds = normalizeTaskAssigneeIds(editFormData.assignedTo);
      const { error } = await supabase
        .from("tasks")
        .update({
          title: editFormData.title,
          description: editFormData.description,
          priority: editFormData.priority,
          status: editFormData.status,
          due_date: editFormData.dueDate,
          category: editFormData.category,
          assigned_to: serializeLegacyTaskAssignees(assigneeIds) || "",
          progress: editFormData.progress,
        } as TaskUpdate)
        .eq("id", task.id);

      if (!error) {
        await syncTaskAssignees({ taskId: task.id, assigneeIds, assignedBy: user?.id });
      }

      if (error) {
        const isNetwork = error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError") || error.message?.includes("TypeError");
        if (isNetwork) {
          setTimeout(async () => {
const { data: fresh } = await supabase.from("tasks").select("id, title").eq("id", task.id).single();
            if (fresh && fresh.title === editFormData.title) {
              toast({ title: "Aufgabe gespeichert", description: "Die Änderungen wurden erfolgreich gespeichert." });
              const updated = { ...task, ...(editFormData as Task) };
              setEditFormData(updated);
              try { onTaskUpdate(updated); } catch {}
            }
          }, 500);
          setSaving(false);
          return;
        }
        throw error;
      }

      const updated = { ...task, ...(editFormData as Task) };
      toast({ title: "Aufgabe gespeichert", description: "Die Änderungen wurden erfolgreich gespeichert." });
      setEditFormData(updated);
      try { onTaskUpdate(updated); } catch {}
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const isNetwork = msg?.includes("Failed to fetch") || msg?.includes("NetworkError") || msg?.includes("TypeError");
      if (isNetwork) {
        setTimeout(async () => {
const { data: fresh } = await supabase.from("tasks").select("id, title").eq("id", task.id).single();
           if (fresh && fresh.title === editFormData.title) {
            toast({ title: "Aufgabe gespeichert", description: "Die Änderungen wurden erfolgreich gespeichert." });
            const updated = { ...task, ...(editFormData as Task) };
            setEditFormData(updated);
            try { onTaskUpdate(updated); } catch {}
          }
        }, 500);
        setSaving(false);
        return;
      }
      debugConsole.error("Error saving task:", error);
      toast({ title: "Fehler", description: "Aufgabe konnte nicht gespeichert werden.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !task || !user) return;
    try {
      const { error } = await supabase.from("task_comments").insert([{ task_id: task.id, user_id: user.id, content: newComment.trim() }]);
      if (error) throw error;
      setNewComment("");
      setNewCommentEditorKey((p) => p + 1);
      loadTaskComments(task.id);
      toast({ title: "Kommentar hinzugefügt", description: "Ihr Kommentar wurde erfolgreich hinzugefügt." });
    } catch {
      toast({ title: "Fehler", description: "Kommentar konnte nicht hinzugefügt werden.", variant: "destructive" });
    }
  };

  const updateComment = async (commentId: string, newContent: string) => {
    if (!newContent.trim()) return;
    try {
      const { error } = await supabase.from("task_comments").update({ content: newContent.trim() }).eq("id", commentId);
      if (error) throw error;
      setEditingComment((p) => { const u = { ...p }; delete u[commentId]; return u; });
      loadTaskComments(task!.id);
      toast({ title: "Kommentar aktualisiert" });
    } catch {
      toast({ title: "Fehler", description: "Kommentar konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
      if (error) throw error;
      loadTaskComments(task!.id);
      toast({ title: "Kommentar gelöscht" });
    } catch {
      toast({ title: "Fehler", description: "Kommentar konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !task || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${task.id}/${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage.from("task-documents").upload(filePath, file);
      if (ue) throw ue;
      const { error: de } = await supabase.from("task_documents").insert([{ task_id: task.id, user_id: user.id, file_name: file.name, file_path: filePath, file_size: file.size, file_type: file.type }]);
      if (de) throw de;
      loadTaskDocuments(task.id);
      toast({ title: "Dokument hochgeladen" });
    } catch {
      toast({ title: "Fehler", description: "Das Dokument konnte nicht hochgeladen werden.", variant: "destructive" });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const deleteDocument = async (doc: TaskDocument) => {
    try {
      await supabase.storage.from("task-documents").remove([doc.file_path]);
      await supabase.from("task_documents").delete().eq("id", doc.id);
      loadTaskDocuments(task!.id);
      toast({ title: "Dokument gelöscht" });
    } catch {
      toast({ title: "Fehler", description: "Das Dokument konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const downloadDocument = async (doc: TaskDocument) => {
    try {
      const { data, error } = await supabase.storage.from("task-documents").download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Fehler", description: "Das Dokument konnte nicht heruntergeladen werden.", variant: "destructive" });
    }
  };

  const addSubtask = async () => {
    if (!newSubtask.description.trim() || !task || !user) return;
    try {
      const assigneeIds = normalizeTaskAssigneeIds(newSubtask.assigned_to || user.id);
      const { data: createdSubtask, error } = await supabase.from("tasks").insert([{
        parent_task_id: task.id,
        user_id: user.id,
        tenant_id: task.tenant_id ?? null,
        title: newSubtask.description.trim(),
        description: "",
        assigned_to: serializeLegacyTaskAssignees(assigneeIds) || user.id,
        due_date: newSubtask.due_date || null,
        status: "todo",
        priority: task.priority || "medium",
        category: task.category || "personal",
        progress: 0,
      }] as any).select("id").single();
      if (error) throw error;
      await syncTaskAssignees({ taskId: createdSubtask.id, assigneeIds, assignedBy: user.id });
      setNewSubtask({ description: "", assigned_to: "", due_date: "" });
      loadSubtasks(task.id);
      toast({ title: "Unteraufgabe hinzugefügt" });
    } catch {
      toast({ title: "Fehler", description: "Unteraufgabe konnte nicht hinzugefügt werden.", variant: "destructive" });
    }
  };

  const updateSubtask = async (subtaskId: string, updates: Partial<Subtask>) => {
    try {
      const u: TaskUpdate = {};
      if (updates.description !== undefined) u.title = updates.description;
      const nextAssigneeIds = updates.assigned_to !== undefined ? normalizeTaskAssigneeIds(updates.assigned_to) : undefined;
      if (nextAssigneeIds !== undefined) u.assigned_to = serializeLegacyTaskAssignees(nextAssigneeIds);
      if (updates.due_date !== undefined) u.due_date = updates.due_date;
      if (updates.is_completed !== undefined) { u.status = updates.is_completed ? "completed" : "todo"; u.progress = updates.is_completed ? 100 : 0; }
      const { error } = await supabase.from("tasks").update(u).eq("id", subtaskId);
      if (error) throw error;
      if (nextAssigneeIds !== undefined) {
        await syncTaskAssignees({ taskId: subtaskId, assigneeIds: nextAssigneeIds, assignedBy: user?.id });
      }
      loadSubtasks(task!.id);
      setEditingSubtask((p) => { const up = { ...p }; delete up[subtaskId]; return up; });
      toast({ title: "Unteraufgabe aktualisiert" });
    } catch {
      toast({ title: "Fehler", description: "Unteraufgabe konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const toggleSubtaskComplete = async (subtaskId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase.from("tasks").update({ status: isCompleted ? "completed" : "todo", progress: isCompleted ? 100 : 0 }).eq("id", subtaskId);
      if (error) throw error;
      loadSubtasks(task!.id);
    } catch {
      toast({ title: "Fehler", description: "Status konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", subtaskId);
      if (error) throw error;
      loadSubtasks(task!.id);
      toast({ title: "Unteraufgabe gelöscht" });
    } catch {
      toast({ title: "Fehler", description: "Unteraufgabe konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  return {
    editFormData, setEditFormData,
    comments, newComment, setNewComment, newCommentEditorKey, editingComment, setEditingComment,
    saving, users, taskDocuments, uploading, subtasks,
    newSubtask, setNewSubtask, editingSubtask, setEditingSubtask,
    user,
    handleSave, addComment, updateComment, deleteComment,
    handleFileUpload, deleteDocument, downloadDocument,
    addSubtask, updateSubtask, toggleSubtaskComplete, deleteSubtask,
  };
}
