import { useState, useEffect } from "react";
import { X, Save, User, MessageCircle, Send, Edit2, Check, Trash2, Calendar, Clock, Flag, Tag, Upload, Paperclip, Download, Plus, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "completed";
  dueDate: string;
  category: "legislation" | "constituency" | "committee" | "personal" | "call_followup" | "call_follow_up";
  assignedTo?: string; // Changed from string[] to string
  progress?: number;
  call_log_id?: string;
}

interface TaskDocument {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
}

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
  };
}

interface Subtask {
  id: string;
  task_id: string;
  user_id: string;
  description: string;
  assigned_to?: string; // Changed from string[] to string
  due_date?: string;
  is_completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  result_text?: string;
  completed_at?: string;
}

interface TaskDetailSidebarProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate: (updatedTask: Task) => void;
  onTaskRestored: (restoredTask: Task) => void;
  taskCategories: Array<{ name: string; label: string }>;
  taskStatuses: Array<{ name: string; label: string }>;
}

export function TaskDetailSidebar({ 
  task, 
  isOpen, 
  onClose, 
  onTaskUpdate, 
  onTaskRestored,
  taskCategories, 
  taskStatuses 
}: TaskDetailSidebarProps) {
  const [editFormData, setEditFormData] = useState<Partial<Task>>({});
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingComment, setEditingComment] = useState<{ [commentId: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Array<{ user_id: string; display_name?: string }>>([]);
  const [taskDocuments, setTaskDocuments] = useState<TaskDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState({ description: '', assigned_to: '', due_date: '' });
  const [editingSubtask, setEditingSubtask] = useState<{ [id: string]: Partial<Subtask> }>({});
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
        .from('subtasks')
        .select('*, result_text, completed_at')
        .eq('task_id', taskId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setSubtasks((data || []).map(subtask => ({
        ...subtask,
        assigned_to: Array.isArray(subtask.assigned_to) ? subtask.assigned_to.join(',') : (subtask.assigned_to || '')
      })));
    } catch (error) {
      console.error('Error loading subtasks:', error);
    }
  };

  const loadTaskDocuments = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_documents')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTaskDocuments(data || []);
    } catch (error) {
      console.error('Error loading task documents:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTaskComments = async (taskId: string) => {
    try {
      const { data: comments, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const userIds = [...new Set(comments?.map(c => c.user_id) || [])];
      let profiles: any[] = [];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        
        profiles = profilesData || [];
      }

      const formattedComments: TaskComment[] = (comments || []).map(comment => ({
        id: comment.id,
        task_id: comment.task_id,
        user_id: comment.user_id,
        content: comment.content,
        created_at: comment.created_at,
        profile: profiles.find(p => p.user_id === comment.user_id) || null,
      }));

      setComments(formattedComments);
    } catch (error) {
      console.error('Error loading task comments:', error);
    }
  };

  const handleSave = async () => {
    if (!task) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editFormData.title,
          description: editFormData.description,
          priority: editFormData.priority,
          status: editFormData.status,
          due_date: editFormData.dueDate,
          category: editFormData.category,
          assigned_to: typeof editFormData.assignedTo === 'string' ? editFormData.assignedTo : (Array.isArray(editFormData.assignedTo) ? editFormData.assignedTo.join(',') : ''),
          progress: editFormData.progress,
        })
        .eq('id', task.id);

      if (error) throw error;

      const updatedTask: Task = {
        ...task,
        ...editFormData as Task,
      };

      onTaskUpdate(updatedTask);
      setEditFormData(updatedTask);

      toast({
        title: "Aufgabe gespeichert",
        description: "Die Änderungen wurden erfolgreich gespeichert.",
      });
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !task || !user) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: task.id,
          user_id: user.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      loadTaskComments(task.id);

      toast({
        title: "Kommentar hinzugefügt",
        description: "Ihr Kommentar wurde erfolgreich hinzugefügt.",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const updateComment = async (commentId: string, newContent: string) => {
    if (!newContent.trim()) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .update({ content: newContent.trim() })
        .eq('id', commentId);

      if (error) throw error;

      setEditingComment(prev => {
        const updated = { ...prev };
        delete updated[commentId];
        return updated;
      });

      loadTaskComments(task!.id);

      toast({
        title: "Kommentar aktualisiert",
        description: "Der Kommentar wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      loadTaskComments(task!.id);

      toast({
        title: "Kommentar gelöscht",
        description: "Der Kommentar wurde erfolgreich gelöscht.",
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !task || !user) return;

    setUploading(true);
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExtension}`;
      const filePath = `${user.id}/${task.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Add to database
      const { error: dbError } = await supabase
        .from('task_documents')
        .insert({
          task_id: task.id,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
        });

      if (dbError) throw dbError;

      loadTaskDocuments(task.id);
      
      toast({
        title: "Dokument hochgeladen",
        description: "Das Dokument wurde erfolgreich hinzugefügt.",
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Fehler",
        description: "Das Dokument konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const deleteDocument = async (doc: TaskDocument) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('task-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('task_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      loadTaskDocuments(task!.id);
      
      toast({
        title: "Dokument gelöscht",
        description: "Das Dokument wurde erfolgreich entfernt.",
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Fehler",
        description: "Das Dokument konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const downloadDocument = async (doc: TaskDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('task-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Fehler",
        description: "Das Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-government-gold text-white";
      case "low":
        return "bg-muted text-muted-foreground";
    }
  };

  const getCategoryColor = (category: Task["category"]) => {
    switch (category) {
      case "legislation":
        return "bg-primary text-primary-foreground";
      case "committee":
        return "bg-government-blue text-white";
      case "constituency":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "personal":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    }
  };

  const addSubtask = async () => {
    if (!newSubtask.description.trim() || !task || !user) return;

    try {
      const nextOrderIndex = Math.max(...subtasks.map(s => s.order_index), -1) + 1;
      
      const { error } = await supabase
        .from('subtasks')
        .insert({
          task_id: task.id,
          user_id: user.id,
          description: newSubtask.description.trim(),
          assigned_to: newSubtask.assigned_to || null,
          due_date: newSubtask.due_date || null,
          order_index: nextOrderIndex,
        });

      if (error) throw error;

      setNewSubtask({ description: '', assigned_to: '', due_date: '' });
      loadSubtasks(task.id);

      toast({
        title: "Unteraufgabe hinzugefügt",
        description: "Die Unteraufgabe wurde erfolgreich erstellt.",
      });
    } catch (error) {
      console.error('Error adding subtask:', error);
      toast({
        title: "Fehler",
        description: "Unteraufgabe konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const updateSubtask = async (subtaskId: string, updates: Partial<Subtask>) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('id', subtaskId);

      if (error) throw error;

      loadSubtasks(task!.id);
      
      // Remove from editing state
      setEditingSubtask(prev => {
        const updated = { ...prev };
        delete updated[subtaskId];
        return updated;
      });

      toast({
        title: "Unteraufgabe aktualisiert",
        description: "Die Änderungen wurden gespeichert.",
      });
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast({
        title: "Fehler",
        description: "Unteraufgabe konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const toggleSubtaskComplete = async (subtaskId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ is_completed: isCompleted })
        .eq('id', subtaskId);

      if (error) throw error;

      loadSubtasks(task!.id);
    } catch (error) {
      console.error('Error toggling subtask completion:', error);
      toast({
        title: "Fehler",
        description: "Status konnte nicht geändert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);

      if (error) throw error;

      loadSubtasks(task!.id);

      toast({
        title: "Unteraufgabe gelöscht",
        description: "Die Unteraufgabe wurde entfernt.",
      });
    } catch (error) {
      console.error('Error deleting subtask:', error);
      toast({
        title: "Fehler",
        description: "Unteraufgabe konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (!task) return null;

  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-background border-l shadow-xl z-50 transform transition-transform duration-300 ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Aufgaben-Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Task Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={editFormData.title || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={editFormData.description || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="priority">Priorität</Label>
                <Select value={editFormData.priority} onValueChange={(value) => setEditFormData(prev => ({ ...prev, priority: value as Task['priority'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={editFormData.status} onValueChange={(value) => setEditFormData(prev => ({ ...prev, status: value as Task['status'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskStatuses.map((status) => (
                      <SelectItem key={status.name} value={status.name}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="category">Kategorie</Label>
                <Select value={editFormData.category} onValueChange={(value) => setEditFormData(prev => ({ ...prev, category: value as Task['category'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskCategories.map((category) => (
                      <SelectItem key={category.name} value={category.name}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dueDate">Fälligkeitsdatum</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={editFormData.dueDate ? editFormData.dueDate.split('T')[0] : ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="assignedTo">Zugewiesen an</Label>
              <Select
                value={editFormData.assignedTo || 'unassigned'}
                onValueChange={(value) => setEditFormData(prev => ({ 
                  ...prev, 
                  assignedTo: value === 'unassigned' ? '' : value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Benutzer auswählen..." />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.display_name || 'Unbekannter Benutzer'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="progress">Fortschritt (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={editFormData.progress || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, progress: parseInt(e.target.value) || 0 }))}
              />
            </div>

            {/* Current badges */}
            <div className="flex flex-wrap gap-2">
              <Badge className={getPriorityColor(task.priority)} variant="secondary">
                <Flag className="h-3 w-3 mr-1" />
                {task.priority === "high" ? "Hoch" : task.priority === "medium" ? "Mittel" : "Niedrig"}
              </Badge>
              <Badge className={getCategoryColor(task.category)} variant="secondary">
                <Tag className="h-3 w-3 mr-1" />
                {taskCategories.find(c => c.name === task.category)?.label || task.category}
              </Badge>
              <Badge variant="outline">
                <Calendar className="h-3 w-3 mr-1" />
                {formatDate(task.dueDate)}
              </Badge>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>

          <Separator />

          {/* Subtasks Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                <h3 className="font-medium">Unteraufgaben ({subtasks.length})</h3>
              </div>
            </div>

            {/* Add new subtask */}
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="subtask-description">Beschreibung</Label>
                <Input
                  id="subtask-description"
                  placeholder="Neue Unteraufgabe..."
                  value={newSubtask.description}
                  onChange={(e) => setNewSubtask(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="subtask-assigned">Zuständig</Label>
                  <Select
                    value={newSubtask.assigned_to || 'unassigned'}
                    onValueChange={(value) => setNewSubtask(prev => ({ ...prev, assigned_to: value === 'unassigned' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.display_name || 'Unbekannter Benutzer'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="subtask-due">Fällig</Label>
                  <Input
                    id="subtask-due"
                    type="date"
                    value={newSubtask.due_date}
                    onChange={(e) => setNewSubtask(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
              </div>
              
              <Button onClick={addSubtask} size="sm" disabled={!newSubtask.description.trim()} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Unteraufgabe hinzufügen
              </Button>
            </div>

            {/* Existing subtasks */}
            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div key={subtask.id} className="p-3 bg-muted/30 rounded-lg">
                  {editingSubtask[subtask.id] ? (
                    <div className="space-y-3">
                      <Input
                        value={editingSubtask[subtask.id]?.description || subtask.description}
                        onChange={(e) => setEditingSubtask(prev => ({
                          ...prev,
                          [subtask.id]: { ...prev[subtask.id], description: e.target.value }
                        }))}
                        placeholder="Beschreibung..."
                      />
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={(() => {
                            const editing = editingSubtask[subtask.id]?.assigned_to;
                            return editing || subtask.assigned_to || 'unassigned';
                          })()}
                          onValueChange={(value) => setEditingSubtask(prev => ({
                            ...prev,
                            [subtask.id]: { ...prev[subtask.id], assigned_to: value === 'unassigned' ? '' : value }
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Zuständig" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.user_id} value={user.user_id}>
                                {user.display_name || 'Unbekannter Benutzer'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Input
                          type="date"
                          value={editingSubtask[subtask.id]?.due_date || (subtask.due_date ? subtask.due_date.split('T')[0] : '')}
                          onChange={(e) => setEditingSubtask(prev => ({
                            ...prev,
                            [subtask.id]: { ...prev[subtask.id], due_date: e.target.value }
                          }))}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateSubtask(subtask.id, editingSubtask[subtask.id])}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Speichern
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSubtask(prev => {
                            const updated = { ...prev };
                            delete updated[subtask.id];
                            return updated;
                          })}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={subtask.is_completed}
                        onChange={(e) => toggleSubtaskComplete(subtask.id, e.target.checked)}
                        className="mt-0.5"
                      />
                       <div className="flex-1">
                         <p className={`text-sm font-medium ${subtask.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                           {subtask.description}
                         </p>
                         {subtask.is_completed && subtask.result_text && (
                           <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border-l-4 border-green-500">
                             <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Ergebnis:</p>
                             <p className="text-sm text-green-800 dark:text-green-200">{subtask.result_text}</p>
                             {subtask.completed_at && (
                               <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                 Erledigt am: {new Date(subtask.completed_at).toLocaleDateString('de-DE', {
                                   day: '2-digit',
                                   month: '2-digit',
                                   year: 'numeric',
                                   hour: '2-digit',
                                   minute: '2-digit'
                                 })}
                               </p>
                             )}
                           </div>
                         )}
                           <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                             {subtask.assigned_to && subtask.assigned_to.trim() && (
                               <span>Zuständig: {users.find(u => u.user_id === subtask.assigned_to)?.display_name || subtask.assigned_to}</span>
                             )}
                            {subtask.due_date && (
                              <span>Fällig: {formatDate(subtask.due_date)}</span>
                            )}
                          </div>
                       </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => setEditingSubtask(prev => ({
                            ...prev,
                            [subtask.id]: {
                              description: subtask.description,
                              assigned_to: subtask.assigned_to,
                              due_date: subtask.due_date
                            }
                          }))}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteSubtask(subtask.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {subtasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Noch keine Unteraufgaben erstellt
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Documents Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                <h3 className="font-medium">Dokumente ({taskDocuments.length})</h3>
              </div>
              <div className="relative">
                <input
                  type="file"
                  id="document-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => document.getElementById('document-upload')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Dokument hinzufügen'}
                </Button>
              </div>
            </div>

            {/* Documents List */}
            <div className="space-y-2">
              {taskDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.file_name}</p>
                      {doc.file_size && (
                        <p className="text-xs text-muted-foreground">
                          {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => downloadDocument(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {doc.user_id === user?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteDocument(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {taskDocuments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Noch keine Dokumente hinzugefügt
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Comments Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <h3 className="font-medium">Kommentare ({comments.length})</h3>
            </div>

            {/* Add new comment */}
            <div className="space-y-2">
              <Textarea
                placeholder="Kommentar hinzufügen..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
              />
              <Button onClick={addComment} size="sm" disabled={!newComment.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Senden
              </Button>
            </div>

            {/* Existing comments */}
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {comment.profile?.display_name || 'Unbekannter Nutzer'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.created_at).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {/* Edit/Delete buttons for own comments */}
                        {comment.user_id === user?.id && (
                          <div className="flex gap-1">
                            {editingComment[comment.id] !== undefined ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => updateComment(comment.id, editingComment[comment.id])}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setEditingComment(prev => {
                                    const updated = { ...prev };
                                    delete updated[comment.id];
                                    return updated;
                                  })}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setEditingComment(prev => ({
                                    ...prev,
                                    [comment.id]: comment.content
                                  }))}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => deleteComment(comment.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {editingComment[comment.id] !== undefined ? (
                        <Textarea
                          value={editingComment[comment.id]}
                          onChange={(e) => setEditingComment(prev => ({
                            ...prev,
                            [comment.id]: e.target.value
                          }))}
                          className="text-sm"
                          rows={2}
                        />
                      ) : (
                        <p className="text-sm">{comment.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
