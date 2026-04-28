import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import { handleAppError } from "@/utils/errorHandler";
import type { AppUserRef } from "@/components/shared/featureDomainTypes";
import type { PlanningComment, PlanningSubtask, PlanningDocument, ChecklistItem } from "../types";

interface UseItemDetailsParams {
  user: AppUserRef | null;
  currentTenantId: string | undefined;
  selectedPlanningId: string | undefined;
  checklistItems: ChecklistItem[];
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}



interface NewSubtaskDraft {
  description: string;
  assigned_to: string;
  due_date: string;
}

export interface UseItemDetailsReturn {
  selectedItemId: string | null;
  setSelectedItemId: Dispatch<SetStateAction<string | null>>;
  itemComments: Record<string, PlanningComment[]>;
  itemSubtasks: Record<string, PlanningSubtask[]>;
  itemDocuments: Record<string, PlanningDocument[]>;
  newComment: string;
  setNewComment: Dispatch<SetStateAction<string>>;
  newSubtask: NewSubtaskDraft;
  setNewSubtask: Dispatch<SetStateAction<NewSubtaskDraft>>;
  uploading: boolean;
  editingComment: Record<string, string>;
  setEditingComment: Dispatch<SetStateAction<Record<string, string>>>;
  editingSubtask: Record<string, Partial<PlanningSubtask>>;
  setEditingSubtask: Dispatch<SetStateAction<Record<string, Partial<PlanningSubtask>>>>;
  expandedItems: Record<string, { subtasks: boolean; comments: boolean; documents: boolean }>;
  setExpandedItems: Dispatch<SetStateAction<Record<string, { subtasks: boolean; comments: boolean; documents: boolean }>>>;
  showItemSubtasks: Record<string, boolean>;
  setShowItemSubtasks: Dispatch<SetStateAction<Record<string, boolean>>>;
  showItemComments: Record<string, boolean>;
  setShowItemComments: Dispatch<SetStateAction<Record<string, boolean>>>;
  showItemDocuments: Record<string, boolean>;
  setShowItemDocuments: Dispatch<SetStateAction<Record<string, boolean>>>;
  completingSubtask: string | null;
  setCompletingSubtask: Dispatch<SetStateAction<string | null>>;
  completionResult: string;
  setCompletionResult: Dispatch<SetStateAction<string>>;
  addItemComment: () => Promise<void>;
  addItemSubtask: (description?: string, assignedTo?: string, dueDate?: string, itemId?: string) => Promise<void>;
  addItemCommentForItem: (itemId: string, comment: string) => Promise<void>;
  handleItemFileUpload: (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => Promise<void>;
  deleteItemDocument: (doc: PlanningDocument) => Promise<void>;
  downloadItemDocument: (doc: PlanningDocument) => Promise<void>;
  deleteItemComment: (comment: PlanningComment) => Promise<void>;
  handleSubtaskComplete: (subtaskId: string, isCompleted: boolean, result: string, itemId: string) => Promise<void>;
  updateItemComment: (commentId: string, newContent: string) => Promise<void>;
  loadItemSubtasks: (itemId: string) => Promise<void>;
  loadAllItemCounts: (items?: ChecklistItem[]) => Promise<void>;
}
export function useItemDetails({
  user,
  currentTenantId,
  selectedPlanningId,
  checklistItems,
  toast,
}: UseItemDetailsParams): UseItemDetailsReturn {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemComments, setItemComments] = useState<{ [itemId: string]: PlanningComment[] }>({});
  const [itemSubtasks, setItemSubtasks] = useState<{ [itemId: string]: PlanningSubtask[] }>({});
  const [itemDocuments, setItemDocuments] = useState<{ [itemId: string]: PlanningDocument[] }>({});
  const [newComment, setNewComment] = useState("");
  const [newSubtask, setNewSubtask] = useState({ description: '', assigned_to: 'unassigned', due_date: '' });
  const [uploading, setUploading] = useState(false);
  const [editingComment, setEditingComment] = useState<{ [commentId: string]: string }>({});
  const [editingSubtask, setEditingSubtask] = useState<{ [id: string]: Partial<PlanningSubtask> }>({});
  const [expandedItems, setExpandedItems] = useState<{ [itemId: string]: { subtasks: boolean; comments: boolean; documents: boolean } }>({});
  const [showItemSubtasks, setShowItemSubtasks] = useState<{ [itemId: string]: boolean }>({});
  const [showItemComments, setShowItemComments] = useState<{ [itemId: string]: boolean }>({});
  const [showItemDocuments, setShowItemDocuments] = useState<{ [itemId: string]: boolean }>({});
  const [completingSubtask, setCompletingSubtask] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState('');

  useEffect(() => {
    if (selectedItemId) {
      loadItemComments(selectedItemId);
      loadItemSubtasks(selectedItemId);
      loadItemDocuments(selectedItemId);
    }
  }, [selectedItemId]);

  const loadItemComments = async (itemId: string) => {
    try {
      const { data: comments, error } = await supabase.from('planning_item_comments').select('id, planning_item_id, user_id, content, created_at').eq('planning_item_id', itemId).order('created_at', { ascending: true });
      if (error) throw error;
      const userIds = [...new Set(comments?.map(c: Record<string, any> => c.user_id) || [])];
      let profiles: Array<{ user_id: string; display_name: string | null; avatar_url: string | null }> = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
        profiles = profilesData || [];
      }
      const formattedComments = (comments || []).map((comment: Record<string, any>) => ({ id: comment.id, planning_item_id: comment.planning_item_id, user_id: comment.user_id, content: comment.content, created_at: comment.created_at, profile: profiles.find(p => p.user_id === comment.user_id) || null })) as PlanningComment[];
      setItemComments(prev => ({ ...prev, [itemId]: formattedComments }));
    } catch (error) { handleAppError(error, { context: 'loadItemComments' }); }
  };

  const loadItemSubtasks = async (itemId: string) => {
    try {
      const { data, error } = await supabase.from('planning_item_subtasks').select('id, planning_item_id, title, is_completed, order_index, created_at').eq('planning_item_id', itemId).order('order_index', { ascending: true });
      if (error) throw error;
      setItemSubtasks(prev => ({ ...prev, [itemId]: (data || []) as PlanningSubtask[] }));
    } catch (error) { handleAppError(error, { context: 'loadItemSubtasks' }); }
  };

  const loadItemDocuments = async (itemId: string) => {
    try {
      const { data, error } = await supabase.from('planning_item_documents').select('id, planning_item_id, user_id, file_name, file_path, file_type, file_size, created_at').eq('planning_item_id', itemId).order('created_at', { ascending: false });
      if (error) throw error;
      setItemDocuments(prev => ({ ...prev, [itemId]: (data || []) as PlanningDocument[] }));
    } catch (error) { handleAppError(error, { context: 'loadItemDocuments' }); }
  };

  const addItemComment = async () => {
    if (!newComment.trim() || !selectedItemId || !user) return;
    try {
      const { error } = await supabase.from('planning_item_comments').insert([{ planning_item_id: selectedItemId, user_id: user.id, content: newComment.trim() }]);
      if (error) throw error;
      setNewComment('');
      loadItemComments(selectedItemId);
      loadAllItemCounts();
      toast({ title: "Kommentar hinzugefügt", description: "Ihr Kommentar wurde erfolgreich hinzugefügt." });
    } catch (error) { handleAppError(error, { context: 'addItemComment', toast: { fn: toast, title: 'Fehler', description: 'Kommentar konnte nicht hinzugefügt werden.' } }); }
  };

  const addItemCommentForItem = async (itemId: string, comment: string) => {
    if (!comment.trim() || !user) return;
    try {
      const { error } = await supabase.from('planning_item_comments').insert([{ planning_item_id: itemId, user_id: user.id, content: comment.trim() }]);
      if (error) throw error;
      loadItemComments(itemId);
      loadAllItemCounts();
      toast({ title: "Kommentar hinzugefügt", description: "Ihr Kommentar wurde erfolgreich hinzugefügt." });
    } catch (error) { handleAppError(error, { context: 'addItemCommentForItem', toast: { fn: toast, title: 'Fehler', description: 'Kommentar konnte nicht hinzugefügt werden.' } }); }
  };

  const addItemSubtask = async (description?: string, assignedTo?: string, dueDate?: string, itemId?: string) => {
    const desc = description || newSubtask.description.trim();
    const assigned = assignedTo || newSubtask.assigned_to;
    const due = dueDate || newSubtask.due_date;
    const planningItemId = itemId || selectedItemId;
    if (!desc || !planningItemId || !user) return;

    try {
      const currentSubtasks = itemSubtasks[planningItemId] || [];
      const nextOrderIndex = Math.max(...currentSubtasks.map(s => s.order_index), -1) + 1;
      const { error } = await supabase.from('planning_item_subtasks').insert([{ planning_item_id: planningItemId, user_id: user.id, description: desc, assigned_to: assigned === 'unassigned' ? null : assigned, due_date: due || null, order_index: nextOrderIndex }]);
      if (error) throw error;
      setNewSubtask({ description: '', assigned_to: 'unassigned', due_date: '' });
      loadItemSubtasks(planningItemId);
      loadAllItemCounts();
      toast({ title: "Unteraufgabe hinzugefügt", description: "Die Unteraufgabe wurde erfolgreich erstellt." });
    } catch (error) { handleAppError(error, { context: 'addItemSubtask', toast: { fn: toast, title: 'Fehler', description: 'Unteraufgabe konnte nicht hinzugefügt werden.' } }); }
  };

  const handleSubtaskComplete = async (subtaskId: string, isCompleted: boolean, result: string, itemId: string) => {
    try {
      const updateData = isCompleted
        ? { is_completed: true, result_text: result || null, completed_at: new Date().toISOString() }
        : { is_completed: false, result_text: null, completed_at: null };
      const { error } = await supabase.from('planning_item_subtasks').update(updateData).eq('id', subtaskId);
      if (error) throw error;
      loadItemSubtasks(itemId);
      loadAllItemCounts();
      if (isCompleted) toast({ title: "Unteraufgabe abgeschlossen", description: "Die Unteraufgabe wurde erfolgreich als erledigt markiert." });
    } catch (error) { handleAppError(error, { context: 'handleSubtaskComplete', toast: { fn: toast, title: 'Fehler', description: 'Unteraufgabe konnte nicht aktualisiert werden.' } }); }
  };

  const deleteItemComment = async (comment: PlanningComment) => {
    if (!user || comment.user_id !== user.id) return;
    try {
      const { error } = await supabase.from('planning_item_comments').delete().eq('id', comment.id);
      if (error) throw error;
      loadItemComments(comment.planning_item_id);
      loadAllItemCounts();
      toast({ title: "Kommentar gelöscht", description: "Der Kommentar wurde erfolgreich entfernt." });
    } catch (error) { handleAppError(error, { context: 'deleteItemComment', toast: { fn: toast, title: 'Fehler', description: 'Kommentar konnte nicht gelöscht werden.' } }); }
  };

  const updateItemComment = async (commentId: string, newContent: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('planning_item_comments').update({ content: newContent, updated_at: new Date().toISOString() }).eq('id', commentId).eq('user_id', user.id);
      if (error) throw error;
      const comment = Object.values(itemComments).flat().find(c => c.id === commentId);
      if (comment) { loadItemComments(comment.planning_item_id); loadAllItemCounts(); }
      setEditingComment(prev => ({ ...prev, [commentId]: '' }));
      toast({ title: "Kommentar aktualisiert", description: "Der Kommentar wurde erfolgreich bearbeitet." });
    } catch (error) { handleAppError(error, { context: 'updateItemComment', toast: { fn: toast, title: 'Fehler', description: 'Kommentar konnte nicht bearbeitet werden.' } }); }
  };

  const handleItemFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const file = event.target.files?.[0];
    if (!file || !user || !currentTenantId) return;
    setUploading(true);
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExtension}`;
      const filePath = `${currentTenantId}/planning-items/${itemId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('planning-documents').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('planning_item_documents').insert([{ planning_item_id: itemId, user_id: user.id, tenant_id: currentTenantId, file_name: file.name, file_path: filePath, file_size: file.size, file_type: file.type }]);
      if (dbError) throw dbError;
      loadItemDocuments(itemId);
      loadAllItemCounts();
      toast({ title: "Dokument hochgeladen", description: "Das Dokument wurde erfolgreich hinzugefügt." });
    } catch (error) {
      toast({ title: "Upload fehlgeschlagen", description: error instanceof Error ? error.message : "Das Dokument konnte nicht hochgeladen werden.", variant: "destructive" });
    } finally { setUploading(false); event.target.value = ''; }
  };

  const deleteItemDocument = async (doc: PlanningDocument) => {
    try {
      const { error: storageError } = await supabase.storage.from('planning-documents').remove([doc.file_path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from('planning_item_documents').delete().eq('id', doc.id);
      if (dbError) throw dbError;
      if (selectedItemId) loadItemDocuments(selectedItemId);
      loadAllItemCounts();
      toast({ title: "Dokument gelöscht", description: "Das Dokument wurde erfolgreich entfernt." });
    } catch (error) { handleAppError(error, { context: 'deleteItemDocument', toast: { fn: toast, title: 'Fehler', description: 'Das Dokument konnte nicht gelöscht werden.' } }); }
  };

  const downloadItemDocument = async (doc: PlanningDocument) => {
    try {
      const { data, error } = await supabase.storage.from('planning-documents').download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = doc.file_name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (error) { handleAppError(error, { context: 'downloadItemDocument', toast: { fn: toast, title: 'Fehler', description: 'Das Dokument konnte nicht heruntergeladen werden.' } }); }
  };

  const loadAllItemCounts = async (items?: ChecklistItem[]) => {
    if (!selectedPlanningId) return;
    try {
      const currentItems = items || checklistItems;
      const itemIds = currentItems.map(item => item.id);
      if (itemIds.length === 0) return;

      const { data: subtasksData } = await supabase.from('planning_item_subtasks').select('planning_item_id, id, description, is_completed, assigned_to, due_date, order_index, created_at, updated_at, result_text, completed_at, user_id').in('planning_item_id', itemIds);
      const subtasksMap: { [itemId: string]: PlanningSubtask[] } = {};
      (subtasksData || []).forEach((subtask: Record<string, any>) => {
        if (!subtasksMap[subtask.planning_item_id]) subtasksMap[subtask.planning_item_id] = [];
        subtasksMap[subtask.planning_item_id].push({ ...subtask, user_id: subtask.user_id || user?.id || '' });
      });
      setItemSubtasks(subtasksMap);

      const { data: commentsData } = await supabase.from('planning_item_comments').select('planning_item_id, id, content, user_id, created_at').in('planning_item_id', itemIds);
      const userIds = [...new Set(commentsData?.map(c: Record<string, any> => c.user_id) || [])];
      let profiles: Array<{ user_id: string; display_name: string | null; avatar_url: string | null }> = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
        profiles = profilesData || [];
      }
      const commentsMap: { [itemId: string]: PlanningComment[] } = {};
      (commentsData || []).forEach((comment: Record<string, any>) => {
        if (!commentsMap[comment.planning_item_id]) commentsMap[comment.planning_item_id] = [];
        commentsMap[comment.planning_item_id].push({ ...comment, profile: profiles.find(p => p.user_id === comment.user_id) || null });
      });
      setItemComments(commentsMap);

      const { data: documentsData } = await supabase.from('planning_item_documents').select('planning_item_id, id, file_name, file_path, file_size, file_type, created_at, user_id').in('planning_item_id', itemIds);
      const documentsMap: { [itemId: string]: PlanningDocument[] } = {};
      (documentsData || []).forEach((doc: Record<string, any>) => {
        if (!documentsMap[doc.planning_item_id]) documentsMap[doc.planning_item_id] = [];
        documentsMap[doc.planning_item_id].push({ ...doc, user_id: doc.user_id || user?.id || '' });
      });
      setItemDocuments(documentsMap);
    } catch (error) { handleAppError(error, { context: 'loadAllItemCounts' }); }
  };

  return {
    selectedItemId, setSelectedItemId,
    itemComments, itemSubtasks, itemDocuments,
    newComment, setNewComment,
    newSubtask, setNewSubtask,
    uploading,
    editingComment, setEditingComment,
    editingSubtask, setEditingSubtask,
    expandedItems, setExpandedItems,
    showItemSubtasks, setShowItemSubtasks,
    showItemComments, setShowItemComments,
    showItemDocuments, setShowItemDocuments,
    completingSubtask, setCompletingSubtask,
    completionResult, setCompletionResult,
    // Functions
    addItemComment, addItemSubtask, addItemCommentForItem,
    handleItemFileUpload, deleteItemDocument, downloadItemDocument,
    deleteItemComment, handleSubtaskComplete, updateItemComment,
    loadItemSubtasks, loadAllItemCounts,
  };
}
