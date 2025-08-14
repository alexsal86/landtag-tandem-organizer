import { useState, useEffect } from "react";
import { Plus, CheckSquare, Square, Clock, Flag, Calendar, User, Edit2, Archive, MessageCircle, Send, Filter, Trash2, Check, X, Paperclip, Download, ChevronDown, ChevronRight, ListTodo, AlarmClock } from "lucide-react";
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
import { SnoozeManagementSidebar } from "./SnoozeManagementSidebar";

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
  result_text?: string;
  completed_at?: string;
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
  const [completingSubtask, setCompletingSubtask] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState<string>('');
  const [taskSnoozes, setTaskSnoozes] = useState<{ [taskId: string]: string }>({});
  const [subtaskSnoozes, setSubtaskSnoozes] = useState<{ [subtaskId: string]: string }>({});
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState<{ type: 'task' | 'subtask'; id: string } | null>(null);
  const [snoozeDate, setSnoozeDate] = useState<string>('');
  const [snoozeManagementOpen, setSnoozeManagementOpen] = useState(false);
  const [allSnoozes, setAllSnoozes] = useState<Array<{
    id: string;
    task_id?: string;
    subtask_id?: string;
    snoozed_until: string;
    task_title?: string;
    subtask_description?: string;
  }>>([]);
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
    loadTaskSnoozes();
  }, []);

  // Load all snoozes when snooze management is opened
  useEffect(() => {
    if (snoozeManagementOpen) {
      loadAllSnoozes();
    }
  }, [snoozeManagementOpen]);

  const loadAllSnoozes = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('task_snoozes')
        .select('*')
        .eq('user_id', user.id)
        .order('snoozed_until', { ascending: true });

      if (error) throw error;

      // Get task and subtask details
      const snoozesWithDetails = await Promise.all((data || []).map(async (snooze) => {
        if (snooze.task_id) {
          const { data: taskData } = await supabase
            .from('tasks')
            .select('title')
            .eq('id', snooze.task_id)
            .single();
          
          return {
            ...snooze,
            task_title: taskData?.title || 'Unbekannte Aufgabe'
          };
        } else if (snooze.subtask_id) {
          const { data: subtaskData } = await supabase
            .from('subtasks')
            .select('description')
            .eq('id', snooze.subtask_id)
            .single();
          
          return {
            ...snooze,
            subtask_description: subtaskData?.description || 'Unbekannte Unteraufgabe'
          };
        }
        return snooze;
      }));

      setAllSnoozes(snoozesWithDetails);
    } catch (error) {
      console.error('Error loading all snoozes:', error);
    }
  };

  const updateSnooze = async (snoozeId: string, newDate: string) => {
    try {
      const { error } = await supabase
        .from('task_snoozes')
        .update({ snoozed_until: newDate })
        .eq('id', snoozeId);

      if (error) throw error;

      await loadAllSnoozes();
      await loadTaskSnoozes();
      await loadAssignedSubtasks();
      
      toast({
        title: "Wiedervorlage aktualisiert",
        description: `Neues Datum: ${new Date(newDate).toLocaleDateString('de-DE')}`
      });
    } catch (error) {
      console.error('Error updating snooze:', error);
      toast({
        title: "Fehler",
        description: "Wiedervorlage konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteSnooze = async (snoozeId: string) => {
    try {
      const { error } = await supabase
        .from('task_snoozes')
        .delete()
        .eq('id', snoozeId);

      if (error) throw error;

      await loadAllSnoozes();
      await loadTaskSnoozes();
      await loadAssignedSubtasks();
      
      toast({
        title: "Wiedervorlage gelöscht",
        description: "Die Wiedervorlage wurde erfolgreich entfernt."
      });
    } catch (error) {
      console.error('Error deleting snooze:', error);
      toast({
        title: "Fehler",
        description: "Wiedervorlage konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const loadTaskSnoozes = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('task_snoozes')
        .select('*')
        .eq('user_id', user.id)
        .gt('snoozed_until', new Date().toISOString());

      if (error) throw error;

      const taskSnoozeMap: { [taskId: string]: string } = {};
      const subtaskSnoozeMap: { [subtaskId: string]: string } = {};
      
      (data || []).forEach(snooze => {
        if (snooze.task_id) {
          taskSnoozeMap[snooze.task_id] = snooze.snoozed_until;
        } else if (snooze.subtask_id) {
          subtaskSnoozeMap[snooze.subtask_id] = snooze.snoozed_until;
        }
      });

      setTaskSnoozes(taskSnoozeMap);
      setSubtaskSnoozes(subtaskSnoozeMap);
    } catch (error) {
      console.error('Error loading task snoozes:', error);
    }
  };

  const loadAssignedSubtasks = async () => {
    if (!user) {
      console.log('No user found for assigned subtasks');
      return;
    }
    
    console.log('Loading assigned subtasks for user:', user.id);
    
    try {
      // Get current user's profile to match assigned_to field
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      if (!profile?.display_name) {
        console.log('No profile display_name found');
        return;
      }

      console.log('User display_name:', profile.display_name);

      // Get subtasks assigned to this user
      const { data: subtasksData, error } = await supabase
        .from('subtasks')
        .select('*, result_text, completed_at')
        .eq('assigned_to', profile.display_name)
        .eq('is_completed', false);

      if (error) throw error;

      console.log('Found subtasks:', subtasksData);

      if (!subtasksData || subtasksData.length === 0) {
        setAssignedSubtasks([]);
        return;
      }

      // Get task titles for these subtasks
      const taskIds = [...new Set(subtasksData.map(s => s.task_id))];
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title')
        .in('id', taskIds);

      if (tasksError) throw tasksError;

      // Combine subtasks with task titles
      const subtasksWithTitles = subtasksData.map(subtask => ({
        ...subtask,
        task_title: tasksData?.find(t => t.id === subtask.task_id)?.title || 'Unbekannte Aufgabe'
      }));

      console.log('Subtasks with titles:', subtasksWithTitles);

      setAssignedSubtasks(subtasksWithTitles);
    } catch (error) {
      console.error('Error loading assigned subtasks:', error);
    }
  };

  const loadSubtaskCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('task_id, id, description, assigned_to, due_date, is_completed, order_index, created_at, updated_at, user_id, result_text, completed_at');

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
        console.log(`Subtasks for task ${taskId}:`, details[taskId]);
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
      console.error('Error loading task documents:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTaskConfiguration = async () => {
    try {
      const [categoriesResponse, statusesResponse] = await Promise.all([
        supabase.from('task_categories').select('name, label').eq('is_active', true).order('order_index'),
        supabase.from('appointment_statuses').select('name, label').eq('is_active', true).order('order_index')
      ]);

      if (categoriesResponse.error) throw categoriesResponse.error;
      if (statusesResponse.error) throw statusesResponse.error;

      setTaskCategories(categoriesResponse.data || []);
      setTaskStatuses(statusesResponse.data || []);
    } catch (error) {
      console.error('Error loading task configuration:', error);
    }
  };

  const loadRecentActivities = async () => {
    // This is a simplified version - in a real app you'd have an activities table
    setRecentActivities([]);
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our interface
      const transformedTasks: Task[] = (data || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority as "low" | "medium" | "high",
        status: task.status as "todo" | "in-progress" | "completed",
        dueDate: task.due_date,
        category: task.category as "legislation" | "constituency" | "committee" | "personal",
        assignedTo: task.assigned_to,
        progress: task.progress
      }));

      setTasks(transformedTasks);

      // Auto-create sample data if no tasks exist
      if (transformedTasks.length === 0) {
        await createSampleTasks();
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSampleTasks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sampleTasks = [
      {
        user_id: user.id,
        title: "Bürgersprechstunde vorbereiten",
        description: "Termine koordinieren und Räumlichkeiten reservieren",
        priority: "high",
        status: "todo",
        category: "constituency",
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        progress: 25
      },
      {
        user_id: user.id,
        title: "Gesetzentwurf analysieren",
        description: "Neuen Entwurf zur Digitalisierung prüfen",
        priority: "medium",
        status: "in-progress",
        category: "legislation",
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        progress: 60
      }
    ];

    try {
      const { error } = await supabase
        .from('tasks')
        .insert(sampleTasks);

      if (error) throw error;

      loadTasks();
    } catch (error) {
      console.error('Error creating sample tasks:', error);
    }
  };

  const toggleTaskStatus = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const newStatus = task.status === "completed" ? "todo" : "completed";
      
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          progress: newStatus === "completed" ? 100 : task.progress
        })
        .eq('id', taskId);

      if (error) throw error;

      if (newStatus === "completed") {
        // Archive the task
        await archiveTask(task);
      } else {
        // Update local state
        setTasks(prev => prev.map(t => 
          t.id === taskId 
            ? { ...t, status: newStatus as "todo" | "in-progress" | "completed" }
            : t
        ));
      }

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

      toast({
        title: "Aufgabe archiviert",
        description: "Die erledigte Aufgabe wurde archiviert.",
      });
    } catch (error) {
      console.error('Error archiving task:', error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht archiviert werden.",
        variant: "destructive",
      });
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setSidebarOpen(true);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
  };

  const handleTaskRestored = (restoredTask: Task) => {
    setTasks(prev => [restoredTask, ...prev]);
  };

  const handleSubtaskComplete = async (subtaskId: string, isCompleted: boolean, result: string) => {
    try {
      const updateData = isCompleted 
        ? { 
            is_completed: true, 
            result_text: result || null,
            completed_at: new Date().toISOString()
          }
        : { 
            is_completed: false, 
            result_text: null,
            completed_at: null
          };

      const { error } = await supabase
        .from('subtasks')
        .update(updateData)
        .eq('id', subtaskId);

      if (error) throw error;

      // Update local assigned subtasks
      if (isCompleted) {
        setAssignedSubtasks(prev => prev.filter(s => s.id !== subtaskId));
      }
      
      // Refresh subtasks for the expanded task view
      loadSubtaskCounts();
      
      toast({
        title: "Unteraufgabe aktualisiert",
        description: isCompleted ? "Unteraufgabe als erledigt markiert" : "Unteraufgabe als offen markiert",
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

  const snoozeTask = async (taskId: string, snoozeUntil: string) => {
    if (!user) return;

    try {
      // Delete existing snooze if any
      await supabase
        .from('task_snoozes')
        .delete()
        .eq('user_id', user.id)
        .eq('task_id', taskId);

      // Insert new snooze
      const { error } = await supabase
        .from('task_snoozes')
        .insert({
          user_id: user.id,
          task_id: taskId,
          snoozed_until: snoozeUntil
        });

      if (error) throw error;

      await loadTaskSnoozes();
      
      toast({
        title: "Aufgabe auf Wiedervorlage gesetzt",
        description: `Die Aufgabe erscheint wieder am ${new Date(snoozeUntil).toLocaleDateString('de-DE')}`
      });
    } catch (error) {
      console.error('Error snoozing task:', error);
      toast({
        title: "Fehler",
        description: "Wiedervorlage konnte nicht gesetzt werden.",
        variant: "destructive",
      });
    }
  };

  const snoozeSubtask = async (subtaskId: string, snoozeUntil: string) => {
    if (!user) return;

    try {
      // Delete existing snooze if any
      await supabase
        .from('task_snoozes')
        .delete()
        .eq('user_id', user.id)
        .eq('subtask_id', subtaskId);

      // Insert new snooze
      const { error } = await supabase
        .from('task_snoozes')
        .insert({
          user_id: user.id,
          subtask_id: subtaskId,
          snoozed_until: snoozeUntil
        });

      if (error) throw error;

      await loadTaskSnoozes();
      await loadAssignedSubtasks();
      
      toast({
        title: "Unteraufgabe auf Wiedervorlage gesetzt",
        description: `Die Unteraufgabe erscheint wieder am ${new Date(snoozeUntil).toLocaleDateString('de-DE')}`
      });
    } catch (error) {
      console.error('Error snoozing subtask:', error);
      toast({
        title: "Fehler",
        description: "Wiedervorlage konnte nicht gesetzt werden.",
        variant: "destructive",
      });
    }
  };

  const handleSnoozeDialogSubmit = () => {
    if (!snoozeDialogOpen || !snoozeDate) return;

    const snoozeUntil = new Date(snoozeDate).toISOString();
    
    if (snoozeDialogOpen.type === 'task') {
      snoozeTask(snoozeDialogOpen.id, snoozeUntil);
    } else {
      snoozeSubtask(snoozeDialogOpen.id, snoozeUntil);
    }

    setSnoozeDialogOpen(null);
    setSnoozeDate('');
  };

  const toggleSubtasks = (taskId: string) => {
    setShowSubtasksFor(prev => prev === taskId ? null : taskId);
  };

  const toggleDocuments = (taskId: string) => {
    setShowDocumentsFor(prev => prev === taskId ? null : taskId);
  };

  const toggleComments = (taskId: string) => {
    setShowCommentsFor(prev => prev === taskId ? null : taskId);
    if (!taskComments[taskId]) {
      loadTaskComments(taskId);
    }
  };

  const loadTaskComments = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          *,
          profiles:user_id (
            display_name,
            avatar_url
          )
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setTaskComments(prev => ({
        ...prev,
        [taskId]: (data || []).map(comment => ({
          ...comment,
          profile: comment.profiles as any
        }))
      }));
    } catch (error) {
      console.error('Error loading task comments:', error);
    }
  };

  const addComment = async (taskId: string) => {
    if (!newComment[taskId]?.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content: newComment[taskId].trim()
        });

      if (error) throw error;

      setNewComment(prev => ({ ...prev, [taskId]: '' }));
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

  // Utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800 border-red-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 border-green-200";
      case "in-progress": return "bg-blue-100 text-blue-800 border-blue-200";
      case "todo": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "legislation": return "bg-purple-100 text-purple-800 border-purple-200";
      case "committee": return "bg-orange-100 text-orange-800 border-orange-200";
      case "constituency": return "bg-blue-100 text-blue-800 border-blue-200";
      case "personal": return "bg-pink-100 text-pink-800 border-pink-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === "all") return true;
    if (filter === "pending") return task.status === "todo" || task.status === "in-progress";
    if (filter === "overdue") return isOverdue(task.dueDate);
    return task.status === filter;
  }).filter(task => {
    if (categoryFilter === "all") return true;
    return task.category === categoryFilter;
  }).filter(task => {
    if (priorityFilter === "all") return true;
    return task.priority === priorityFilter;
  });

  // Filter out snoozed tasks and subtasks for current user
  const filteredTasksWithSnooze = filteredTasks.filter(task => {
    return !taskSnoozes[task.id] || new Date(taskSnoozes[task.id]) <= new Date();
  });

  const filteredAssignedSubtasks = assignedSubtasks.filter(subtask => {
    return !subtaskSnoozes[subtask.id] || new Date(subtaskSnoozes[subtask.id]) <= new Date();
  });

  const taskCounts = {
    all: filteredTasksWithSnooze.length,
    todo: filteredTasksWithSnooze.filter(t => t.status === "todo").length,
    inProgress: filteredTasksWithSnooze.filter(t => t.status === "in-progress").length,
    completed: filteredTasksWithSnooze.filter(t => t.status === "completed").length,
    overdue: filteredTasksWithSnooze.filter(t => isOverdue(t.dueDate)).length,
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
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => setArchiveModalOpen(true)}
              >
                <Archive className="h-4 w-4" />
                Aufgaben-Archiv
              </Button>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => setSnoozeManagementOpen(true)}
              >
                <AlarmClock className="h-4 w-4" />
                Wiedervorlagen
              </Button>
              <Button className="gap-2" onClick={() => window.location.href = '/tasks/new'}>
                <Plus className="h-4 w-4" />
                Neue Aufgabe
              </Button>
            </div>
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

      {/* Assigned Subtasks Table - Always show if there are any assigned subtasks */}
      {assignedSubtasks.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Mir zugewiesene Unteraufgaben ({assignedSubtasks.length})
              {assignedSubtasks.length !== filteredAssignedSubtasks.length && (
                <span className="text-sm text-muted-foreground">
                  ({filteredAssignedSubtasks.length} sichtbar)
                </span>
              )}
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
                {/* Show snoozed subtasks with visual indication */}
                {assignedSubtasks.map((subtask) => {
                  const isSnoozed = subtaskSnoozes[subtask.id] && new Date(subtaskSnoozes[subtask.id]) > new Date();
                  return (
                    <TableRow key={subtask.id} className={isSnoozed ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {isSnoozed && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                              <AlarmClock className="h-3 w-3" />
                              <span>Wiedervorlage bis {new Date(subtaskSnoozes[subtask.id]).toLocaleDateString('de-DE')}</span>
                            </div>
                          )}
                          <Checkbox
                            checked={subtask.is_completed}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setCompletingSubtask(subtask.id);
                                setCompletionResult('');
                              } else {
                                handleSubtaskComplete(subtask.id, false, '');
                              }
                            }}
                            disabled={isSnoozed}
                          />
                          <div className="flex-1">
                            <span className="font-medium">{subtask.description}</span>
                            {subtask.result_text && (
                              <div className="mt-1 p-2 bg-green-50 dark:bg-green-900/20 rounded border-l-2 border-green-500">
                                <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Ergebnis:</p>
                                <p className="text-sm text-green-800 dark:text-green-200">{subtask.result_text}</p>
                              </div>
                            )}
                          </div>
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
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSnoozeDialogOpen({ type: 'subtask', id: subtask.id });
                              setSnoozeDate('');
                            }}
                            className="h-8 w-8 p-0"
                            title="Auf Wiedervorlage setzen"
                          >
                            <AlarmClock className="h-4 w-4" />
                          </Button>
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
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Main Task List - Full Width */}
        <div className="space-y-4">
          {filteredTasksWithSnooze.map((task) => (
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

                    <p className={`text-sm mb-3 ${
                      task.status === "completed" ? "line-through text-muted-foreground" : "text-muted-foreground"
                    }`}>
                      {task.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span className={isOverdue(task.dueDate) && task.status !== "completed" ? "text-destructive font-medium" : ""}>
                          {formatDate(task.dueDate)}
                          {isOverdue(task.dueDate) && task.status !== "completed" && " (Überfällig)"}
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

                        {/* Snooze Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSnoozeDialogOpen({ type: 'task', id: task.id });
                            setSnoozeDate('');
                          }}
                          className="gap-1 h-6 px-2 text-xs"
                          title="Auf Wiedervorlage setzen"
                        >
                          <AlarmClock className="h-3 w-3" />
                          <span>Wiedervorlage</span>
                        </Button>

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
                                    {(() => {
                                      console.log('Subtask debug:', {
                                        id: subtask.id,
                                        is_completed: subtask.is_completed,
                                        result_text: subtask.result_text,
                                        completed_at: subtask.completed_at
                                      });
                                      return subtask.is_completed && subtask.result_text;
                                    })() && (
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
                                      {subtask.assigned_to && (
                                        <span>Zuständig: {users.find(u => u.user_id === subtask.assigned_to)?.display_name || subtask.assigned_to}</span>
                                      )}
                                      {subtask.due_date && (
                                        <span>Fällig: {formatDate(subtask.due_date)}</span>
                                      )}
                                    </div>
                                  </div>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}

                       {/* Inline Comments */}
                       {showCommentsFor === task.id && (
                         <div className="mt-4 pt-4 border-t space-y-3">
                           <h4 className="text-sm font-medium text-foreground mb-3">Kommentare ({taskComments[task.id]?.length || 0})</h4>
                           {taskComments[task.id]?.map((comment) => (
                             <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
                               <div className="flex items-start gap-3">
                                 <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                                   <User className="h-4 w-4 text-primary" />
                                 </div>
                                 <div className="flex-1">
                                   <div className="flex items-center gap-2 mb-1">
                                     <span className="font-medium text-sm">
                                       {comment.profile?.display_name || 'Unbekannter Benutzer'}
                                     </span>
                                     <span className="text-xs text-muted-foreground">
                                       {new Date(comment.created_at).toLocaleDateString('de-DE')}
                                     </span>
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
                                     // Download logic would go here
                                   }}
                                   className="h-8 w-8 p-0"
                                 >
                                   <Download className="h-3 w-3" />
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

          {filteredTasksWithSnooze.length === 0 && (
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

      {/* Subtask Completion Dialog */}
      <Dialog open={!!completingSubtask} onOpenChange={() => setCompletingSubtask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unteraufgabe als erledigt markieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Wie wurde die Aufgabe gelöst?</Label>
              <Textarea
                placeholder="Beschreiben Sie, wie die Unteraufgabe erledigt wurde..."
                value={completionResult}
                onChange={(e) => setCompletionResult(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCompletingSubtask(null);
                  setCompletionResult('');
                }}
              >
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  if (completingSubtask) {
                    handleSubtaskComplete(completingSubtask, true, completionResult);
                    setCompletingSubtask(null);
                    setCompletionResult('');
                  }
                }}
                disabled={!completionResult.trim()}
              >
                Als erledigt markieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Snooze Dialog */}
      <Dialog open={!!snoozeDialogOpen} onOpenChange={() => setSnoozeDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {snoozeDialogOpen?.type === 'task' ? 'Aufgabe' : 'Unteraufgabe'} auf Wiedervorlage setzen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Wiedervorlage-Datum</Label>
              <Input
                type="datetime-local"
                value={snoozeDate}
                onChange={(e) => setSnoozeDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Die {snoozeDialogOpen?.type === 'task' ? 'Aufgabe' : 'Unteraufgabe'} wird bis zu diesem Datum ausgeblendet.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSnoozeDialogOpen(null);
                  setSnoozeDate('');
                }}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSnoozeDialogSubmit}
                disabled={!snoozeDate}
              >
                <AlarmClock className="h-4 w-4 mr-2" />
                Wiedervorlage setzen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Snooze Management Sidebar */}
      <SnoozeManagementSidebar
        isOpen={snoozeManagementOpen}
        onClose={() => setSnoozeManagementOpen(false)}
        snoozes={allSnoozes}
        onUpdateSnooze={updateSnooze}
        onDeleteSnooze={deleteSnooze}
      />
    </>
  );
}