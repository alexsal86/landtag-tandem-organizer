import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLetterArchiving } from "@/hooks/useLetterArchiving";
import type { Tenant } from "@/hooks/useTenant";
import type { Document, DocumentFolder, Letter, ParentTaskOption } from "../types";
import {
  type DocumentActionResult,
  type DocumentMutationInput,
  toArchivableLetterRecord,
} from "../operationsContract";
import { debugConsole } from "@/utils/debugConsole";

interface UseDocumentOperationsProps {
  user: User | null;
  currentTenant: Tenant | null;
  fetchDocuments: () => Promise<void>;
  fetchFolders: () => Promise<void>;
  fetchLetters: () => Promise<void>;
  activeTab: string;
  letters: Letter[];
}

interface UploadHandlerArgs {
  uploadFile: File | null;
  mutation: Extract<DocumentMutationInput, { type: "upload" }>;
  setLoading: (v: boolean) => void;
  onSuccess: () => void;
}

interface UpdateHandlerArgs {
  editingDocument: Document | null;
  mutation: Extract<DocumentMutationInput, { type: "update" }>;
  onSuccess: () => void;
}

interface CreateFolderArgs {
  mutation: Extract<DocumentMutationInput, { type: "create-folder" }>;
  onSuccess: () => void;
}

export interface UseDocumentOperationsResult {
  handleDownload: (document: Document) => Promise<void>;
  handleDelete: (document: Document) => Promise<DocumentActionResult>;
  handleUpload: (args: UploadHandlerArgs) => Promise<DocumentActionResult>;
  handleUpdateDocument: (args: UpdateHandlerArgs) => Promise<DocumentActionResult>;
  handleCreateFolder: (args: CreateFolderArgs) => Promise<DocumentActionResult>;
  handleDeleteFolder: (folderId: string, folders: DocumentFolder[]) => Promise<DocumentActionResult>;
  handleMoveDocument: (
    selectedDocument: Document | null,
    mutation: Extract<DocumentMutationInput, { type: "move-document" }>,
    onSuccess: () => void,
  ) => Promise<DocumentActionResult>;
  handleEditLetter: (letter: Letter) => void;
  handleDeleteLetter: (letterId: string) => Promise<DocumentActionResult>;
  handleArchiveLetter: (letterId: string) => Promise<DocumentActionResult>;
  handleRestoreLetter: (letterId: string) => Promise<DocumentActionResult>;
  isArchiving: boolean;
  taskDialogMode: "task" | "subtask" | null;
  taskTitle: string;
  setTaskTitle: (v: string) => void;
  taskDescription: string;
  setTaskDescription: (v: string) => void;
  parentTaskId: string;
  setParentTaskId: (v: string) => void;
  availableParentTasks: ParentTaskOption[];
  isCreatingTask: boolean;
  openTaskDialog: (letter: Letter, mode: "task" | "subtask") => Promise<void>;
  closeTaskDialog: () => void;
  createTaskFromLetter: () => Promise<void>;
}

const errMsg = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useDocumentOperations({
  user,
  currentTenant,
  fetchDocuments,
  fetchFolders,
  fetchLetters,
  activeTab,
  letters,
}: UseDocumentOperationsProps): UseDocumentOperationsResult {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { archiveLetter, isArchiving } = useLetterArchiving();

  const [taskDialogMode, setTaskDialogMode] = useState<"task" | "subtask" | null>(null);
  const [sourceLetterForTask, setSourceLetterForTask] = useState<Letter | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [parentTaskId, setParentTaskId] = useState("none");
  const [availableParentTasks, setAvailableParentTasks] = useState<ParentTaskOption[]>([]);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const handleDownload = async (document: Document): Promise<void> => {
    try {
      const { data, error } = await supabase.storage.from("documents").download(document.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.file_name;
      window.document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      window.document.body.removeChild(link);
    } catch (error: unknown) {
      toast({ title: "Download-Fehler", description: errMsg(error), variant: "destructive" });
    }
  };

  const handleDelete = async (document: Document): Promise<DocumentActionResult> => {
    if (!confirm("Sind Sie sicher, dass Sie dieses Dokument löschen möchten?")) return { success: false, message: "Abgebrochen" };
    try {
      if (document.document_type !== "archived_letter") {
        const { error: storageError } = await supabase.storage.from("documents").remove([document.file_path]);
        if (storageError) debugConsole.warn("Storage deletion error:", storageError);
      }
      const { error: dbError } = await supabase.from("documents").delete().eq("id", document.id);
      if (dbError) throw dbError;
      toast({ title: "Dokument gelöscht", description: "Das Dokument wurde erfolgreich entfernt." });
      if (activeTab === "documents") await fetchDocuments();
      return { success: true };
    } catch (error: unknown) {
      toast({ title: "Lösch-Fehler", description: errMsg(error), variant: "destructive" });
      return { success: false, message: errMsg(error) };
    }
  };

  const handleUpload = async ({ uploadFile, mutation, setLoading, onSuccess }: UploadHandlerArgs): Promise<DocumentActionResult> => {
    if (!uploadFile) return { success: false, message: "Datei fehlt" };
    if (!mutation.title.trim()) return { success: false, message: "Titel fehlt" };
    if (!user) return { success: false, message: "Authentifizierung fehlt" };

    setLoading(true);
    try {
      const fileExt = uploadFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, uploadFile);
      if (uploadError) throw uploadError;

      const { data: documentData, error: dbError } = await supabase
        .from("documents")
        .insert([
          {
            user_id: user.id,
            tenant_id: currentTenant?.id || "",
            title: mutation.title,
            description: mutation.description,
            file_name: uploadFile.name,
            file_path: fileName,
            file_size: uploadFile.size,
            file_type: uploadFile.type,
            category: mutation.category,
            tags: mutation.tags,
            status: mutation.status,
            folder_id: mutation.folderId || null,
          },
        ])
        .select()
        .single();
      if (dbError) throw dbError;

      if (mutation.contacts.length > 0 && documentData) {
        const contactLinks = mutation.contacts.map((contactId) => ({
          document_id: documentData.id,
          contact_id: contactId,
          relationship_type: mutation.contactType,
          created_by: user.id,
        }));
        await supabase.from("document_contacts").insert(contactLinks);
      }

      toast({ title: "Dokument hochgeladen", description: "Das Dokument wurde erfolgreich gespeichert." });
      onSuccess();
      if (activeTab === "documents") {
        await fetchDocuments();
        await fetchFolders();
      }
      return { success: true };
    } catch (error: unknown) {
      toast({ title: "Upload-Fehler", description: errMsg(error), variant: "destructive" });
      return { success: false, message: errMsg(error) };
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDocument = async ({ editingDocument, mutation, onSuccess }: UpdateHandlerArgs): Promise<DocumentActionResult> => {
    if (!editingDocument) return { success: false, message: "Kein Dokument gewählt" };
    try {
      const { error } = await supabase
        .from("documents")
        .update({
          title: mutation.title,
          description: mutation.description,
          category: mutation.category,
          tags: mutation.tags,
          status: mutation.status,
          folder_id: mutation.folderId || null,
        })
        .eq("id", editingDocument.id);
      if (error) throw error;
      toast({ title: "Dokument aktualisiert" });
      onSuccess();
      await fetchDocuments();
      return { success: true };
    } catch (error: unknown) {
      toast({ title: "Fehler", description: errMsg(error), variant: "destructive" });
      return { success: false, message: errMsg(error) };
    }
  };

  const handleCreateFolder = async ({ mutation, onSuccess }: CreateFolderArgs): Promise<DocumentActionResult> => {
    if (!mutation.name || !user || !currentTenant) return { success: false, message: "Ungültige Eingabe" };
    try {
      const { error } = await supabase.from("document_folders").insert([
        {
          user_id: user.id,
          tenant_id: currentTenant.id,
          name: mutation.name,
          description: mutation.description,
          parent_folder_id: mutation.parentFolderId,
          color: mutation.color,
        },
      ]);
      if (error) throw error;
      toast({ title: "Ordner erstellt", description: `Der Ordner "${mutation.name}" wurde erfolgreich erstellt.` });
      onSuccess();
      await fetchFolders();
      return { success: true };
    } catch (error: unknown) {
      toast({ title: "Fehler", description: errMsg(error), variant: "destructive" });
      return { success: false, message: errMsg(error) };
    }
  };

  const handleDeleteFolder = async (folderId: string, folders: DocumentFolder[]): Promise<DocumentActionResult> => {
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) return { success: false, message: "Ordner nicht gefunden" };
    if (folder.documentCount && folder.documentCount > 0) {
      toast({ title: "Ordner nicht leer", description: "Bitte verschieben oder löschen Sie zuerst alle Dokumente.", variant: "destructive" });
      return { success: false, message: "Ordner nicht leer" };
    }
    if (!confirm(`Möchten Sie den Ordner "${folder.name}" wirklich löschen?`)) return { success: false, message: "Abgebrochen" };

    try {
      const { error } = await supabase.from("document_folders").delete().eq("id", folderId);
      if (error) throw error;
      toast({ title: "Ordner gelöscht" });
      await fetchFolders();
      return { success: true };
    } catch (error: unknown) {
      toast({ title: "Fehler", description: errMsg(error), variant: "destructive" });
      return { success: false, message: errMsg(error) };
    }
  };

  const handleMoveDocument = async (
    selectedDocument: Document | null,
    mutation: Extract<DocumentMutationInput, { type: "move-document" }>,
    onSuccess: () => void,
  ): Promise<DocumentActionResult> => {
    if (!selectedDocument) return { success: false, message: "Kein Dokument gewählt" };
    try {
      const { error } = await supabase.from("documents").update({ folder_id: mutation.folderId || null }).eq("id", selectedDocument.id);
      if (error) throw error;
      toast({ title: "Dokument verschoben" });
      onSuccess();
      await fetchDocuments();
      await fetchFolders();
      return { success: true };
    } catch (error: unknown) {
      toast({ title: "Fehler", description: errMsg(error), variant: "destructive" });
      return { success: false, message: errMsg(error) };
    }
  };

  const handleEditLetter = (letter: Letter) => navigate(`/letters/${letter.id}`);

  const handleDeleteLetter = async (letterId: string): Promise<DocumentActionResult> => {
    if (!confirm("Möchten Sie diesen Brief wirklich löschen?")) return { success: false, message: "Abgebrochen" };
    try {
      const { error } = await supabase.from("letters").delete().eq("id", letterId);
      if (error) throw error;
      toast({ title: "Brief gelöscht" });
      await fetchLetters();
      return { success: true };
    } catch {
      toast({ title: "Fehler", description: "Der Brief konnte nicht gelöscht werden.", variant: "destructive" });
      return { success: false, message: "Der Brief konnte nicht gelöscht werden." };
    }
  };

  const handleArchiveLetter = async (letterId: string): Promise<DocumentActionResult> => {
    if (!confirm("Möchten Sie diesen Brief archivieren?")) return { success: false, message: "Abgebrochen" };
    const letter = letters.find((entry) => entry.id === letterId);
    if (!letter) {
      toast({ title: "Fehler", description: "Brief nicht gefunden.", variant: "destructive" });
      return { success: false, message: "Brief nicht gefunden" };
    }

    const archivableLetter = toArchivableLetterRecord(letter);
    if (!archivableLetter) {
      toast({ title: "Fehler", description: "Brief-ID fehlt.", variant: "destructive" });
      return { success: false, message: "Brief-ID fehlt" };
    }

    const success = await archiveLetter(archivableLetter);
    if (success) {
      await fetchLetters();
      if (activeTab === "documents") await fetchDocuments();
      return { success: true };
    }

    return { success: false, message: "Archivierung fehlgeschlagen" };
  };

  const handleRestoreLetter = async (letterId: string): Promise<DocumentActionResult> => {
    if (!confirm("Möchten Sie diesen Brief wieder aktivieren?")) return { success: false, message: "Abgebrochen" };
    try {
      const { error } = await supabase
        .from("letters")
        .update({ status: "draft", archived_at: null, archived_by: null })
        .eq("id", letterId);
      if (error) throw error;
      toast({ title: "Brief wiederhergestellt" });
      await fetchLetters();
      return { success: true };
    } catch {
      toast({ title: "Fehler", description: "Der Brief konnte nicht wiederhergestellt werden.", variant: "destructive" });
      return { success: false, message: "Der Brief konnte nicht wiederhergestellt werden." };
    }
  };

  const openTaskDialog = async (letter: Letter, mode: "task" | "subtask") => {
    setSourceLetterForTask(letter);
    setTaskDialogMode(mode);
    setTaskTitle(letter.title?.trim() || "Aufgabe aus Brief");
    setTaskDescription(letter.content?.trim() || "");
    setParentTaskId("none");

    if (mode === "subtask" && currentTenant) {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("tenant_id", currentTenant.id)
          .is("parent_task_id", null)
          .order("updated_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        setAvailableParentTasks((data || []) as ParentTaskOption[]);
      } catch {
        setAvailableParentTasks([]);
      }
    } else {
      setAvailableParentTasks([]);
    }
  };

  const closeTaskDialog = () => {
    setTaskDialogMode(null);
    setSourceLetterForTask(null);
    setTaskTitle("");
    setTaskDescription("");
    setParentTaskId("none");
    setAvailableParentTasks([]);
  };

  const createTaskFromLetter = async () => {
    if (!user || !currentTenant || !sourceLetterForTask || !taskDialogMode) return;
    if (!taskTitle.trim()) {
      toast({ title: "Titel fehlt", variant: "destructive" });
      return;
    }
    if (taskDialogMode === "subtask" && parentTaskId === "none") {
      toast({ title: "Übergeordnete Aufgabe fehlt", variant: "destructive" });
      return;
    }

    setIsCreatingTask(true);
    try {
      if (taskDialogMode === "task") {
        const { error } = await supabase.from("tasks").insert([
          {
            user_id: user.id,
            tenant_id: currentTenant.id,
            title: taskTitle.trim(),
            description: [taskDescription.trim(), sourceLetterForTask.id ? `[[letter:${sourceLetterForTask.id}]]` : ""]
              .filter(Boolean)
              .join("\n\n"),
            status: "todo",
            priority: "medium",
            category: "personal",
          },
        ]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert([
          {
            user_id: user.id,
            tenant_id: currentTenant.id,
            parent_task_id: parentTaskId,
            title: sourceLetterForTask.id ? `${taskTitle.trim()} [[letter:${sourceLetterForTask.id}]]` : taskTitle.trim(),
            description: taskDescription.trim() || null,
            status: "todo",
            priority: "medium",
            category: "personal",
            assigned_to: user.id,
          },
        ]);
        if (error) throw error;
      }
      toast({ title: taskDialogMode === "task" ? "Aufgabe erstellt" : "Unteraufgabe erstellt" });
      closeTaskDialog();
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    } finally {
      setIsCreatingTask(false);
    }
  };

  return {
    handleDownload,
    handleDelete,
    handleUpload,
    handleUpdateDocument,
    handleCreateFolder,
    handleDeleteFolder,
    handleMoveDocument,
    handleEditLetter,
    handleDeleteLetter,
    handleArchiveLetter,
    handleRestoreLetter,
    isArchiving,
    taskDialogMode,
    taskTitle,
    setTaskTitle,
    taskDescription,
    setTaskDescription,
    parentTaskId,
    setParentTaskId,
    availableParentTasks,
    isCreatingTask,
    openTaskDialog,
    closeTaskDialog,
    createTaskFromLetter,
  };
}
