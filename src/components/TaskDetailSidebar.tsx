import { useState, useEffect } from "react";
import { X, Save, User, MessageCircle, Send, Edit2, Check, Trash2, Calendar, Clock, Flag, Tag } from "lucide-react";
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
  category: "legislation" | "constituency" | "committee" | "personal";
  assignedTo?: string;
  progress?: number;
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

interface TaskDetailSidebarProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate: (updatedTask: Task) => void;
  taskCategories: Array<{ name: string; label: string }>;
  taskStatuses: Array<{ name: string; label: string }>;
}

export function TaskDetailSidebar({ 
  task, 
  isOpen, 
  onClose, 
  onTaskUpdate, 
  taskCategories, 
  taskStatuses 
}: TaskDetailSidebarProps) {
  const [editFormData, setEditFormData] = useState<Partial<Task>>({});
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingComment, setEditingComment] = useState<{ [commentId: string]: string }>({});
  const [saving, setSaving] = useState(false);
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
    }
  }, [task]);

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
          assigned_to: editFormData.assignedTo,
          progress: editFormData.progress,
        })
        .eq('id', task.id);

      if (error) throw error;

      const updatedTask: Task = {
        ...task,
        ...editFormData as Task,
      };

      onTaskUpdate(updatedTask);

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
              <Input
                id="assignedTo"
                value={editFormData.assignedTo || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
              />
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
