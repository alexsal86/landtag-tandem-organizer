import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  Archive,
  MessageSquare,
  Eye,
  EyeOff,
  FileText,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  AlarmClock,
  ListTodo,
  ClipboardList,
  StickyNote
} from "lucide-react";
import { TaskArchiveModal } from "@/components/TaskArchiveModal";
import { TaskDetailSidebar } from "@/components/TaskDetailSidebar";
import { TodoCreateDialog } from "@/components/TodoCreateDialog";
import { SnoozeManagementSidebar } from "@/components/SnoozeManagementSidebar";

// Types
interface Task {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "completed";
  priority: "low" | "medium" | "high";
  category?: string;
  dueDate?: string;
  assignedTo?: string[];
  createdAt: string;
  updatedAt?: string;
  user_id: string;
  tenant_id: string;
}

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  assigned_to: string | string[];
  due_date?: string;
  created_at: string;
  updated_at?: string;
  result_text?: string;
  completed_at?: string;
  source_type?: 'task' | 'planning' | 'call_followup';
  task_title?: string;
  checklist_item_title?: string;
  planning_item_id?: string;
  call_log_id?: string;
}

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  user_name?: string;
}

interface Todo {
  id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  user_id: string;
  category: string;
  created_at: string;
  updated_at?: string;
}

export function TasksView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
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
  const [todos, setTodos] = useState<Array<Todo>>([]);
  const [assignedTasks, setAssignedTasks] = useState<Array<Task & { 
    dueDate?: string;
  }>>([]);
  const [quickNoteDialog, setQuickNoteDialog] = useState<{ open: boolean; taskId: string | null }>({ open: false, taskId: null });
  const [quickNoteContent, setQuickNoteContent] = useState("");

  console.log('TodoCreateOpen state:', todoCreateOpen);
  
  const { toast } = useToast();

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
    loadTaskComments();
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
      const { data: taskSnoozes, error: taskError } = await supabase
        .from('task_snoozes')
        .select('*, tasks(title)')
        .eq('user_id', user.id)
        .not('task_id', 'is', null);

      if (taskError) throw taskError;

      const { data: subtaskSnoozes, error: subtaskError } = await supabase
        .from('task_snoozes')
        .select('*, subtasks(title, description)')
        .eq('user_id', user.id)
        .not('subtask_id', 'is', null);

      if (subtaskError) throw subtaskError;

      const taskIds = taskSnoozes.map(s => s.task_id);
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title')
        .in('id', taskIds);

      const allSnoozes = [
        ...taskSnoozes.map(snooze => ({
          id: snooze.id,
          task_id: snooze.task_id,
          snoozed_until: snooze.snoozed_until,
          task_title: tasks?.find(t => t.id === snooze.task_id)?.title || 'Unbekannte Aufgabe',
          subtask_description: 'Aufgabe',
        })),
        ...subtaskSnoozes.map(snooze => ({
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
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false);

      if (error) throw error;

      const todosWithCategory = (data || []).map(todo => ({
        ...todo,
        category: 'todo',
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
    console.log('Current user object:', user);
    
    try {
      // Get regular subtasks assigned to this user
      const { data: subtasksData, error } = await supabase
        .from('subtasks')
        .select('*, result_text, completed_at')
        .contains('assigned_to', [user.id])
        .eq('is_completed', false);

      if (error) throw error;

      // Get planning subtasks assigned to this user
      const { data: planningSubtasksData, error: planningError } = await supabase
        .from('planning_item_subtasks')
        .select('*, result_text, completed_at')
        .eq('assigned_to', user.id)
        .eq('is_completed', false);

      if (planningError) throw planningError;

      // Get call follow-up tasks assigned to this user
      console.log('Looking for call follow-up tasks for user:', user.id, 'email:', user.email);
      
      const { data: callFollowupData, error: callFollowupError } = await supabase
        .from('tasks')
        .select('*, call_log_id')
        .eq('category', 'call_follow_up')
        .neq('status', 'completed');
      
      console.log('Call follow-up tasks query result:', callFollowupData);
      
      // Filter those assigned to current user
      const userCallFollowups = (callFollowupData || []).filter(task => 
        (Array.isArray(task.assigned_to) && (task.assigned_to.includes(user.email) || task.assigned_to.includes(user.id))) ||
        task.user_id === user.id
      );

      console.log('Regular subtasks:', subtasksData);
      console.log('Planning subtasks:', planningSubtasksData);
      console.log('User assigned call follow-ups:', userCallFollowups);

      // Combine subtasks with task titles
      const allSubtasks = [];

      // Process regular subtasks
      if (subtasksData) {
        for (const subtask of subtasksData) {
          // Skip subtasks not assigned to current user
          if (!Array.isArray(subtask.assigned_to) || !subtask.assigned_to.includes(user.id)) {
            continue;
          }

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
          // Skip subtasks not assigned to current user
          if (subtask.assigned_to !== user.id) {
            continue;
          }

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

      // Process call follow-up tasks as pseudo-subtasks
      if (userCallFollowups && userCallFollowups.length > 0) {
        for (const followupTask of userCallFollowups) {
          // Skip if not assigned to current user
          const assignees = Array.isArray(followupTask.assigned_to) 
            ? followupTask.assigned_to 
            : (followupTask.assigned_to || '').split(',').map(a => a.trim());
          
          if (!assignees.includes(user.id) && !assignees.includes(user.email)) {
            continue;
          }

          // Get contact name from call log
          let contactName = 'Unbekannter Kontakt';
          if (followupTask.call_log_id) {
            const { data: callLogData } = await supabase
              .from('call_logs')
              .select('contact_id')
              .eq('id', followupTask.call_log_id)
              .single();

            if (callLogData?.contact_id) {
              const { data: contactData } = await supabase
                .from('contacts')
                .select('name')
                .eq('id', callLogData.contact_id)
                .single();
              
              contactName = contactData?.name || contactName;
            }
          }

          // Convert task to subtask format
          allSubtasks.push({
            id: followupTask.id,
            title: followupTask.title,
            description: followupTask.description,
            task_id: followupTask.id,
            task_title: `Follow-Up: ${contactName}`,
            source_type: 'call_followup' as const,
            assigned_to: followupTask.assigned_to,
            due_date: followupTask.due_date,
            is_completed: followupTask.status === 'completed',
            created_at: followupTask.created_at,
            updated_at: followupTask.updated_at,
            call_log_id: followupTask.call_log_id
          });
        }
      }

      console.log('All assigned subtasks:', allSubtasks);
      console.log('Setting assignedSubtasks state with', allSubtasks.length, 'items');
      setAssignedSubtasks(allSubtasks);
    } catch (error) {
      console.error('Error loading assigned subtasks:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');

      if (error) throw error;
      console.log('Loaded users from profiles:', data);
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users from profiles:', error);
      
      // Fallback: Try to get current user info at least
      if (user) {
        console.log('Using fallback user info');
        setUsers([{ user_id: user.id, display_name: user.email }]);
      }
    }
  };

  const loadRecentActivities = async () => {
    // This is a simplified version - in a real app you'd have an activities table
    setRecentActivities([]);
  };

  const loadTaskConfiguration = async () => {
    try {
      // Load task categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('task_configuration')
        .select('*')
        .eq('type', 'category');

      if (categoriesError) throw categoriesError;

      const categories = (categoriesData || []).map(config => ({
        name: config.value,
        label: config.label || config.value
      }));

      setTaskCategories(categories);

      // Load task statuses
      const { data: statusesData, error: statusesError } = await supabase
        .from('task_configuration')
        .select('*')
        .eq('type', 'status');

      if (statusesError) throw statusesError;

      const statuses = (statusesData || []).map(config => ({
        name: config.value,
        label: config.label || config.value
      }));

      setTaskStatuses(statuses);
    } catch (error) {
      console.error('Error loading task configuration:', error);
    }
  };

  const loadTasks = async () => {
    if (!user || !currentTenant) return;
    
    try {
      setLoading(true);
      console.log('Loading tasks for user:', user.id, 'tenant:', currentTenant.id);
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTasks(data || []);
      
      // Load assigned tasks (tasks where user is assigned but not the creator)
      const assigned = (data || []).filter(task => {
        const assignees = Array.isArray(task.assigned_to) ? task.assigned_to : [];
        return assignees.includes(user.id) || assignees.includes(user.email);
      }).map(task => ({
        ...task,
        dueDate: task.due_date
      }));
      
      setAssignedTasks(assigned);
      console.log('Loaded assigned tasks:', assigned);
      
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

  const loadTaskDocumentCounts = async () => {
    if (!user || !currentTenant) return;
    
    try {
      const { data, error } = await supabase
        .from('task_documents')
        .select('task_id')
        .eq('tenant_id', currentTenant.id);

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
    if (!user || !currentTenant) return;
    
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('task_id')
        .eq('tenant_id', currentTenant.id);

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

  const loadTaskComments = async () => {
    if (!user || !currentTenant) return;
    
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('task_comments')
        .select(`
          *,
          profiles(display_name)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      const commentsByTask: { [taskId: string]: TaskComment[] } = {};
      (commentsData || []).forEach(comment => {
        if (!commentsByTask[comment.task_id]) {
          commentsByTask[comment.task_id] = [];
        }
        commentsByTask[comment.task_id].push({
          ...comment,
          user_name: comment.profiles?.display_name || 'Unbekannter Benutzer'
        });
      });

      setTaskComments(commentsByTask);
    } catch (error) {
      console.error('Error loading task comments:', error);
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    return due < today && due.toDateString() !== today.toDateString();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = (category?: string) => {
    if (!category) return 'bg-gray-100 text-gray-800 border-gray-200';
    
    switch (category) {
      case 'development': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'design': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'marketing': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'support': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'call_follow_up': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Function to filter tasks based on current filters
  const getFilteredTasks = () => {
    return tasks.filter(task => {
      const matchesFilter = filter === "all" || task.status === filter;
      const matchesCategory = categoryFilter === "all" || task.category === categoryFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      
      return matchesFilter && matchesCategory && matchesPriority;
    });
  };

  const filteredTasks = getFilteredTasks();
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
            <div className="flex gap-3">
              <Button
                onClick={() => setSnoozeManagementOpen(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <AlarmClock className="h-4 w-4" />
                Wiedervorlagen verwalten
              </Button>
              <Button
                onClick={() => setArchiveModalOpen(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Archiv
              </Button>
              <Button
                onClick={() => setTodoCreateOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Neue Aufgabe
              </Button>
            </div>
          </div>

          {/* Task Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Gesamt</p>
                    <p className="text-2xl font-bold">{taskCounts.all}</p>
                  </div>
                  <ListTodo className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Zu erledigen</p>
                    <p className="text-2xl font-bold text-orange-600">{taskCounts.todo}</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">In Bearbeitung</p>
                    <p className="text-2xl font-bold text-blue-600">{taskCounts.inProgress}</p>
                  </div>
                  <ClipboardList className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Erledigt</p>
                    <p className="text-2xl font-bold text-green-600">{taskCounts.completed}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Überfällig</p>
                    <p className="text-2xl font-bold text-red-600">{taskCounts.overdue}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Assigned Tasks, Subtasks and ToDos Table */}
        {(assignedTasks.length > 0 || assignedSubtasks.length > 0 || todos.length > 0) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Mir zugewiesene Aufgaben & Unteraufgaben ({assignedTasks.length + assignedSubtasks.length + todos.length})
                {hideSnoozeSubtasks && assignedSubtasks.length !== filteredAssignedSubtasks.length && (
                  <span className="text-sm text-muted-foreground">
                    ({assignedTasks.length + filteredAssignedSubtasks.length + todos.length} sichtbar)
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
                    <TableHead>Typ/Kategorie</TableHead>
                    <TableHead>Fälligkeitsdatum</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Show assigned tasks */}
                  {assignedTasks.map((task) => (
                    <TableRow key={`task-${task.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={task.status === "completed"}
                          onCheckedChange={() => {
                            // Handle task completion
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{task.title}</div>
                        {task.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {task.description.length > 100 
                              ? `${task.description.substring(0, 100)}...` 
                              : task.description
                            }
                          </div>
                        )}
                      </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Aufgabe
                          </Badge>
                        </TableCell>
                      <TableCell>
                        {task.dueDate && task.dueDate !== '1970-01-01T00:00:00.000Z' && task.dueDate !== '1970-01-01' ? (
                          <div className={`text-sm ${isOverdue(task.dueDate) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {new Date(task.dueDate).toLocaleDateString('de-DE')}
                            {isOverdue(task.dueDate) && ' (überfällig)'}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">unbefristet</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTask(task);
                            setSidebarOpen(true);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  
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
                                  // Handle subtask completion
                                }
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{subtask.title || subtask.description}</div>
                            {subtask.description && subtask.title && (
                              <div className="text-sm text-muted-foreground">{subtask.description}</div>
                            )}
                            {isSnoozed && (
                              <Badge variant="secondary" className="text-xs">
                                Wiedervorlage: {new Date(subtaskSnoozes[subtask.id]).toLocaleDateString('de-DE')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Unteraufgabe
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {subtask.due_date && subtask.due_date !== '1970-01-01T00:00:00.000Z' && subtask.due_date !== '1970-01-01' ? (
                            <div className={`text-sm ${isOverdue(subtask.due_date) ? 'text-red-600' : ''}`}>
                              {new Date(subtask.due_date).toLocaleDateString('de-DE')}
                              {isOverdue(subtask.due_date) && ' (überfällig)'}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">unbefristet</div>
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
                        {todo.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {todo.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          ToDo
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">unbefristet</div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from('todos')
                                .delete()
                                .eq('id', todo.id);
                              
                              if (error) throw error;
                              loadTodos();
                              
                              toast({
                                title: "ToDo gelöscht",
                                description: "Das ToDo wurde erfolgreich gelöscht."
                              });
                            } catch (error) {
                              console.error('Error deleting todo:', error);
                              toast({
                                title: "Fehler",
                                description: "ToDo konnte nicht gelöscht werden.",
                                variant: "destructive"
                              });
                            }
                          }}
                          className="h-8 w-8 p-0"
                          title="ToDo löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {assignedTasks.length === 0 && assignedSubtasks.length === 0 && todos.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Keine zugewiesenen Aufgaben gefunden.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Tasks Section */}
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      <SelectItem value="todo">Zu erledigen</SelectItem>
                      <SelectItem value="in-progress">In Bearbeitung</SelectItem>
                      <SelectItem value="completed">Erledigt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Kategorie</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      {taskCategories.map(category => (
                        <SelectItem key={category.name} value={category.name}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Priorität</label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      <SelectItem value="high">Hoch</SelectItem>
                      <SelectItem value="medium">Mittel</SelectItem>
                      <SelectItem value="low">Niedrig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Lade Aufgaben...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasksWithSnooze.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <ListTodo className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {tasks.length === 0 
                        ? "Noch keine Aufgaben erstellt." 
                        : "Keine Aufgaben entsprechen den gewählten Filtern."
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredTasksWithSnooze.map((task) => (
                  <Card key={task.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Task Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                              checked={task.status === "completed"}
                              onCheckedChange={() => {
                                // Handle task status toggle
                              }}
                            />

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-lg">{task.title}</h3>
                                <Badge variant="outline" className={getPriorityColor(task.priority)}>
                                  {task.priority === 'high' ? 'Hoch' : 
                                   task.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                                </Badge>
                                {task.category && (
                                  <Badge variant="outline" className={getCategoryColor(task.category)}>
                                    {taskCategories.find(c => c.name === task.category)?.label || task.category}
                                  </Badge>
                                )}
                              </div>
                              
                              {task.description && (
                                <p className="text-muted-foreground mb-3">
                                  {task.description}
                                </p>
                              )}

                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                {task.dueDate && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    <span className={isOverdue(task.dueDate) ? 'text-red-600 font-medium' : ''}>
                                      {new Date(task.dueDate).toLocaleDateString('de-DE')}
                                      {isOverdue(task.dueDate) && ' (überfällig)'}
                                    </span>
                                  </div>
                                )}
                                
                                {task.assignedTo && task.assignedTo.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    <span>
                                      {task.assignedTo.map(userId => 
                                        users.find(u => u.user_id === userId)?.display_name || userId
                                      ).join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTask(task);
                                setSidebarOpen(true);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Task Stats */}
                        <div className="flex items-center gap-4 pt-2 border-t">
                          {subtaskCounts[task.id] > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                console.log('Clicked subtasks for task:', task.id);
                                if (showSubtasksFor === task.id) {
                                  setShowSubtasksFor(null);
                                } else {
                                  setShowSubtasksFor(task.id);
                                  // Load subtasks if not already loaded
                                }
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {showSubtasksFor === task.id ? (
                                <ChevronDown className="h-4 w-4 mr-1" />
                              ) : (
                                <ChevronRight className="h-4 w-4 mr-1" />
                              )}
                              {subtaskCounts[task.id]} Unteraufgaben
                            </Button>
                          )}

                          {taskDocuments[task.id] > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (showDocumentsFor === task.id) {
                                  setShowDocumentsFor(null);
                                } else {
                                  setShowDocumentsFor(task.id);
                                }
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {showDocumentsFor === task.id ? (
                                <ChevronDown className="h-4 w-4 mr-1" />
                              ) : (
                                <ChevronRight className="h-4 w-4 mr-1" />
                              )}
                              <FileText className="h-4 w-4 mr-1" />
                              {taskDocuments[task.id]} Dokumente
                            </Button>
                          )}

                          {taskComments[task.id]?.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (showCommentsFor === task.id) {
                                  setShowCommentsFor(null);
                                } else {
                                  setShowCommentsFor(task.id);
                                }
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {showCommentsFor === task.id ? (
                                <ChevronDown className="h-4 w-4 mr-1" />
                              ) : (
                                <ChevronRight className="h-4 w-4 mr-1" />
                              )}
                              <MessageSquare className="h-4 w-4 mr-1" />
                              {taskComments[task.id]?.length} Kommentare
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setQuickNoteDialog({ open: true, taskId: task.id })}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <StickyNote className="h-4 w-4 mr-1" />
                            Schnellnotiz
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals and Dialogs */}
      <TaskArchiveModal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        onTaskRestored={() => loadTasks()}
      />

      <TaskDetailSidebar
        task={selectedTask}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onTaskUpdate={() => loadTasks()}
        onTaskRestored={() => loadTasks()}
        taskCategories={taskCategories}
        taskStatuses={taskStatuses}
      />

      <TodoCreateDialog
        todoCreateOpen={todoCreateOpen}
        setTodoCreateOpen={setTodoCreateOpen}
        onTaskCreated={() => {
          loadTasks();
          loadTodos();
        }}
      />

      <SnoozeManagementSidebar
        isOpen={snoozeManagementOpen}
        onClose={() => setSnoozeManagementOpen(false)}
        snoozes={allSnoozes}
        onUpdateSnooze={updateSnooze}
        onDeleteSnooze={deleteSnooze}
        hideSnoozeStates={{ 
          subtasks: hideSnoozeSubtasks 
        }}
        onHideSnoozeToggle={{
          subtasks: setHideSnoozeSubtasks
        }}
      />

      {/* Quick Note Dialog */}
      <Dialog open={quickNoteDialog.open} onOpenChange={(open) => setQuickNoteDialog({ open, taskId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schnellnotiz erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine schnelle Notiz für diese Aufgabe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Ihre Notiz..."
              value={quickNoteContent}
              onChange={(e) => setQuickNoteContent(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setQuickNoteDialog({ open: false, taskId: null });
                  setQuickNoteContent('');
                }}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  // Handle quick note creation
                  setQuickNoteDialog({ open: false, taskId: null });
                  setQuickNoteContent('');
                }}
                disabled={!quickNoteContent.trim()}
                className="flex-1"
              >
                Notiz erstellen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
     </>
   );
 }

export default TasksView;