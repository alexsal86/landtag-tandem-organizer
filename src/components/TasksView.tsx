import { useState, useEffect } from "react";
import { Plus, CheckSquare, Square, Clock, Flag, Calendar, User, Edit2, Archive, MessageCircle, Send, Filter, Trash2, Check, X, Paperclip, Download, ChevronDown, ChevronRight, ListTodo, AlarmClock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { TodoCreateDialog } from "./TodoCreateDialog";

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
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

interface TaskComment {
  id: string;
  taskId: string;
  content: string;
  userId: string;
  userName?: string;
  createdAt: string;
}

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  assigned_to?: string;
  due_date?: string;
  order_index: number;
  completed_at?: string;
  result_text?: string;
  planning_item_id?: string;
  source_type?: 'task' | 'planning';
  checklist_item_title?: string;
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
  const [hideSnoozeSubtasks, setHideSnoozeSubtasks] = useState(false);
  const [allSnoozes, setAllSnoozes] = useState<Array<{
    id: string;
    task_id?: string;
    subtask_id?: string;
    snoozed_until: string;
    task_title?: string;
    subtask_description?: string;
  }>>([]);
  const [todoCreateOpen, setTodoCreateOpen] = useState(false);
  const [todos, setTodos] = useState<Array<{
    id: string;
    title: string;
    category_label: string;
    category_color: string;
    assigned_to: string | null;
    due_date: string | null;
    is_completed: boolean;
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
    loadTodos();
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
      // Load task snoozes - get task titles separately to avoid relation issues
      const { data: taskSnoozes, error: taskError } = await supabase
        .from('task_snoozes')
        .select('id, task_id, snoozed_until')
        .eq('user_id', user.id)
        .not('task_id', 'is', null);

      if (taskError) throw taskError;

      // Load subtask snoozes (note: subtasks table doesn't exist, so we'll handle this differently)
      const { data: subtaskSnoozes } = await supabase
        .from('task_snoozes')
        .select('id, subtask_id, snoozed_until')
        .eq('user_id', user.id)
        .not('subtask_id', 'is', null);

      // Get task titles for snoozed tasks
      const taskTitles: { [taskId: string]: string } = {};
      if (taskSnoozes && taskSnoozes.length > 0) {
        const taskIds = taskSnoozes.map(s => s.task_id);
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, title')
          .in('id', taskIds);
        
        tasksData?.forEach(task => {
          taskTitles[task.id] = task.title;
        });
      }

      const allSnoozes = [
        ...(taskSnoozes || []).map(snooze => ({
          id: snooze.id,
          task_id: snooze.task_id,
          snoozed_until: snooze.snoozed_until,
          task_title: taskTitles[snooze.task_id] || 'Unbekannte Aufgabe',
        })),
        ...(subtaskSnoozes || []).map(snooze => ({
          id: snooze.id,
          subtask_id: snooze.subtask_id,
          snoozed_until: snooze.snoozed_until,
          subtask_description: 'Unteraufgabe',
          task_title: 'Aufgabe',
        }))
      ];

      setAllSnoozes(allSnoozes);
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

      loadAllSnoozes();
      loadTaskSnoozes();
      
      toast({
        title: "Erfolgreich",
        description: "Wiedervorlage wurde aktualisiert.",
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

      loadAllSnoozes();
      loadTaskSnoozes();
      
      toast({
        title: "Erfolgreich",
        description: "Wiedervorlage wurde gelöscht.",
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

  const loadTodos = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('todos')
        .select(`
          id,
          title,
          assigned_to,
          due_date,
          is_completed,
          todo_categories!inner(label, color)
        `)
        .eq('user_id', user.id)
        .eq('is_completed', false);

      if (error) throw error;

      const todosWithCategory = (data || []).map(todo => ({
        id: todo.id,
        title: todo.title,
        category_label: todo.todo_categories.label,
        category_color: todo.todo_categories.color,
        assigned_to: todo.assigned_to,
        due_date: todo.due_date,
        is_completed: todo.is_completed
      }));

      setTodos(todosWithCategory);
    } catch (error) {
      console.error('Error loading todos:', error);
    }
  };

  const loadAssignedSubtasks = async () => {
    if (!user) {
      console.log('No user found for assigned subtasks');
      return;
    }
    
    console.log('Loading assigned subtasks for user:', user.id);
    
    try {
      // Get regular subtasks assigned to this user
      const { data: subtasksData, error } = await supabase
        .from('subtasks')
        .select('*, result_text, completed_at')
        .eq('assigned_to', user.id)
        .eq('is_completed', false);

      if (error) throw error;

      // Get planning subtasks assigned to this user
      const { data: planningSubtasksData, error: planningError } = await supabase
        .from('planning_item_subtasks')
        .select('*, result_text, completed_at')
        .eq('assigned_to', user.id)
        .eq('is_completed', false);

      if (planningError) throw planningError;

      console.log('Regular subtasks:', subtasksData);
      console.log('Planning subtasks:', planningSubtasksData);

      // Combine subtasks with task titles
      const allSubtasks = [];

      // Process regular subtasks
      if (subtasksData) {
        for (const subtask of subtasksData) {
          const { data: taskData } = await supabase
            .from('tasks')
            .select('title')
            .eq('id', subtask.task_id)
            .single();

          allSubtasks.push({
            ...subtask,
            task_title: taskData?.title || 'Unbekannte Aufgabe',
            source_type: 'task' as const
          });
        }
      }

      // Process planning subtasks
      if (planningSubtasksData) {
        for (const subtask of planningSubtasksData) {
          const { data: checklistItemData } = await supabase
            .from('event_planning_checklist_items')
            .select('title, event_planning_id')
            .eq('id', subtask.planning_item_id)
            .single();

          let planningTitle = 'Unbekannte Planung';
          if (checklistItemData) {
            const { data: planningData } = await supabase
              .from('event_plannings')
              .select('title')
              .eq('id', checklistItemData.event_planning_id)
              .single();
            
            planningTitle = planningData?.title || 'Unbekannte Planung';
          }

          allSubtasks.push({
            ...subtask,
            task_title: planningTitle,
            source_type: 'planning' as const,
            checklist_item_title: checklistItemData?.title,
            planning_item_id: subtask.planning_item_id
          });
        }
      }

      console.log('All assigned subtasks:', allSubtasks);
      setAssignedSubtasks(allSubtasks);
    } catch (error) {
      console.error('Error loading assigned subtasks:', error);
    }
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
        progress: task.progress,
        created_at: task.created_at,
        updated_at: task.updated_at,
        user_id: task.user_id
      }));

      setTasks(transformedTasks);
      setLoading(false);
      loadTaskComments();
    } catch (error) {
      console.error('Error loading tasks:', error);
      setLoading(false);
    }
  };

  const loadTaskConfiguration = async () => {
    try {
      const [categoriesRes, statusesRes] = await Promise.all([
        supabase.from('task_categories').select('name, label').eq('is_active', true).order('order_index'),
        supabase.from('task_statuses').select('name, label').eq('is_active', true).order('order_index')
      ]);

      if (categoriesRes.data) {
        setTaskCategories(categoriesRes.data);
      }
      if (statusesRes.data) {
        setTaskStatuses(statusesRes.data);
      }
    } catch (error) {
      console.error('Error loading task configuration:', error);
    }
  };

  const loadRecentActivities = async () => {
    // This is a simplified version - in a real app you'd have an activities table
    setRecentActivities([]);
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

  const loadTaskComments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          id,
          task_id,
          content,
          user_id,
          created_at,
          profiles(display_name)
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsMap: { [taskId: string]: TaskComment[] } = {};
      (data || []).forEach(comment => {
        if (!commentsMap[comment.task_id]) {
          commentsMap[comment.task_id] = [];
        }
        commentsMap[comment.task_id].push({
          id: comment.id,
          taskId: comment.task_id,
          content: comment.content,
          userId: comment.user_id,
          userName: (comment.profiles as any)?.display_name || 'Unbekannter Benutzer',
          createdAt: comment.created_at
        });
      });

      setTaskComments(commentsMap);
    } catch (error) {
      console.error('Error loading task comments:', error);
    }
  };

  const loadTaskDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const detailsMap: { [taskId: string]: any[] } = {};
      (data || []).forEach(doc => {
        if (!detailsMap[doc.task_id]) {
          detailsMap[doc.task_id] = [];
        }
        detailsMap[doc.task_id].push(doc);
      });

      setTaskDocumentDetails(detailsMap);
    } catch (error) {
      console.error('Error loading task documents:', error);
    }
  };

  const loadTaskDocumentCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('task_documents')
        .select('task_id, id');

      if (error) throw error;

      const counts: { [taskId: string]: number } = {};
      (data || []).forEach(doc => {
        counts[doc.task_id] = (counts[doc.task_id] || 0) + 1;
      });

      setTaskDocuments(counts);
    } catch (error) {
      console.error('Error loading task document counts:', error);
    }
  };

  const loadSubtaskCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('task_id, id');

      if (error) throw error;

      const counts: { [taskId: string]: number } = {};
      (data || []).forEach(subtask => {
        counts[subtask.task_id] = (counts[subtask.task_id] || 0) + 1;
      });

      setSubtaskCounts(counts);
    } catch (error) {
      console.error('Error loading subtask counts:', error);
    }
  };

  const loadSubtasksForTask = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', taskId)
        .eq('is_completed', false)
        .order('order_index');

      if (error) throw error;

      setSubtasks(prev => ({
        ...prev,
        [taskId]: (data || []).map(subtask => ({
          ...subtask,
          title: subtask.description || 'Unnamed subtask'
        }))
      }));
    } catch (error) {
      console.error('Error loading subtasks:', error);
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const toggleTaskStatus = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === "completed" ? "todo" : "completed";
    
    try {
      const updateData: any = { 
        status: newStatus,
        progress: newStatus === "completed" ? 100 : task.progress || 0
      };

      if (newStatus === "completed" && !user) {
        console.error('No user available for archiving');
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      // If task is completed, archive it
      if (newStatus === "completed") {
        const { error: archiveError } = await supabase
          .from('archived_tasks')
          .insert({
            task_id: taskId,
            user_id: user?.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            category: task.category,
            assigned_to: task.assignedTo,
            progress: 100,
            due_date: task.dueDate,
            completed_at: new Date().toISOString()
          });

        if (archiveError) {
          console.error('Error archiving task:', archiveError);
        }

        // Delete the task from the tasks table
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId);

        if (deleteError) {
          console.error('Error deleting completed task:', deleteError);
        }
      }

      loadTasks();
      toast({
        title: "Status aktualisiert",
        description: newStatus === "completed" 
          ? "Aufgabe wurde als erledigt markiert und archiviert."
          : "Aufgabe wurde als offen markiert."
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: "Fehler",
        description: "Status konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setSidebarOpen(true);
  };

  const addComment = async (taskId: string) => {
    const content = newComment[taskId]?.trim();
    if (!content || !user) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content: content
        });

      if (error) throw error;

      setNewComment(prev => ({ ...prev, [taskId]: '' }));
      loadTaskComments();
      toast({ title: "Kommentar hinzugefügt" });
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht hinzugefügt werden.",
        variant: "destructive"
      });
    }
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
  };

  const handleTaskRestored = () => {
    loadTasks();
  };

  const snoozeTask = async (taskId: string, snoozeUntil: string) => {
    if (!user) return;

    try {
      // Check if there's already a snooze for this task
      const { data: existingSnooze } = await supabase
        .from('task_snoozes')
        .select('id')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .single();

      if (existingSnooze) {
        // Update existing snooze
        const { error } = await supabase
          .from('task_snoozes')
          .update({ snoozed_until: snoozeUntil })
          .eq('id', existingSnooze.id);

        if (error) throw error;
      } else {
        // Create new snooze
        const { error } = await supabase
          .from('task_snoozes')
          .insert({
            user_id: user.id,
            task_id: taskId,
            snoozed_until: snoozeUntil
          });

        if (error) throw error;
      }

      loadTaskSnoozes();
      toast({
        title: "Wiedervorlage gesetzt",
        description: `Aufgabe wird bis ${new Date(snoozeUntil).toLocaleDateString('de-DE')} ausgeblendet.`
      });
    } catch (error: any) {
      console.error('Error snoozing task:', error);
      toast({
        title: "Fehler",
        description: "Wiedervorlage konnte nicht gesetzt werden.",
        variant: "destructive"
      });
    }
  };

  const snoozeSubtask = async (subtaskId: string, snoozeUntil: string) => {
    if (!user) return;

    try {
      // Check if there's already a snooze for this subtask
      const { data: existingSnooze } = await supabase
        .from('task_snoozes')
        .select('id')
        .eq('subtask_id', subtaskId)
        .eq('user_id', user.id)
        .single();

      if (existingSnooze) {
        // Update existing snooze
        const { error } = await supabase
          .from('task_snoozes')
          .update({ snoozed_until: snoozeUntil })
          .eq('id', existingSnooze.id);

        if (error) throw error;
      } else {
        // Create new snooze
        const { error } = await supabase
          .from('task_snoozes')
          .insert({
            user_id: user.id,
            subtask_id: subtaskId,
            snoozed_until: snoozeUntil
          });

        if (error) throw error;
      }

      loadTaskSnoozes();
      loadAssignedSubtasks();
      toast({
        title: "Wiedervorlage gesetzt",
        description: `Unteraufgabe wird bis ${new Date(snoozeUntil).toLocaleDateString('de-DE')} ausgeblendet.`
      });
    } catch (error: any) {
      console.error('Error snoozing subtask:', error);
      toast({
        title: "Fehler",
        description: "Wiedervorlage konnte nicht gesetzt werden.",
        variant: "destructive"
      });
    }
  };

  const handleSubtaskComplete = async (subtaskId: string, isCompleted: boolean, result: string = '') => {
    try {
      // Determine if this is a regular subtask or planning subtask
      const subtask = assignedSubtasks.find(s => s.id === subtaskId);
      const tableName = subtask?.source_type === 'planning' ? 'planning_item_subtasks' : 'subtasks';
      
      const updateData: any = {
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null
      };

      if (result) {
        updateData.result_text = result;
      }

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', subtaskId);

      if (error) throw error;

      loadAssignedSubtasks();
      setCompletingSubtask(null);
      setCompletionResult('');
      
      toast({
        title: isCompleted ? "Unteraufgabe erledigt" : "Unteraufgabe wieder geöffnet",
        description: isCompleted ? "Die Unteraufgabe wurde als erledigt markiert." : "Die Unteraufgabe wurde wieder geöffnet."
      });
    } catch (error: any) {
      console.error('Error updating subtask:', error);
      toast({
        title: "Fehler",
        description: "Unteraufgabe konnte nicht aktualisiert werden.",
        variant: "destructive"
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

  // Filter logic
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
    if (hideSnoozeSubtasks) {
      return !subtaskSnoozes[subtask.id] || new Date(subtaskSnoozes[subtask.id]) <= new Date();
    }
    return true;
  });

  const taskCounts = {
    all: filteredTasksWithSnooze.length,
    todo: filteredTasksWithSnooze.filter(t => t.status === "todo").length,
    inProgress: filteredTasksWithSnooze.filter(t => t.status === "in-progress").length,
    completed: filteredTasksWithSnooze.filter(t => t.status === "completed").length,
    overdue: filteredTasksWithSnooze.filter(t => isOverdue(t.dueDate)).length,
  };

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
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button className="gap-2" onClick={() => window.location.href = '/tasks/new'}>
                  <Plus className="h-4 w-4" />
                  Neue Aufgabe
                </Button>
                <Button 
                  className="gap-2"
                  onClick={() => setTodoCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Neues ToDo
                </Button>
              </div>
              
              {/* Secondary actions row directly under main buttons */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2"
                  onClick={() => setArchiveModalOpen(true)}
                >
                  <Archive className="h-4 w-4" />
                  Aufgaben-Archiv
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2"
                  onClick={() => setSnoozeManagementOpen(true)}
                >
                  <AlarmClock className="h-4 w-4" />
                  Wiedervorlagen
                </Button>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="flex gap-4 items-center mt-4">
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

        {/* Assigned Subtasks and ToDos Table */}
        {(assignedSubtasks.length > 0 || todos.length > 0) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Mir zugewiesene Unteraufgaben & ToDos ({assignedSubtasks.length + todos.length})
                {hideSnoozeSubtasks && assignedSubtasks.length !== filteredAssignedSubtasks.length && (
                  <span className="text-sm text-muted-foreground">
                    ({filteredAssignedSubtasks.length + todos.length} sichtbar)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Aufgabe/ToDo</TableHead>
                    <TableHead>Übergeordnete Aufgabe/Kategorie</TableHead>
                    <TableHead>Fälligkeitsdatum</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Show subtasks based on visibility setting */}
                  {filteredAssignedSubtasks.map((subtask) => {
                    const isSnoozed = subtaskSnoozes[subtask.id] && new Date(subtaskSnoozes[subtask.id]) > new Date();
                    return (
                      <TableRow key={subtask.id} className={isSnoozed ? "opacity-50" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={subtask.is_completed}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCompletingSubtask(subtask.id);
                                  setCompletionResult('');
                                } else {
                                  handleSubtaskComplete(subtask.id, false);
                                }
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{subtask.title}</div>
                            {subtask.description && (
                              <div className="text-sm text-muted-foreground">{subtask.description}</div>
                            )}
                            {isSnoozed && (
                              <Badge variant="secondary" className="text-xs">
                                Wiedervorlage: {new Date(subtaskSnoozes[subtask.id]).toLocaleDateString('de-DE')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{subtask.task_title}</TableCell>
                        <TableCell>
                          {subtask.due_date && (
                            <div className={`text-sm ${isOverdue(subtask.due_date) ? 'text-red-600' : ''}`}>
                              {new Date(subtask.due_date).toLocaleDateString('de-DE')}
                              {isOverdue(subtask.due_date) && ' (überfällig)'}
                            </div>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  
                  {/* Show todos */}
                  {todos.map((todo) => (
                    <TableRow key={`todo-${todo.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={todo.is_completed}
                          onCheckedChange={async (checked) => {
                            if (checked) {
                              try {
                                const { error } = await supabase
                                  .from('todos')
                                  .update({ 
                                    is_completed: true,
                                    completed_at: new Date().toISOString()
                                  })
                                  .eq('id', todo.id);
                                
                                if (error) throw error;
                                loadTodos();
                                
                                toast({
                                  title: "ToDo erledigt",
                                  description: "Das ToDo wurde als erledigt markiert."
                                });
                              } catch (error) {
                                console.error('Error completing todo:', error);
                                toast({
                                  title: "Fehler",
                                  description: "ToDo konnte nicht als erledigt markiert werden.",
                                  variant: "destructive"
                                });
                              }
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{todo.title}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: todo.category_color }}
                          />
                          {todo.category_label}
                        </div>
                      </TableCell>
                      <TableCell>
                        {todo.due_date && (
                          <div className={`text-sm ${isOverdue(todo.due_date) ? 'text-red-600' : ''}`}>
                            {new Date(todo.due_date).toLocaleDateString('de-DE')}
                            {isOverdue(todo.due_date) && ' (überfällig)'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* ToDo actions could go here */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Main Tasks List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Lade Aufgaben...</div>
            </div>
          ) : filteredTasksWithSnooze.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  Keine Aufgaben vorhanden
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Aufgabe hinzufügen
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredTasksWithSnooze.map((task) => (
              <Card key={task.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleTaskClick(task)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={() => {
                        toggleTaskStatus(task.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground text-lg">{task.title}</h3>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{task.description}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary">
                            {task.category === "legislation" ? "Gesetzgebung" :
                             task.category === "committee" ? "Ausschuss" :
                             task.category === "constituency" ? "Wahlkreis" : "Persönlich"}
                          </Badge>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div 
                                  className={`w-3 h-3 rounded-full ${
                                    task.priority === "high" ? "bg-red-500" :
                                    task.priority === "medium" ? "bg-yellow-500" : "bg-green-500"
                                  }`}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {task.priority === "high" ? "Hoch" :
                                   task.priority === "medium" ? "Mittel" : "Niedrig"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span className={isOverdue(task.dueDate) ? "text-red-600" : ""}>
                            {new Date(task.dueDate).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                        
                         {(subtaskCounts[task.id] || 0) > 0 && (
                           <div 
                             className="flex items-center gap-1 cursor-pointer hover:text-primary"
                             onClick={(e) => {
                               e.stopPropagation();
                               if (showSubtasksFor === task.id) {
                                 setShowSubtasksFor(null);
                               } else {
                                 loadSubtasksForTask(task.id);
                                 setShowSubtasksFor(task.id);
                               }
                             }}
                           >
                             {showSubtasksFor === task.id ? (
                               <ChevronDown className="h-4 w-4" />
                             ) : (
                               <ChevronRight className="h-4 w-4" />
                             )}
                             <span>{subtaskCounts[task.id]} Unteraufgaben</span>
                           </div>
                         )}
                         
                         {(taskDocuments[task.id] || 0) > 0 && (
                           <div 
                             className="flex items-center gap-1 cursor-pointer hover:text-primary"
                             onClick={(e) => {
                               e.stopPropagation();
                               if (showDocumentsFor === task.id) {
                                 setShowDocumentsFor(null);
                               } else {
                                 loadTaskDocuments();
                                 setShowDocumentsFor(task.id);
                               }
                             }}
                           >
                             {showDocumentsFor === task.id ? (
                               <ChevronDown className="h-4 w-4" />
                             ) : (
                               <ChevronRight className="h-4 w-4" />
                             )}
                             <span>{taskDocuments[task.id]} Dokumente</span>
                           </div>
                         )}
                         
                         {taskSnoozes[task.id] && (
                           <div className="flex items-center gap-1">
                             <AlarmClock className="h-4 w-4" />
                             <span>Wiedervorlage</span>
                           </div>
                         )}
                        
                        {task.assignedTo && (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{users.find(u => u.user_id === task.assignedTo)?.display_name || task.assignedTo}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                           <span>Kommentare ({taskComments[task.id]?.length || 0})</span>
                         </div>
                       </div>
                       
                       {/* Expandable Subtasks */}
                       {showSubtasksFor === task.id && subtasks[task.id] && (
                         <div className="mt-4 pl-6 border-l-2 border-muted space-y-2">
                           <h4 className="text-sm font-medium text-muted-foreground">Unteraufgaben:</h4>
                           {subtasks[task.id].map((subtask) => (
                             <div key={subtask.id} className="flex items-center gap-2 text-sm">
                               <Checkbox
                                 checked={subtask.is_completed}
                                 onCheckedChange={(checked) => {
                                   // Handle subtask completion here if needed
                                 }}
                                 className="h-3 w-3"
                               />
                               <span className={subtask.is_completed ? "line-through text-muted-foreground" : ""}>
                                 {subtask.title}
                               </span>
                             </div>
                           ))}
                         </div>
                       )}
                       
                       {/* Expandable Documents */}
                       {showDocumentsFor === task.id && taskDocumentDetails[task.id] && (
                         <div className="mt-4 pl-6 border-l-2 border-muted space-y-2">
                           <h4 className="text-sm font-medium text-muted-foreground">Dokumente:</h4>
                           {taskDocumentDetails[task.id].map((document) => (
                             <div key={document.id} className="flex items-center gap-2 text-sm">
                               <Paperclip className="h-3 w-3" />
                               <span>{document.file_name}</span>
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 className="h-6 w-6 p-0"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   // Handle document download
                                 }}
                               >
                                 <Download className="h-3 w-3" />
                               </Button>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   </div>
                 </CardContent>
               </Card>
            ))
          )}
        </div>
      </div>

      {/* Modals and Dialogs */}
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
                value={completionResult}
                onChange={(e) => setCompletionResult(e.target.value)}
                placeholder="Beschreiben Sie kurz, wie die Aufgabe erledigt wurde..."
                className="mt-2"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCompletingSubtask(null);
                  setCompletionResult('');
                }}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  if (completingSubtask) {
                    handleSubtaskComplete(completingSubtask, true, completionResult);
                  }
                }}
                className="flex-1"
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
                className="mt-2"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSnoozeDialogOpen(null);
                  setSnoozeDate('');
                }}
                className="flex-1"
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
        hideSnoozeSubtasks={hideSnoozeSubtasks}
        onToggleHideSnoozeSubtasks={setHideSnoozeSubtasks}
      />

      {/* Todo Create Dialog */}
      <TodoCreateDialog
        open={todoCreateOpen}
        onOpenChange={setTodoCreateOpen}
        onTodoCreated={loadTodos}
      />
    </>
  );
}