import { useState, useEffect } from "react";
import { Plus, CheckSquare, Square, Clock, Flag, Calendar, User, Edit2, Archive, MessageCircle, Send, Filter, Trash2, Check, X, Paperclip, Download, ChevronDown, ChevronRight, ListTodo } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { TaskArchiveModal } from "./TaskArchiveModal";
import { TaskDetailSidebar } from "./TaskDetailSidebar";

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

interface Subtask {
  id: string;
  task_id: string;
  user_id: string;
  description: string;
  assigned_to?: string;
  due_date?: string;
  is_completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export function TasksView() {
  const [filter, setFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Task>>({});
  const [taskComments, setTaskComments] = useState<{ [taskId: string]: TaskComment[] }>({});
  const [newComment, setNewComment] = useState<{ [taskId: string]: string }>({});
  const [taskCategories, setTaskCategories] = useState<Array<{ name: string; label: string }>>([]);
  const [taskStatuses, setTaskStatuses] = useState<Array<{ name: string; label: string }>>([]);
  const [editingComment, setEditingComment] = useState<{ [commentId: string]: string }>({});
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState<Array<{ user_id: string; display_name?: string }>>([]);
  const [taskDocuments, setTaskDocuments] = useState<{ [taskId: string]: number }>({});
  const [taskDocumentDetails, setTaskDocumentDetails] = useState<{ [taskId: string]: any[] }>({});
  const [showDocumentsFor, setShowDocumentsFor] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<Array<{
    id: string;
    type: 'completed' | 'updated' | 'created';
    taskTitle: string;
    timestamp: string;
  }>>([]);
  const [subtaskCounts, setSubtaskCounts] = useState<{ [taskId: string]: number }>({});
  const [subtasks, setSubtasks] = useState<{ [taskId: string]: Subtask[] }>({});
  const [showSubtasksFor, setShowSubtasksFor] = useState<string | null>(null);
  const [assignedSubtasks, setAssignedSubtasks] = useState<Array<Subtask & { task_title: string }>>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load tasks from database
  useEffect(() => {
    loadTasks();
    loadRecentActivities();
    loadTaskConfiguration();
    loadUsers();
    loadTaskDocumentCounts();
    loadSubtaskCounts();
    loadAssignedSubtasks();
  }, []);

  const loadAssignedSubtasks = async () => {
    if (!user) return;
    
    try {
      // Get current user's profile to match assigned_to field
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const userName = profile?.display_name || user.email;

      const { data, error } = await supabase
        .from('subtasks')
        .select(`
          id,
          task_id,
          description,
          assigned_to,
          due_date,
          is_completed,
          order_index,
          created_at,
          updated_at,
          user_id,
          tasks!inner(title)
        `)
        .eq('assigned_to', userName)
        .eq('is_completed', false)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const formattedSubtasks = (data || []).map((subtask: any) => ({
        ...subtask,
        task_title: subtask.tasks?.title || 'Unbekannte Aufgabe'
      }));

      setAssignedSubtasks(formattedSubtasks);
    } catch (error) {
      console.error('Error loading assigned subtasks:', error);
    }
  };

  const loadSubtaskCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('task_id, id, description, assigned_to, due_date, is_completed, order_index, created_at, updated_at, user_id');

      if (error) throw error;

      // Group subtasks by task_id and count them
      const counts: { [taskId: string]: number } = {};
      const details: { [taskId: string]: Subtask[] } = {};
      
      (data || []).forEach(subtask => {
        if (!counts[subtask.task_id]) {
          counts[subtask.task_id] = 0;
          details[subtask.task_id] = [];
        }
        counts[subtask.task_id]++;
        details[subtask.task_id].push(subtask);
      });

      // Sort subtasks by order_index
      Object.keys(details).forEach(taskId => {
        details[taskId].sort((a, b) => a.order_index - b.order_index);
      });

      setSubtaskCounts(counts);
      setSubtasks(details);
    } catch (error) {
      console.error('Error loading subtask counts:', error);
    }
  };

  const loadTaskDocumentCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('task_documents')
        .select('task_id, id, file_name, file_path, file_size, created_at');

      if (error) throw error;

      // Group documents by task_id and count them
      const counts: { [taskId: string]: number } = {};
      const details: { [taskId: string]: any[] } = {};
      
      (data || []).forEach(doc => {
        if (!counts[doc.task_id]) {
          counts[doc.task_id] = 0;
          details[doc.task_id] = [];
        }
        counts[doc.task_id]++;
        details[doc.task_id].push(doc);
      });

      setTaskDocuments(counts);
      setTaskDocumentDetails(details);
    } catch (error) {
      console.error('Error loading task document counts:', error);
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

  // Load task categories and statuses from administration
  const loadTaskConfiguration = async () => {
    try {
      const [categoriesResult, statusesResult] = await Promise.all([
        supabase.from('task_categories').select('name, label').eq('is_active', true).order('order_index'),
        supabase.from('task_statuses').select('name, label').eq('is_active', true).order('order_index')
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (statusesResult.error) throw statusesResult.error;

      setTaskCategories(categoriesResult.data || []);
      setTaskStatuses(statusesResult.data || []);
    } catch (error) {
      console.error('Error loading task configuration:', error);
    }
  };

  const loadRecentActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, updated_at, created_at')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const activities = (data || []).slice(0, 3).map(task => {
        const isRecent = new Date(task.updated_at) > new Date(task.created_at);
        const timeDiff = Date.now() - new Date(task.updated_at).getTime();
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const timeString = hoursAgo < 1 ? 'vor wenigen Minuten' : 
                          hoursAgo === 1 ? 'vor 1 Stunde' : 
                          hoursAgo < 24 ? `vor ${hoursAgo} Stunden` : 
                          `vor ${Math.floor(hoursAgo / 24)} Tagen`;

        return {
          id: task.id,
          type: task.status === 'completed' ? 'completed' as const : 
                isRecent ? 'updated' as const : 'created' as const,
          taskTitle: task.title,
          timestamp: timeString,
        };
      });

      setRecentActivities(activities);
    } catch (error) {
      console.error('Error loading recent activities:', error);
    }
  };

  const loadTasks = async () => {
    try {
      // Get completed task IDs from archive to filter them out
      const { data: archivedTasks, error: archiveError } = await supabase
        .from('archived_tasks')
        .select('task_id');

      if (archiveError) throw archiveError;

      const archivedTaskIds = (archivedTasks || []).map(at => at.task_id);

      // Build the query to exclude archived tasks
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      // Only apply the filter if there are archived tasks
      if (archivedTaskIds.length > 0) {
        query = query.not('id', 'in', `(${archivedTaskIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Convert database format to component format
      const formattedTasks: Task[] = (data || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority as Task['priority'],
        status: task.status as Task['status'],
        dueDate: task.due_date,
        category: task.category as Task['category'],
        assignedTo: task.assigned_to || undefined,
        progress: task.progress || undefined,
      }));

      setTasks(formattedTasks);
      
      // Load comments for all tasks automatically
      formattedTasks.forEach(task => {
        loadTaskComments(task.id);
      });
      
      // Reload subtask counts after loading tasks
      loadSubtaskCounts();
      loadAssignedSubtasks();
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast({
        title: "Fehler",
        description: "Aufgaben konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Migrate sample data to database (run once)
  useEffect(() => {
    const migrateSampleData = async () => {
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('id')
        .limit(1);

      // Only migrate if no tasks exist
      if (!existingTasks || existingTasks.length === 0) {
        const sampleTasks = [
          {
            title: "Stellungnahme Verkehrsgesetz",
            description: "Überarbeitung der Stellungnahme zum neuen Verkehrsgesetz bis Freitag",
            priority: "high",
            status: "in-progress",
            due_date: new Date("2024-01-15").toISOString(),
            category: "legislation",
            assigned_to: "Max Kellner",
            progress: 65,
          },
          {
            title: "Vorbereitung Ausschusssitzung",
            description: "Unterlagen für die Bildungsausschuss-Sitzung vorbereiten",
            priority: "medium",
            status: "todo",
            due_date: new Date("2024-01-12").toISOString(),
            category: "committee",
            assigned_to: "Max Kellner",
          },
          {
            title: "Bürgersprechstunde auswerten",
            description: "Anliegen aus der gestrigen Bürgersprechstunde dokumentieren",
            priority: "low",
            status: "completed",
            due_date: new Date("2024-01-10").toISOString(),
            category: "constituency",
            assigned_to: "Max Kellner",
          },
          {
            title: "Pressemitteilung Umweltpolitik",
            description: "Entwurf für Pressemitteilung zur neuen Umweltinitiative",
            priority: "medium",
            status: "todo",
            due_date: new Date("2024-01-18").toISOString(),
            category: "personal",
            assigned_to: "Max Kellner",
          },
        ];

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const tasksWithUserId = sampleTasks.map(task => ({
            ...task,
            user_id: user.id,
          }));

          await supabase.from('tasks').insert(tasksWithUserId);
          loadTasks(); // Reload tasks after migration
        }
      }
    };

    migrateSampleData();
  }, []);

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

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "in-progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "todo":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
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

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && tasks.find(t => t.dueDate === dueDate)?.status !== "completed";
  };

  const filteredTasks = tasks.filter(task => {
    // Status filter
    let statusMatch = false;
    if (filter === "all") statusMatch = true;
    else if (filter === "pending") statusMatch = task.status !== "completed";
    else if (filter === "overdue") statusMatch = isOverdue(task.dueDate);
    else statusMatch = task.status === filter;

    // Category filter
    const categoryMatch = categoryFilter === "all" || task.category === categoryFilter;
    
    // Priority filter
    const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter;

    return statusMatch && categoryMatch && priorityMatch;
  });

  const toggleTaskStatus = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const newStatus = task.status === "completed" ? "todo" : "completed";
      
      // If marking as completed, archive the task
      if (newStatus === "completed") {
        await archiveTask(task);
      } else {
        // If unmarking as completed, just update the status
        const { error } = await supabase
          .from('tasks')
          .update({ status: newStatus })
          .eq('id', taskId);

        if (error) throw error;

        // Update local state
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, status: newStatus } : t
        ));
      }

      // Refresh recent activities
      loadRecentActivities();

      toast({
        title: "Aufgabe aktualisiert",
        description: `Status auf "${newStatus === "completed" ? "Erledigt und archiviert" : "Zu erledigen"}" geändert.`,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const archiveTask = async (task: Task) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get archive settings for auto-delete duration
      const { data: archiveSettings } = await supabase
        .from('task_archive_settings')
        .select('auto_delete_after_days')
        .eq('user_id', user.id)
        .single();

      // Insert into archived_tasks
      const { error: archiveError } = await supabase
        .from('archived_tasks')
        .insert({
          task_id: task.id,
          user_id: user.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          category: task.category,
          assigned_to: task.assignedTo,
          progress: task.progress,
          due_date: task.dueDate,
          auto_delete_after_days: archiveSettings?.auto_delete_after_days,
        });

      if (archiveError) throw archiveError;

      // Delete the task from the tasks table completely
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (deleteError) throw deleteError;

      // Remove from local tasks (since it's now deleted)
      setTasks(prev => prev.filter(t => t.id !== task.id));

    } catch (error) {
      console.error('Error archiving task:', error);
      throw error;
    }
  };

  const loadTaskComments = async (taskId: string) => {
    try {
      // Load comments and user profiles separately due to missing foreign key
      const { data: comments, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Load user profiles for comment authors
      const userIds = [...new Set(comments?.map(c => c.user_id) || [])];
      let profiles: any[] = [];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        
        profiles = profilesData || [];
      }

      // Combine comments with user data
      const formattedComments: TaskComment[] = (comments || []).map(comment => ({
        id: comment.id,
        task_id: comment.task_id,
        user_id: comment.user_id,
        content: comment.content,
        created_at: comment.created_at,
        profile: profiles.find(p => p.user_id === comment.user_id) || null,
      }));

      setTaskComments(prev => ({
        ...prev,
        [taskId]: formattedComments,
      }));
    } catch (error) {
      console.error('Error loading task comments:', error);
    }
  };

  const addComment = async (taskId: string) => {
    const content = newComment[taskId]?.trim();
    if (!content) return;

    try {
      if (!user) {
        toast({
          title: "Fehler",
          description: "Sie müssen angemeldet sein, um Kommentare zu schreiben.",
          variant: "destructive",
        });
        return;
      }


      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content,
        });

      if (error) {
        console.error('Supabase error:', error);
        toast({
          title: "Fehler",
          description: `Kommentar konnte nicht hinzugefügt werden: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Clear the comment input
      setNewComment(prev => ({ ...prev, [taskId]: '' }));

      // Reload comments
      loadTaskComments(taskId);

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

      // Update local state
      setTaskComments(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(taskId => {
          updated[taskId] = updated[taskId].map(comment =>
            comment.id === commentId ? { ...comment, content: newContent.trim() } : comment
          );
        });
        return updated;
      });

      setEditingComment(prev => {
        const updated = { ...prev };
        delete updated[commentId];
        return updated;
      });

      toast({
        title: "Kommentar aktualisiert",
        description: "Ihr Kommentar wurde erfolgreich bearbeitet.",
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht bearbeitet werden.",
        variant: "destructive",
      });
    }
  };

  const deleteComment = async (commentId: string, taskId: string) => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Update local state
      setTaskComments(prev => ({
        ...prev,
        [taskId]: prev[taskId]?.filter(comment => comment.id !== commentId) || []
      }));

      toast({
        title: "Kommentar gelöscht",
        description: "Der Kommentar wurde erfolgreich entfernt.",
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

  const toggleComments = (taskId: string) => {
    if (showCommentsFor === taskId) {
      setShowCommentsFor(null);
    } else {
      setShowCommentsFor(taskId);
      if (!taskComments[taskId]) {
        loadTaskComments(taskId);
      }
    }
  };

  const toggleSubtasks = (taskId: string) => {
    if (showSubtasksFor === taskId) {
      setShowSubtasksFor(null);
    } else {
      setShowSubtasksFor(taskId);
    }
  };

  const toggleDocuments = (taskId: string) => {
    if (showDocumentsFor === taskId) {
      setShowDocumentsFor(null);
    } else {
      setShowDocumentsFor(taskId);
    }
  };

  const handleDocumentDownload = async (doc: any) => {
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

  const handleDocumentDelete = async (doc: any) => {
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

      // Reload document counts
      loadTaskDocumentCounts();
      
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

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
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
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setSidebarOpen(true);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    loadTaskDocumentCounts(); // Reload document counts when task is updated
    loadRecentActivities();
  };

  const handleTaskRestored = (restoredTask: Task) => {
    // Add the specific restored task to the list instead of reloading everything
    setTasks(prev => {
      // Check if task already exists to avoid duplicates
      const existsIndex = prev.findIndex(t => t.id === restoredTask.id);
      if (existsIndex >= 0) {
        // Update existing task
        const updated = [...prev];
        updated[existsIndex] = restoredTask;
        return updated;
      } else {
        // Add new task to the beginning of the list
        return [restoredTask, ...prev];
      }
    });
    loadRecentActivities();
  };

  const handleSaveTask = async () => {
    if (!editingTask || !editFormData.title) return;

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
        .eq('id', editingTask.id);

      if (error) throw error;

      // Update local state
      setTasks(prev => prev.map(t => 
        t.id === editingTask.id ? { ...t, ...editFormData } : t
      ));

      setEditingTask(null);
      setEditFormData({});

      // Refresh recent activities
      loadRecentActivities();

      toast({
        title: "Aufgabe gespeichert",
        description: "Die Aufgabe wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const taskCounts = {
    all: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    inProgress: tasks.filter(t => t.status === "in-progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
    overdue: tasks.filter(t => isOverdue(t.dueDate)).length,
  };

  const filters = [
    { value: "all", label: "Alle Aufgaben", count: taskCounts.all },
    { value: "pending", label: "Offen", count: taskCounts.todo + taskCounts.inProgress },
    { value: "todo", label: "Zu erledigen", count: taskCounts.todo },
    { value: "in-progress", label: "In Bearbeitung", count: taskCounts.inProgress },
    { value: "completed", label: "Erledigt", count: taskCounts.completed },
    { value: "overdue", label: "Überfällig", count: taskCounts.overdue },
  ];

  return (
    <>
      <div className="min-h-screen bg-gradient-subtle p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Aufgaben</h1>
              <p className="text-muted-foreground">
                Verwalten Sie Ihre Aufgaben und To-Dos effizient
              </p>
            </div>
            <Button className="gap-2" onClick={() => window.location.href = '/tasks/new'}>
              <Plus className="h-4 w-4" />
              Neue Aufgabe
            </Button>
          </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto mb-4">
          {filters.map((filterOption) => (
            <Button
              key={filterOption.value}
              variant={filter === filterOption.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(filterOption.value)}
              className="whitespace-nowrap"
            >
              {filterOption.label} ({filterOption.count})
            </Button>
          ))}
        </div>

        {/* Advanced Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Zusätzliche Filter:</span>
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kategorien</SelectItem>
              <SelectItem value="legislation">Gesetzgebung</SelectItem>
              <SelectItem value="committee">Ausschuss</SelectItem>
              <SelectItem value="constituency">Wahlkreis</SelectItem>
              <SelectItem value="personal">Persönlich</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Priorität" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Prioritäten</SelectItem>
              <SelectItem value="high">Hoch</SelectItem>
              <SelectItem value="medium">Mittel</SelectItem>
              <SelectItem value="low">Niedrig</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assigned Subtasks Table */}
      {assignedSubtasks.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Mir zugewiesene Unteraufgaben ({assignedSubtasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unteraufgabe</TableHead>
                  <TableHead>Übergeordnete Aufgabe</TableHead>
                  <TableHead>Fälligkeitsdatum</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedSubtasks.map((subtask) => (
                  <TableRow key={subtask.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={subtask.is_completed}
                          onCheckedChange={async (checked) => {
                            try {
                              const { error } = await supabase
                                .from('subtasks')
                                .update({ is_completed: !!checked })
                                .eq('id', subtask.id);
                              
                              if (error) throw error;
                              
                              if (checked) {
                                setAssignedSubtasks(prev => prev.filter(s => s.id !== subtask.id));
                              }
                              
                              toast({
                                title: "Unteraufgabe aktualisiert",
                                description: checked ? "Unteraufgabe als erledigt markiert" : "Unteraufgabe als offen markiert",
                              });
                            } catch (error) {
                              console.error('Error updating subtask:', error);
                              toast({
                                title: "Fehler",
                                description: "Unteraufgabe konnte nicht aktualisiert werden.",
                                variant: "destructive",
                              });
                            }
                          }}
                        />
                        <span className="font-medium">{subtask.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{subtask.task_title}</span>
                    </TableCell>
                    <TableCell>
                      {subtask.due_date ? (
                        <span className={new Date(subtask.due_date) < new Date() ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {formatDate(subtask.due_date)}
                          {new Date(subtask.due_date) < new Date() && " (Überfällig)"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Keine Frist</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const parentTask = tasks.find(t => t.id === subtask.task_id);
                          if (parentTask) {
                            handleTaskClick(parentTask);
                          }
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Task List */}
        <div className="lg:col-span-3 space-y-4">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300 cursor-pointer"
              onClick={() => handleTaskClick(task)}
            >
              <CardContent className="p-6"
                onClick={(e) => {
                  // Prevent card click when interacting with form elements
                  if ((e.target as HTMLElement).closest('button, input, select, textarea, .checkbox')) {
                    e.stopPropagation();
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={() => toggleTaskStatus(task.id)}
                    />
                  </div>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className={`font-semibold text-lg ${
                        task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
                      }`}>
                        {task.title}
                      </h3>
                      <div className="flex gap-2 ml-4">
                        <Badge className={getCategoryColor(task.category)}>
                          {task.category === "legislation" && "Gesetzgebung"}
                          {task.category === "committee" && "Ausschuss"}
                          {task.category === "constituency" && "Wahlkreis"}
                          {task.category === "personal" && "Persönlich"}
                        </Badge>
                        
                        <Badge className={getStatusColor(task.status)}>
                          {task.status === "todo" && "Zu erledigen"}
                          {task.status === "in-progress" && "In Bearbeitung"}
                          {task.status === "completed" && "Erledigt"}
                        </Badge>

                        <Badge className={getPriorityColor(task.priority)}>
                          <Flag className="h-3 w-3 mr-1" />
                          {task.priority === "high" && "Hoch"}
                          {task.priority === "medium" && "Mittel"}
                          {task.priority === "low" && "Niedrig"}
                        </Badge>
                      </div>
                    </div>

                    <p className={`mb-4 ${
                      task.status === "completed" ? "text-muted-foreground" : "text-muted-foreground"
                    }`}>
                      {task.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span className={isOverdue(task.dueDate) ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {formatDate(task.dueDate)}
                          {isOverdue(task.dueDate) && " (Überfällig)"}
                        </span>
                      </div>


                       {/* Subtask count indicator */}
                       {subtaskCounts[task.id] > 0 && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={(e) => {
                             e.stopPropagation();
                             toggleSubtasks(task.id);
                           }}
                           className="gap-1 h-6 px-2 text-xs"
                         >
                           {showSubtasksFor === task.id ? (
                             <ChevronDown className="h-3 w-3" />
                           ) : (
                             <ChevronRight className="h-3 w-3" />
                           )}
                           <ListTodo className="h-3 w-3" />
                           <span>{subtaskCounts[task.id]} Unteraufgabe{subtaskCounts[task.id] !== 1 ? 'n' : ''}</span>
                         </Button>
                       )}

                       {/* Document count indicator */}
                       {taskDocuments[task.id] > 0 && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={(e) => {
                             e.stopPropagation();
                             toggleDocuments(task.id);
                           }}
                           className="gap-1 h-6 px-2 text-xs"
                         >
                           <Paperclip className="h-3 w-3" />
                           <span>{taskDocuments[task.id]} Dokument{taskDocuments[task.id] !== 1 ? 'e' : ''}</span>
                         </Button>
                       )}

                       {task.assignedTo && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                               <span className="text-muted-foreground">
                                 {users.find(u => u.user_id === task.assignedTo)?.display_name || 'Unbekannter Benutzer'}
                               </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleComments(task.id);
                              }}
                              className="gap-1 h-6 px-2 text-xs"
                            >
                              <MessageCircle className="h-3 w-3" />
                              <span>Kommentare ({taskComments[task.id]?.length || 0})</span>
                            </Button>
                          </div>
                        )}
                       {!task.assignedTo && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={(e) => {
                             e.stopPropagation();
                             toggleComments(task.id);
                           }}
                           className="gap-1 h-6 px-2 text-xs"
                         >
                           <MessageCircle className="h-3 w-3" />
                           <span>Kommentare ({taskComments[task.id]?.length || 0})</span>
                         </Button>
                       )}
                    </div>

                     {/* Progress Bar */}
                     {task.progress !== undefined && task.status !== "completed" && (
                       <div className="mt-3">
                         <div className="flex justify-between text-sm mb-1">
                           <span className="text-muted-foreground">Fortschritt</span>
                           <span className="text-muted-foreground">{task.progress}%</span>
                         </div>
                         <div className="w-full bg-secondary rounded-full h-2">
                           <div
                             className="bg-primary h-2 rounded-full transition-all duration-300"
                             style={{ width: `${task.progress}%` }}
                           ></div>
                         </div>
                        </div>
                      )}

                      {/* Inline Subtasks */}
                      {showSubtasksFor === task.id && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          <h4 className="text-sm font-medium text-foreground mb-3">Unteraufgaben ({subtasks[task.id]?.length || 0})</h4>
                          {subtasks[task.id]?.map((subtask) => (
                            <div key={subtask.id} className="bg-muted/50 rounded-lg p-3">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={subtask.is_completed}
                                  className="mt-0.5"
                                />
                                <div className="flex-1">
                                  <p className={`text-sm font-medium ${subtask.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                    {subtask.description}
                                  </p>
                                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                                    {subtask.assigned_to && (
                                      <span>Zuständig: {subtask.assigned_to}</span>
                                    )}
                                    {subtask.due_date && (
                                      <span>Fällig: {formatDate(subtask.due_date)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!subtasks[task.id] || subtasks[task.id].length === 0) && (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              Keine Unteraufgaben vorhanden
                            </div>
                          )}
                        </div>
                      )}

                     {/* Inline Comments */}
                     {showCommentsFor === task.id && (
                       <div className="mt-4 pt-4 border-t space-y-3">
                         {taskComments[task.id]?.map((comment) => (
                           <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
                             <div className="flex items-start gap-3">
                               <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                 <User className="h-4 w-4" />
                               </div>
                               <div className="flex-1">
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
                                 </div>
                                 <p className="text-sm">{comment.content}</p>
                               </div>
                             </div>
                           </div>
                         ))}
                         
                         {/* Add Comment Input */}
                         <div className="flex gap-2 mt-3">
                           <Input
                             placeholder="Kommentar hinzufügen..."
                             value={newComment[task.id] || ''}
                             onChange={(e) => setNewComment(prev => ({ ...prev, [task.id]: e.target.value }))}
                             onKeyPress={(e) => {
                               if (e.key === 'Enter' && !e.shiftKey) {
                                 e.preventDefault();
                                 addComment(task.id);
                               }
                             }}
                           />
                           <Button
                             size="sm"
                             onClick={(e) => {
                               e.stopPropagation();
                               addComment(task.id);
                             }}
                             disabled={!newComment[task.id]?.trim()}
                           >
                             <Send className="h-4 w-4" />
                           </Button>
                         </div>
                        </div>
                      )}

                      {/* Inline Documents */}
                      {showDocumentsFor === task.id && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          <h4 className="text-sm font-medium text-foreground mb-3">Dokumente ({taskDocumentDetails[task.id]?.length || 0})</h4>
                          {taskDocumentDetails[task.id]?.map((doc) => (
                            <div key={doc.id} className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {(doc.file_size / 1024).toFixed(1)} KB • {new Date(doc.created_at).toLocaleDateString('de-DE')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-1 ml-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDocumentDownload(doc);
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDocumentDelete(doc);
                                  }}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {(!taskDocumentDetails[task.id] || taskDocumentDetails[task.id].length === 0) && (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              Keine Dokumente vorhanden
                            </div>
                          )}
                        </div>
                       )}

                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

          {filteredTasks.length === 0 && (
            <Card className="bg-card shadow-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Aufgaben gefunden</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Es wurden keine Aufgaben gefunden, die Ihren Filterkriterien entsprechen.
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Aufgabe hinzufügen
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Archive Link */}
          <Card className="bg-card shadow-card border-border">
            <CardContent className="p-4">
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => setArchiveModalOpen(true)}
              >
                <Archive className="h-4 w-4" />
                Aufgaben-Archiv
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Übersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gesamt</span>
                  <span className="font-semibold">{taskCounts.all}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Offen</span>
                  <span className="font-semibold">{taskCounts.todo + taskCounts.inProgress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Erledigt</span>
                  <span className="font-semibold text-green-600">{taskCounts.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Überfällig</span>
                  <span className="font-semibold text-destructive">{taskCounts.overdue}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Letzte Aktivitäten</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity) => (
                    <div key={activity.id}>
                      <div className="font-medium">
                        {activity.type === 'completed' && 'Aufgabe erledigt'}
                        {activity.type === 'updated' && 'Aufgabe aktualisiert'}
                        {activity.type === 'created' && 'Aufgabe erstellt'}
                      </div>
                      <div className="text-muted-foreground">{activity.taskTitle}</div>
                      <div className="text-xs text-muted-foreground">{activity.timestamp}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">Keine Aktivitäten vorhanden</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskArchiveModal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        onTaskRestored={handleTaskRestored}
      />

      <TaskDetailSidebar
        task={selectedTask}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onTaskUpdate={handleTaskUpdate}
        onTaskRestored={handleTaskRestored}
        taskCategories={taskCategories}
        taskStatuses={taskStatuses}
      />
    </div>
    </>
  );
}