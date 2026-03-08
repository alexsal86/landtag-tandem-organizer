import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLetterArchiving } from "@/hooks/useLetterArchiving";
import type { Document, Letter, ParentTaskOption } from "../types";

interface UseDocumentOperationsProps {
  user: any;
  currentTenant: any;
  fetchDocuments: () => Promise<void>;
  fetchFolders: () => Promise<void>;
  fetchLetters: () => Promise<void>;
  activeTab: string;
  letters: Letter[];
}

export function useDocumentOperations({
  user, currentTenant, fetchDocuments, fetchFolders, fetchLetters, activeTab, letters
}: UseDocumentOperationsProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { archiveLetter, isArchiving } = useLetterArchiving();

  // Task from letter state
  const [taskDialogMode, setTaskDialogMode] = useState<'task' | 'subtask' | null>(null);
  const [sourceLetterForTask, setSourceLetterForTask] = useState<Letter | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [parentTaskId, setParentTaskId] = useState('none');
  const [availableParentTasks, setAvailableParentTasks] = useState<ParentTaskOption[]>([]);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const handleDownload = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(document.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url; link.download = document.file_name;
      window.document.body.appendChild(link); link.click();
      URL.revokeObjectURL(url); window.document.body.removeChild(link);
    } catch (error: any) {
      toast({ title: "Download-Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (document: Document) => {
    if (!confirm('Sind Sie sicher, dass Sie dieses Dokument löschen möchten?')) return;
    try {
      if (document.document_type !== 'archived_letter') {
        const { error: storageError } = await supabase.storage.from('documents').remove([document.file_path]);
        if (storageError) console.warn('Storage deletion error:', storageError);
      }
      const { error: dbError } = await supabase.from('documents').delete().eq('id', document.id);
      if (dbError) throw dbError;
      toast({ title: "Dokument gelöscht", description: "Das Dokument wurde erfolgreich entfernt." });
      if (activeTab === 'documents') fetchDocuments();
    } catch (error: any) {
      toast({ title: "Lösch-Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleUpload = async (
    uploadFile: File | null, uploadTitle: string, uploadDescription: string,
    uploadCategory: string, uploadTags: string[], uploadStatus: string,
    uploadFolderId: string, uploadContacts: string[], uploadContactType: string,
    setLoading: (v: boolean) => void, onSuccess: () => void
  ) => {
    if (!uploadFile) { toast({ title: "Datei fehlt", description: "Bitte wählen Sie eine Datei aus.", variant: "destructive" }); return; }
    if (!uploadTitle.trim()) { toast({ title: "Titel fehlt", description: "Bitte geben Sie einen Titel ein.", variant: "destructive" }); return; }
    if (!user) { toast({ title: "Authentifizierung fehlt", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, uploadFile);
      if (uploadError) throw uploadError;

      const { data: documentData, error: dbError } = await supabase.from('documents').insert({
        user_id: user.id, tenant_id: currentTenant?.id || '', title: uploadTitle,
        description: uploadDescription, file_name: uploadFile.name, file_path: fileName,
        file_size: uploadFile.size, file_type: uploadFile.type, category: uploadCategory,
        tags: uploadTags, status: uploadStatus, folder_id: uploadFolderId || null,
      }).select().single();
      if (dbError) throw dbError;

      if (uploadContacts.length > 0 && documentData) {
        const contactLinks = uploadContacts.map(contactId => ({
          document_id: documentData.id, contact_id: contactId,
          relationship_type: uploadContactType, created_by: user.id,
        }));
        await supabase.from('document_contacts').insert(contactLinks);
      }

      toast({ title: "Dokument hochgeladen", description: "Das Dokument wurde erfolgreich gespeichert." });
      onSuccess();
      if (activeTab === 'documents') { fetchDocuments(); fetchFolders(); }
    } catch (error: any) {
      toast({ title: "Upload-Fehler", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDocument = async (
    editingDocument: Document | null, editTitle: string, editDescription: string,
    editCategory: string, editTags: string[], editStatus: string, editFolderId: string,
    onSuccess: () => void
  ) => {
    if (!editingDocument) return;
    try {
      const { error } = await supabase.from('documents').update({
        title: editTitle, description: editDescription, category: editCategory,
        tags: editTags, status: editStatus, folder_id: editFolderId || null,
      }).eq('id', editingDocument.id);
      if (error) throw error;
      toast({ title: "Dokument aktualisiert" });
      onSuccess();
      fetchDocuments();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  // Folder operations
  const handleCreateFolder = async (
    folderName: string, folderDescription: string, folderColor: string,
    currentFolder: string | null, onSuccess: () => void
  ) => {
    if (!folderName || !user || !currentTenant) return;
    try {
      const { error } = await supabase.from('document_folders').insert({
        user_id: user.id, tenant_id: currentTenant.id, name: folderName,
        description: folderDescription, parent_folder_id: currentFolder, color: folderColor,
      });
      if (error) throw error;
      toast({ title: "Ordner erstellt", description: `Der Ordner "${folderName}" wurde erfolgreich erstellt.` });
      onSuccess();
      fetchFolders();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteFolder = async (folderId: string, folders: any[]) => {
    const folder = folders.find((f: any) => f.id === folderId);
    if (!folder) return;
    if (folder.documentCount && folder.documentCount > 0) {
      toast({ title: "Ordner nicht leer", description: "Bitte verschieben oder löschen Sie zuerst alle Dokumente.", variant: "destructive" });
      return;
    }
    if (!confirm(`Möchten Sie den Ordner "${folder.name}" wirklich löschen?`)) return;
    try {
      const { error } = await supabase.from('document_folders').delete().eq('id', folderId);
      if (error) throw error;
      toast({ title: "Ordner gelöscht" });
      fetchFolders();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleMoveDocument = async (selectedDocument: Document | null, moveToFolderId: string, onSuccess: () => void) => {
    if (!selectedDocument) return;
    try {
      const { error } = await supabase.from('documents').update({ folder_id: moveToFolderId || null }).eq('id', selectedDocument.id);
      if (error) throw error;
      toast({ title: "Dokument verschoben" });
      onSuccess();
      fetchDocuments(); fetchFolders();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  // Letter operations
  const handleEditLetter = (letter: Letter) => navigate(`/letters/${letter.id}`);

  const handleDeleteLetter = async (letterId: string) => {
    if (!confirm('Möchten Sie diesen Brief wirklich löschen?')) return;
    try {
      const { error } = await supabase.from('letters').delete().eq('id', letterId);
      if (error) throw error;
      toast({ title: "Brief gelöscht" });
      fetchLetters();
    } catch (error: any) {
      toast({ title: "Fehler", description: "Der Brief konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const handleArchiveLetter = async (letterId: string) => {
    if (!confirm('Möchten Sie diesen Brief archivieren?')) return;
    const letter = letters.find(l => l.id === letterId);
    if (!letter) { toast({ title: "Fehler", description: "Brief nicht gefunden.", variant: "destructive" }); return; }
    const success = await archiveLetter(letter);
    if (success) { fetchLetters(); if (activeTab === 'documents') fetchDocuments(); }
  };

  const handleRestoreLetter = async (letterId: string) => {
    if (!confirm('Möchten Sie diesen Brief wieder aktivieren?')) return;
    try {
      const { error } = await supabase.from('letters').update({ status: 'draft', archived_at: null, archived_by: null }).eq('id', letterId);
      if (error) throw error;
      toast({ title: "Brief wiederhergestellt" });
      fetchLetters();
    } catch (error: any) {
      toast({ title: "Fehler", description: "Der Brief konnte nicht wiederhergestellt werden.", variant: "destructive" });
    }
  };

  // Task from letter
  const openTaskDialog = async (letter: Letter, mode: 'task' | 'subtask') => {
    setSourceLetterForTask(letter);
    setTaskDialogMode(mode);
    setTaskTitle(letter.title?.trim() || 'Aufgabe aus Brief');
    setTaskDescription(letter.content?.trim() || '');
    setParentTaskId('none');
    if (mode === 'subtask' && currentTenant) {
      try {
        const { data, error } = await supabase.from('tasks').select('id, title').eq('tenant_id', currentTenant.id).is('parent_task_id', null).order('updated_at', { ascending: false }).limit(100);
        if (error) throw error;
        setAvailableParentTasks((data || []) as ParentTaskOption[]);
      } catch { setAvailableParentTasks([]); }
    } else {
      setAvailableParentTasks([]);
    }
  };

  const closeTaskDialog = () => {
    setTaskDialogMode(null); setSourceLetterForTask(null);
    setTaskTitle(''); setTaskDescription('');
    setParentTaskId('none'); setAvailableParentTasks([]);
  };

  const createTaskFromLetter = async () => {
    if (!user || !currentTenant || !sourceLetterForTask || !taskDialogMode) return;
    if (!taskTitle.trim()) { toast({ title: 'Titel fehlt', variant: 'destructive' }); return; }
    if (taskDialogMode === 'subtask' && parentTaskId === 'none') { toast({ title: 'Übergeordnete Aufgabe fehlt', variant: 'destructive' }); return; }
    setIsCreatingTask(true);
    try {
      if (taskDialogMode === 'task') {
        const { error } = await supabase.from('tasks').insert({
          user_id: user.id, tenant_id: currentTenant.id, title: taskTitle.trim(),
          description: [taskDescription.trim(), sourceLetterForTask.id ? `[[letter:${sourceLetterForTask.id}]]` : ''].filter(Boolean).join('\n\n'),
          status: 'todo', priority: 'medium', category: 'personal',
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert({
          user_id: user.id, tenant_id: currentTenant.id, parent_task_id: parentTaskId,
          title: sourceLetterForTask.id ? `${taskTitle.trim()} [[letter:${sourceLetterForTask.id}]]` : taskTitle.trim(),
          description: taskDescription.trim() || null, status: 'todo', priority: 'medium', category: 'personal', assigned_to: user.id,
        });
        if (error) throw error;
      }
      toast({ title: taskDialogMode === 'task' ? 'Aufgabe erstellt' : 'Unteraufgabe erstellt' });
      closeTaskDialog();
    } catch { toast({ title: 'Fehler', variant: 'destructive' }); }
    finally { setIsCreatingTask(false); }
  };

  return {
    handleDownload, handleDelete, handleUpload, handleUpdateDocument,
    handleCreateFolder, handleDeleteFolder, handleMoveDocument,
    handleEditLetter, handleDeleteLetter, handleArchiveLetter, handleRestoreLetter,
    isArchiving,
    // Task from letter
    taskDialogMode, taskTitle, setTaskTitle, taskDescription, setTaskDescription,
    parentTaskId, setParentTaskId, availableParentTasks, isCreatingTask,
    openTaskDialog, closeTaskDialog, createTaskFromLetter,
  };
}
