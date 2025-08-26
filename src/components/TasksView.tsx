import { useState, useEffect } from "react";
import { Plus, CheckSquare, Square, Clock, Flag, Calendar, User, Edit2, Archive, MessageCircle, Send, Filter, Trash2, Check, X, Paperclip, Download, ChevronDown, ChevronRight, ListTodo, AlarmClock, StickyNote } from "lucide-react";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
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
  category: "legislation" | "constituency" | "committee" | "personal" | "call_followup" | "call_follow_up";
  assignedTo?: string; // Changed from string[] to string (comma-separated values)
  progress?: number;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  call_log_id?: string;
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
  assigned_to?: string[];
  assigned_to_names?: string; // New field for resolved names
  due_date?: string;
  order_index: number;
  completed_at?: string;
  result_text?: string;
  planning_item_id?: string;
  source_type?: 'task' | 'planning' | 'call_followup';
  checklist_item_title?: string;
  call_log_id?: string;
  contact_name?: string;
  priority?: string;
  created_at?: string;
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
  const [todos, setTodos] = useState<Array<{
    id: string;
    title: string;
    category_label: string;
    category_color: string;
    assigned_to: string | null; // Changed from string[] to string
    due_date: string | null;
    is_completed: boolean;
  }>>([]);
  const [quickNoteDialog, setQuickNoteDialog] = useState<{ open: boolean; taskId: string | null }>({ open: false, taskId: null });
  const [quickNoteContent, setQuickNoteContent] = useState("");
  
  console.log('TodoCreateOpen state:', todoCreateOpen); // Debug log
  
  const { toast } = useToast();

  // Load tasks from database
  useEffect(() => {
    const loadAllData = async () => {
      console.log('Starting to load all data...');
      
      // Load users first, since we need them for UUID resolution
      await loadUsers();
      
      // Then load everything else
      await Promise.all([
        loadTasks(),
        loadRecentActivities(),
        loadTaskConfiguration(),
        loadTaskDocumentCounts(),
        loadSubtaskCounts(),
        loadTaskSnoozes(),
        loadTodos(),
        loadTaskComments()
      ]);
      
      // Load assigned subtasks last, after users are loaded
      await loadAssignedSubtasks();
      
      console.log('All data loaded');
    };
    
    loadAllData();
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
        assigned_to: Array.isArray(todo.assigned_to) ? todo.assigned_to.join(',') : (todo.assigned_to || ''),
        due_date: todo.due_date,
        is_completed: todo.is_completed
      }));

      setTodos(todosWithCategory);
    } catch (error) {
      console.error('Error loading todos:', error);
    }
  };

  // Helper function to resolve UUIDs to display names using Supabase
  const resolveUserNamesAsync = async (assignedToField: string | string[] | null): Promise<string> => {
    if (!assignedToField) return '';
    
    // Clean up the field - remove curly braces and handle different formats
    let cleanField = assignedToField;
    if (typeof assignedToField === 'string') {
      // Remove curly braces and clean up
      cleanField = assignedToField.replace(/[{}]/g, '').trim();
    }
    
    const userIds = Array.isArray(cleanField) 
      ? cleanField 
      : typeof cleanField === 'string' 
        ? cleanField.split(',').map(id => id.trim()).filter(id => id)
        : [];
    
    if (userIds.length === 0) return '';

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (error) throw error;

      const nameMap = new Map(data?.map(profile => [profile.user_id, profile.display_name]) || []);
      
      return userIds
        .map(userId => nameMap.get(userId) || userId)
        .join(', ');
    } catch (error) {
      console.error('Error resolving user names:', error);
      return userIds.join(', '); // Fallback to showing UUIDs
    }
  };

  // Synchronous helper that uses cached user data
  const resolveUserNames = (assignedToField: string | string[] | null): string => {
    if (!assignedToField) return '';
    
    // Clean up the field - remove curly braces and handle different formats
    let cleanField = assignedToField;
    if (typeof assignedToField === 'string') {
      // Remove curly braces and clean up
      cleanField = assignedToField.replace(/[{}]/g, '').trim();
    }
    
    const userIds = Array.isArray(cleanField) 
      ? cleanField 
      : typeof cleanField === 'string' 
        ? cleanField.split(',').map(id => id.trim()).filter(id => id)
        : [];
    
    console.log('🔍 Resolving user names for:', userIds, 'from original field:', assignedToField);
    
    return userIds
      .map(userId => {
        const user = users.find(u => u.user_id === userId);
        const result = user?.display_name || userId;
        console.log(`📝 User ${userId} resolved to: ${result}`);
        return result;
      })
      .join(', ');
  };

  const loadAssignedSubtasks = async () => {
    if (!user) {
      console.log('❌ No user found for assigned subtasks');
      return;
    }
    
    console.log('🔄 Loading assigned subtasks for user:', user.id, 'email:', user.email);
    setAssignedSubtasks([]); // Clear existing data
    
    try {
      const allSubtasks = [];

      // 1. Get regular subtasks assigned to this user
      console.log('📋 Loading regular subtasks...');
      const { data: subtasksData, error: subtasksError } = await supabase
        .from('subtasks')
        .select('*')
        .or(`assigned_to.eq.${user.id},assigned_to.eq.{${user.id}},assigned_to.like.%${user.id}%`)
        .eq('is_completed', false);

      if (subtasksError) {
        console.error('❌ Error loading regular subtasks:', subtasksError);
      } else {
        console.log('✅ Raw regular subtasks data:', subtasksData);
        
        if (subtasksData) {
          for (const subtask of subtasksData) {
            console.log('📝 Processing regular subtask:', subtask.id, 'assigned_to:', subtask.assigned_to);
            
            try {
              // Get task title separately
              const { data: taskData } = await supabase
                .from('tasks')
                .select('title')
                .eq('id', subtask.task_id)
                .single();

              // Keep original assigned_to array and resolve all names
              const resolvedAssignedTo = await resolveUserNamesAsync(subtask.assigned_to || []);
              
              allSubtasks.push({
                ...subtask,
                task_title: taskData?.title || 'Unbekannte Aufgabe',
                source_type: 'task' as const,
                assigned_to_names: resolvedAssignedTo,
                assigned_to: subtask.assigned_to || [] // Keep original assignment
              });
              
              console.log('✅ Added regular subtask:', subtask.id);
            } catch (resolveError) {
              console.error('❌ Error resolving names for subtask:', subtask.id, resolveError);
              // Add without resolved names as fallback
              allSubtasks.push({
                ...subtask,
                task_title: 'Unbekannte Aufgabe',
                source_type: 'task' as const,
                assigned_to_names: resolveUserNames(subtask.assigned_to)
              });
            }
          }
        }
      }

      // 2. Get planning subtasks assigned to this user
      console.log('📅 Loading planning subtasks...');
      const { data: planningSubtasksData, error: planningError } = await supabase
        .from('planning_item_subtasks')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('is_completed', false);

      if (planningError) {
        console.error('❌ Error loading planning subtasks:', planningError);
      } else {
        console.log('✅ Raw planning subtasks data:', planningSubtasksData);
        
        if (planningSubtasksData) {
          for (const subtask of planningSubtasksData) {
            console.log('📝 Processing planning subtask:', subtask.id, 'assigned_to:', subtask.assigned_to);
            
            try {
              const resolvedAssignedTo = await resolveUserNamesAsync([subtask.assigned_to]);
              
              // Get checklist item and planning title separately
              const { data: checklistItemData } = await supabase
                .from('event_planning_checklist_items')
                .select('title, event_planning_id')
                .eq('id', subtask.planning_item_id)
                .single();

              let planningTitle = 'Unbekannte Planung';
              if (checklistItemData?.event_planning_id) {
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
                planning_item_id: subtask.planning_item_id,
                assigned_to_names: resolvedAssignedTo,
                assigned_to: [subtask.assigned_to] // Convert single value to array for consistency
              });
              
              console.log('✅ Added planning subtask:', subtask.id);
            } catch (resolveError) {
              console.error('❌ Error resolving names for planning subtask:', subtask.id, resolveError);
              // Add without resolved names as fallback
              allSubtasks.push({
                ...subtask,
                task_title: 'Unbekannte Planung',
                source_type: 'planning' as const,
                planning_item_id: subtask.planning_item_id,
                assigned_to_names: resolveUserNames([subtask.assigned_to]),
                assigned_to: [subtask.assigned_to]
              });
            }
          }
        }
      }

      // 3. Get call follow-up tasks assigned to this user
      console.log('📞 Loading call follow-up tasks...');
      const { data: callFollowupData, error: callFollowupError } = await supabase
        .from('tasks')
        .select('*')
        .eq('category', 'call_follow_up')
        .neq('status', 'completed');
      
      if (callFollowupError) {
        console.error('❌ Error loading call follow-up tasks:', callFollowupError);
      } else {
        console.log('✅ Raw call follow-up data:', callFollowupData);
        
        // Filter those assigned to current user
        const userCallFollowups = (callFollowupData || []).filter(task => {
          const assignees = Array.isArray(task.assigned_to) 
            ? task.assigned_to 
            : (task.assigned_to || '').split(',').map(a => a.trim());
          
          const isAssigned = assignees.includes(user.id) || 
                           assignees.includes(user.email) || 
                           task.user_id === user.id;
          
          console.log('📝 Checking call follow-up task:', task.id, 'assignees:', assignees, 'isAssigned:', isAssigned);
          return isAssigned;
        });

        console.log('📞 Filtered call follow-up tasks for user:', userCallFollowups.length);

        for (const followupTask of userCallFollowups) {
          console.log('📝 Processing call follow-up task:', followupTask.id);
          
          try {
            const assignees = Array.isArray(followupTask.assigned_to) 
              ? followupTask.assigned_to 
              : (followupTask.assigned_to || '').split(',').map(a => a.trim());
            
            const resolvedAssignedTo = await resolveUserNamesAsync(assignees);
            
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
              priority: followupTask.priority,
              call_log_id: followupTask.call_log_id,
              contact_name: contactName,
              order_index: 0,
              assigned_to_names: resolvedAssignedTo
            });
            
            console.log('✅ Added call follow-up task:', followupTask.id);
          } catch (resolveError) {
            console.error('❌ Error resolving names for call follow-up:', followupTask.id, resolveError);
            // Add without resolved names as fallback
            const assignees = Array.isArray(followupTask.assigned_to) 
              ? followupTask.assigned_to 
              : (followupTask.assigned_to || '').split(',').map(a => a.trim());
            
            allSubtasks.push({
              id: followupTask.id,
              title: followupTask.title,
              description: followupTask.description,
              task_id: followupTask.id,
              task_title: `Follow-Up: Unbekannter Kontakt`,
              source_type: 'call_followup' as const,
              assigned_to: followupTask.assigned_to,
              due_date: followupTask.due_date,
              is_completed: followupTask.status === 'completed',
              created_at: followupTask.created_at,
              updated_at: followupTask.updated_at,
              priority: followupTask.priority,
              call_log_id: followupTask.call_log_id,
              contact_name: 'Unbekannter Kontakt',
              order_index: 0,
              assigned_to_names: resolveUserNames(assignees)
            });
          }
        }
      }

      console.log('🎯 FINAL RESULT - Total assigned subtasks found:', allSubtasks.length);
      console.log('📊 Breakdown:');
      console.log('  - Regular subtasks:', allSubtasks.filter(s => s.source_type === 'task').length);
      console.log('  - Planning subtasks:', allSubtasks.filter(s => s.source_type === 'planning').length);  
      console.log('  - Call follow-ups:', allSubtasks.filter(s => s.source_type === 'call_followup').length);
      console.log('📋 All subtasks details:', allSubtasks.map(s => ({
        id: s.id,
        title: s.title,
        source_type: s.source_type,
        assigned_to: s.assigned_to,
        assigned_to_names: s.assigned_to_names
      })));

      setAssignedSubtasks(allSubtasks);
    } catch (error) {
      console.error('💥 Critical error loading assigned subtasks:', error);
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
        category: task.category as "legislation" | "constituency" | "committee" | "personal" | "call_followup",
        assignedTo: Array.isArray(task.assigned_to) ? task.assigned_to.join(',') : (task.assigned_to || ''),
        progress: task.progress,
        created_at: task.created_at,
        updated_at: task.updated_at,
        user_id: task.user_id,
        call_log_id: task.call_log_id
      }));

      setTasks(transformedTasks);
      setLoading(false);
      
      // Load comments after tasks are loaded
      await loadTaskComments();
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
      console.log('Loading users...');
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');

      if (error) throw error;
      console.log('Loaded users for UUID resolution:', data);
      setUsers(data || []);
      console.log('Users state updated with', (data || []).length, 'users');
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTaskComments = async () => {
    try {
      console.log('Loading task comments...');
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          id,
          task_id,
          content,
          user_id,
          created_at,
          profiles!inner(display_name)
        `)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error from supabase:', error);
        throw error;
      }

      console.log('Raw comment data:', data);

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

      console.log('Final comments map:', commentsMap);
      setTaskComments(commentsMap);
    } catch (error) {
      console.error('Error loading task comments:', error);
      
      // Fallback: Try a simpler query without join
      try {
        console.log('Trying fallback query...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('task_comments')
          .select('id, task_id, content, user_id, created_at')
          .order('created_at', { ascending: true });

        if (fallbackError) throw fallbackError;

        console.log('Fallback comment data:', fallbackData);
        
        const commentsMap: { [taskId: string]: TaskComment[] } = {};
        (fallbackData || []).forEach(comment => {
          if (!commentsMap[comment.task_id]) {
            commentsMap[comment.task_id] = [];
          }
          commentsMap[comment.task_id].push({
            id: comment.id,
            taskId: comment.task_id,
            content: comment.content,
            userId: comment.user_id,
            userName: 'Benutzer',
            createdAt: comment.created_at
          });
        });

        setTaskComments(commentsMap);
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
      }
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
        .select('task_id, id, is_completed');

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
        .order('order_index');

      if (error) throw error;

      setSubtasks(prev => ({
        ...prev,
        [taskId]: (data || []).map(subtask => ({
          ...subtask,
          title: subtask.description || 'Unnamed subtask'
        })) as any
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
            assigned_to: task.assignedTo || '',
            progress: 100,
            due_date: task.dueDate,
            completed_at: new Date().toISOString(),
            auto_delete_after_days: null,
          } as any);

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
      console.log('Adding comment for task:', taskId, 'Content:', content);
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content: content
        });

      if (error) {
        console.error('Error inserting comment:', error);
        throw error;
      }

      setNewComment(prev => ({ ...prev, [taskId]: '' }));
      await loadTaskComments();
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

  const createQuickNoteFromTask = async () => {
    if (!user || !quickNoteDialog.taskId || !quickNoteContent.trim()) return;

    try {
      const task = tasks.find(t => t.id === quickNoteDialog.taskId);
      if (!task) return;

      const { error } = await supabase
        .from('quick_notes')
        .insert({
          user_id: user.id,
          title: `Task Note: ${task.title}`,
          content: quickNoteContent.trim(),
          category: 'task',
          color: '#3b82f6',
          is_pinned: false,
          tags: ['task', task.category]
        });

      if (error) throw error;

      toast({
        title: "Notiz erstellt",
        description: "Quick Note wurde erfolgreich erstellt.",
      });

      setQuickNoteDialog({ open: false, taskId: null });
      setQuickNoteContent("");
    } catch (error) {
      console.error('Error creating quick note:', error);
      toast({
        title: "Fehler",
        description: "Notiz konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
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
      const subtask = assignedSubtasks.find(s => s.id === subtaskId);
      if (!subtask) return;

      // Handle call follow-up tasks specially
      if (subtask.source_type === 'call_followup' && isCompleted && subtask.call_log_id) {
        await handleCallFollowUpComplete(subtask.call_log_id, result);
        
        // Mark the task as completed
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', subtaskId);

        if (taskError) throw taskError;
      } else {
        // Handle regular and planning subtasks
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
      }

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

  const handleCallFollowUpComplete = async (callLogId: string, resultText?: string) => {
    try {
      // Get the call log with contact information
      const { data: callLog, error: callLogError } = await supabase
        .from('call_logs')
        .select('*, contact_id, caller_phone, caller_name')
        .eq('id', callLogId)
        .single();

      if (callLogError) throw callLogError;

      if (callLog.contact_id) {
        // Contact exists - update call log with completion notes
        const { error: updateError } = await supabase
          .from('call_logs')
          .update({ 
            follow_up_completed: true,
            completion_notes: resultText || null
          })
          .eq('id', callLogId);

        if (updateError) throw updateError;

        toast({
          title: "Follow-Up erledigt",
          description: "Die Notizen wurden beim Kontakt gespeichert.",
        });
      } else {
        // No contact exists - create archive contact
        await createArchiveContact(callLog, resultText);
      }

      // Update associated appointment if it exists (add "Erledigt:" prefix)
      const { data: appointment } = await supabase
        .from('appointments')
        .select('title')
        .eq('call_log_id', callLogId)
        .single();

      if (appointment && !appointment.title.startsWith('Erledigt:')) {
        await supabase
          .from('appointments')
          .update({ 
            title: `Erledigt: ${appointment.title}`,
            status: 'completed'
          })
          .eq('call_log_id', callLogId);
      }
    } catch (error) {
      console.error('Error handling call follow-up completion:', error);
      throw error;
    }
  };

  const createArchiveContact = async (callLog: any, resultText?: string) => {
    try {
      const phone = callLog.caller_phone;
      const name = callLog.caller_name || `Unbekannter Anrufer (${phone})`;
      
      // Check if archive contact already exists for this phone number
      let archiveContact = null;
      if (phone) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('*')
          .eq('phone', phone)
          .eq('contact_type', 'archive')
          .eq('user_id', user!.id)
          .single();
        
        archiveContact = existingContact;
      }

      if (archiveContact) {
        // Update existing archive contact with new follow-up details
        const currentNotes = archiveContact.notes || '';
        const newNotes = currentNotes + 
          `\n\n--- Follow-Up vom ${new Date().toLocaleDateString('de-DE')} ---\n` +
          `Ursprünglicher Anruf: ${new Date(callLog.call_date).toLocaleString('de-DE')}\n` +
          `Anruftyp: ${callLog.call_type === 'incoming' ? 'Eingehend' : 'Ausgehend'}\n` +
          `Priorität: ${callLog.priority}\n` +
          `Ursprüngliche Notizen: ${callLog.notes || 'Keine'}\n` +
          `Follow-Up Ergebnis: ${resultText || 'Keine Notizen'}`;

        const { error: updateError } = await supabase
          .from('contacts')
          .update({ 
            notes: newNotes,
            last_contact: 'heute',
            updated_at: new Date().toISOString()
          })
          .eq('id', archiveContact.id);

        if (updateError) throw updateError;

        toast({
          title: "Follow-Up archiviert",
          description: `Details wurden zum bestehenden Archiv-Kontakt "${archiveContact.name}" hinzugefügt.`,
        });
      } else {
        // Create new archive contact
        const newContact = {
          user_id: user!.id,
          name: name,
          phone: phone,
          contact_type: 'archive',
          category: 'citizen',
          priority: 'low',
          last_contact: 'heute',
          notes: `=== CALL FOLLOW-UP ARCHIV ===\n` +
                 `Ursprünglicher Anruf: ${new Date(callLog.call_date).toLocaleString('de-DE')}\n` +
                 `Anruftyp: ${callLog.call_type === 'incoming' ? 'Eingehend' : 'Ausgehend'}\n` +
                 `Priorität: ${callLog.priority}\n` +
                 `Ursprüngliche Notizen: ${callLog.notes || 'Keine'}\n` +
                 `Follow-Up Ergebnis: ${resultText || 'Keine Notizen'}\n\n` +
                 `Dieser Kontakt wurde automatisch aus Call Follow-Ups erstellt.`,
          additional_info: 'Automatisch erstellt aus Call Follow-Up'
        };

        const { error: insertError } = await supabase
          .from('contacts')
          .insert({
            ...newContact,
            tenant_id: currentTenant?.id || ''
          });

        if (insertError) throw insertError;

        toast({
          title: "Follow-Up archiviert",
          description: `Neuer Archiv-Kontakt "${name}" wurde erstellt.`,
        });
      }

      // Mark the call log as completed
      const { error: callLogUpdateError } = await supabase
        .from('call_logs')
        .update({ 
          follow_up_completed: true,
          completion_notes: resultText || null
        })
        .eq('id', callLog.id);

      if (callLogUpdateError) throw callLogUpdateError;

    } catch (error) {
      console.error('Error creating archive contact:', error);
      throw error;
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
  }).filter(task => {
    // Hide call follow-up tasks from general view
    if (task.category === 'call_follow_up' || task.category === 'call_followup') return false;
    return true;
  });

  // Get tasks assigned to current user (including self-assigned)
  const assignedTasks = tasks.filter(task => {
    if (!task.assignedTo || !user) return false;
    const assignees = task.assignedTo.split(',').map(id => id.trim());
    const isAssignedToUser = assignees.includes(user.id) || 
                            assignees.includes(user.email) ||
                            assignees.includes(user.email?.toLowerCase());
    const isNotCompleted = task.status !== 'completed';
    // Show all assigned tasks, even if user is the creator
    return isAssignedToUser && isNotCompleted;
  });

  // Filter out snoozed tasks and subtasks for current user
  const filteredTasksWithSnooze = filteredTasks.filter(task => {
    return !taskSnoozes[task.id] || new Date(taskSnoozes[task.id]) <= new Date();
  });

  const filteredAssignedSubtasks = assignedSubtasks.filter(subtask => {
    console.log('🔍 Filtering subtask:', subtask.id, 'hideSnoozeSubtasks:', hideSnoozeSubtasks, 'snoozed:', !!subtaskSnoozes[subtask.id]);
    
    if (hideSnoozeSubtasks) {
      const isSnoozed = subtaskSnoozes[subtask.id] && new Date(subtaskSnoozes[subtask.id]) > new Date();
      if (isSnoozed) {
        console.log('❌ Hiding snoozed subtask:', subtask.id, 'until:', subtaskSnoozes[subtask.id]);
        return false;
      }
    }
    
    console.log('✅ Including subtask in filtered list:', subtask.id);
    return true;
  });

  console.log('🎯 FILTERING RESULTS:');
  console.log('  - Total assigned subtasks:', assignedSubtasks.length);
  console.log('  - Filtered assigned subtasks:', filteredAssignedSubtasks.length);
  console.log('  - Hide snooze subtasks enabled:', hideSnoozeSubtasks);

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
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Clicked "Neues ToDo" button, current state:', todoCreateOpen);
                    setTodoCreateOpen(true);
                    console.log('Set todoCreateOpen to true');
                  }}
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
              <div className="text-sm text-muted-foreground">
                Aufgaben: {assignedTasks.length} | Unteraufgaben: {assignedSubtasks.length} (sichtbar: {filteredAssignedSubtasks.length}) | ToDos: {todos.length}
                {assignedSubtasks.length !== filteredAssignedSubtasks.length && (  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHideSnoozeSubtasks(!hideSnoozeSubtasks)}
                    className="ml-2 h-6 px-2 text-xs"
                  >
                    {hideSnoozeSubtasks ? 'Alle anzeigen' : 'Wiedervorlagen ausblenden'}
                  </Button>
                )}
              </div>
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
                            toggleTaskStatus(task.id);
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
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">unbefristet</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskClick(task);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Show subtasks based on visibility setting */}
                         {filteredAssignedSubtasks.map((subtask) => {
                     const isSnoozed = subtaskSnoozes[subtask.id] && new Date(subtaskSnoozes[subtask.id]) > new Date();
                     console.log('Rendering subtask:', subtask.id, 'assigned_to:', subtask.assigned_to);
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
                           <div className="font-medium">{subtask.title || subtask.description}</div>
                           {subtask.description && subtask.title && (
                             <div className="text-sm text-muted-foreground">{subtask.description}</div>
                           )}
                             {(subtask.assigned_to_names || subtask.assigned_to) && (
                               <div className="text-sm text-muted-foreground">
                                 Zuständig: {subtask.assigned_to_names || resolveUserNames(subtask.assigned_to)}
                               </div>
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
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {todo.category_label}
                        </div>
                      </TableCell>
                      <TableCell>
                        {todo.due_date && todo.due_date !== '1970-01-01T00:00:00.000Z' && todo.due_date !== '1970-01-01' ? (
                          <div className={`text-sm ${isOverdue(todo.due_date) ? 'text-red-600' : ''}`}>
                            {new Date(todo.due_date).toLocaleDateString('de-DE')}
                            {isOverdue(todo.due_date) && ' (überfällig)'}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">unbefristet</div>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickNoteDialog({ open: true, taskId: task.id });
                            }}
                            title="Quick Note erstellen"
                          >
                            <StickyNote className="h-4 w-4" />
                          </Button>
                          <Badge variant="secondary">
                            {task.category === "legislation" ? "Gesetzgebung" :
                             task.category === "committee" ? "Ausschuss" :
                             task.category === "constituency" ? "Wahlkreis" : 
                             task.category === "call_followup" ? "Call Follow-up" : "Persönlich"}
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
                               console.log('Clicked subtasks for task:', task.id);
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
                             <ListTodo className="h-4 w-4" />
                             <span>{subtaskCounts[task.id]} Unteraufgaben</span>
                           </div>
                         )}
                         
                         {(taskDocuments[task.id] || 0) > 0 && (
                           <div 
                             className="flex items-center gap-1 cursor-pointer hover:text-primary"
                             onClick={(e) => {
                               e.stopPropagation();
                               console.log('Clicked documents for task:', task.id);
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
                             <Paperclip className="h-4 w-4" />
                             <span>{taskDocuments[task.id]} Dokumente</span>
                           </div>
                         )}
                         
                         <div 
                           className="flex items-center gap-1 cursor-pointer hover:text-primary"
                           onClick={(e) => {
                             e.stopPropagation();
                             setSnoozeDialogOpen({ type: 'task', id: task.id });
                             setSnoozeDate('');
                           }}
                           title="Auf Wiedervorlage setzen"
                         >
                           <AlarmClock className="h-4 w-4" />
                           <span>Wiedervorlage</span>
                         </div>
                         
                            {task.assignedTo && task.assignedTo.trim() && (
                              <div className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                <span>
                                  {task.assignedTo.split(',').map(userId => {
                                    const userName = users.find(u => u.user_id === userId.trim())?.display_name;
                                    return userName || userId.trim();
                                  }).join(', ')}
                                </span>
                              </div>
                            )}
                         
                         <div 
                           className="flex items-center gap-1 cursor-pointer hover:text-primary"
                           onClick={(e) => {
                             e.stopPropagation();
                             console.log('Clicked comments for task:', task.id, 'Current comments:', taskComments[task.id]);
                             if (showCommentsFor === task.id) {
                               setShowCommentsFor(null);
                             } else {
                               setShowCommentsFor(task.id);
                             }
                           }}
                         >
                           {showCommentsFor === task.id ? (
                             <ChevronDown className="h-4 w-4" />
                           ) : (
                             <ChevronRight className="h-4 w-4" />
                           )}
                           <MessageCircle className="h-4 w-4" />
                           <span>Kommentare ({(taskComments[task.id] || []).length})</span>
                         </div>
                       </div>
                       
                       {/* Expandable Subtasks */}
                       {showSubtasksFor === task.id && subtasks[task.id] && (
                         <div className="mt-4 space-y-3 animate-fade-in">
                           {/* Add Subtask Button */}
                           <div className="border border-dashed border-border rounded-lg p-3">
                             <Button
                               variant="outline"
                               size="sm"
                               className="gap-2 w-full"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 const title = prompt('Titel der Unteraufgabe:');
                                 if (title && user) {
                                   const addSubtask = async () => {
                                     try {
                                       const { error } = await supabase
                                         .from('subtasks')
                                         .insert({
                                           task_id: task.id,
                                           user_id: user.id,
                                           description: title,
                                           is_completed: false,
                                           order_index: subtasks[task.id].length
                                         });
                                       
                                       if (error) throw error;
                                       loadSubtasksForTask(task.id);
                                       loadSubtaskCounts();
                                       toast({ title: "Unteraufgabe hinzugefügt" });
                                     } catch (error) {
                                       console.error('Error adding subtask:', error);
                                       toast({
                                         title: "Fehler",
                                         description: "Unteraufgabe konnte nicht hinzugefügt werden.",
                                         variant: "destructive"
                                       });
                                     }
                                   };
                                   addSubtask();
                                 }
                               }}
                             >
                               <Plus className="h-4 w-4" />
                               Unteraufgabe hinzufügen
                             </Button>
                           </div>
                           
                           {/* Subtasks List */}
                           {subtasks[task.id].map((subtask) => (
                             <div key={subtask.id} className="border border-border rounded-lg p-4 bg-muted/20">
                               <div className="flex items-start gap-3">
                                 <Checkbox
                                   checked={subtask.is_completed}
                                   onCheckedChange={async (checked) => {
                                     const isChecked = checked === true;
                                     try {
                                       const { error } = await supabase
                                         .from('subtasks')
                                         .update({ 
                                           is_completed: isChecked,
                                           completed_at: isChecked ? new Date().toISOString() : null
                                         })
                                         .eq('id', subtask.id);
                                       
                                       if (error) throw error;
                                       loadSubtasksForTask(task.id);
                                       toast({ 
                                         title: isChecked ? "Unteraufgabe erledigt" : "Unteraufgabe wieder geöffnet"
                                       });
                                     } catch (error) {
                                       console.error('Error updating subtask:', error);
                                       toast({
                                         title: "Fehler",
                                         description: "Unteraufgabe konnte nicht aktualisiert werden.",
                                         variant: "destructive"
                                       });
                                     }
                                   }}
                                   className="mt-1"
                                 />
                                 <div className="flex-1">
                                   <div className={`font-medium ${subtask.is_completed ? "line-through text-muted-foreground" : ""}`}>
                                     {subtask.title}
                                   </div>
                                   {subtask.is_completed && subtask.result_text && (
                                     <div className="mt-2 p-3 bg-emerald-500/10 border-l-4 border-emerald-500 rounded">
                                       <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                                         Ergebnis:
                                       </div>
                                       <div className="text-sm text-emerald-600 dark:text-emerald-300">
                                         {subtask.result_text}
                                       </div>
                                       <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-2">
                                         Erledigt am: {subtask.completed_at ? new Date(subtask.completed_at).toLocaleDateString('de-DE', {
                                           day: '2-digit',
                                           month: '2-digit',
                                           year: 'numeric',
                                           hour: '2-digit',
                                           minute: '2-digit'
                                         }) : ''}
                                       </div>
                                     </div>
                                   )}
                                    <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                                         {(subtask.assigned_to_names || (subtask.assigned_to && subtask.assigned_to.length > 0)) && (
                                           <div>
                                             Zuständig: {subtask.assigned_to_names || resolveUserNames(subtask.assigned_to)}
                                           </div>
                                         )}
                                     {subtask.due_date && (
                                       <div>
                                         Fällig: {new Date(subtask.due_date).toLocaleDateString('de-DE')}
                                       </div>
                                     )}
                                   </div>
                                 </div>
                                 <div className="flex gap-1">
                                   <Button
                                     variant="ghost"
                                     size="sm"
                                     className="h-8 w-8 p-0"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       const newTitle = prompt('Neuer Titel:', subtask.title);
                                       if (newTitle) {
                                         const updateSubtask = async () => {
                                           try {
                                             const { error } = await supabase
                                               .from('subtasks')
                                               .update({ description: newTitle })
                                               .eq('id', subtask.id);
                                             
                                             if (error) throw error;
                                             loadSubtasksForTask(task.id);
                                             toast({ title: "Unteraufgabe aktualisiert" });
                                           } catch (error) {
                                             console.error('Error updating subtask:', error);
                                             toast({
                                               title: "Fehler",
                                               description: "Unteraufgabe konnte nicht aktualisiert werden.",
                                               variant: "destructive"
                                             });
                                           }
                                         };
                                         updateSubtask();
                                       }
                                     }}
                                     title="Bearbeiten"
                                   >
                                     <Edit2 className="h-4 w-4" />
                                   </Button>
                                   <Button
                                     variant="ghost"
                                     size="sm"
                                     className="h-8 w-8 p-0 text-destructive"
                                     onClick={async (e) => {
                                       e.stopPropagation();
                                       if (confirm('Unteraufgabe wirklich löschen?')) {
                                         try {
                                           const { error } = await supabase
                                             .from('subtasks')
                                             .delete()
                                             .eq('id', subtask.id);
                                           
                                           if (error) throw error;
                                           loadSubtasksForTask(task.id);
                                           loadSubtaskCounts();
                                           toast({ title: "Unteraufgabe gelöscht" });
                                         } catch (error) {
                                           console.error('Error deleting subtask:', error);
                                           toast({
                                             title: "Fehler",
                                             description: "Unteraufgabe konnte nicht gelöscht werden.",
                                             variant: "destructive"
                                           });
                                         }
                                       }
                                     }}
                                     title="Löschen"
                                   >
                                     <Trash2 className="h-4 w-4" />
                                   </Button>
                                 </div>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                       
                       {/* Expandable Documents */}
                       {showDocumentsFor === task.id && taskDocumentDetails[task.id] && (
                         <div className="mt-4 space-y-2 animate-fade-in">
                           {/* Add Document Button */}
                           <div className="border border-dashed border-border rounded-lg p-3 text-center">
                             <Button
                               variant="outline"
                               size="sm"
                               className="gap-2"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 // Handle document upload
                                 const input = document.createElement('input');
                                 input.type = 'file';
                                 input.accept = '.pdf,.doc,.docx,.txt,.jpg,.png';
                                 input.onchange = async (event) => {
                                   const file = (event.target as HTMLInputElement).files?.[0];
                                   if (file && user) {
                                     try {
                                       const { error } = await supabase
                                         .from('task_documents')
                                         .insert({
                                           task_id: task.id,
                                           user_id: user.id,
                                           file_name: file.name,
                                           file_path: `tasks/${task.id}/${file.name}`,
                                           file_type: file.type,
                                           file_size: file.size
                                         });
                                       
                                       if (error) throw error;
                                       loadTaskDocuments();
                                       loadTaskDocumentCounts();
                                       toast({ title: "Dokument hinzugefügt" });
                                     } catch (error) {
                                       console.error('Error adding document:', error);
                                       toast({
                                         title: "Fehler",
                                         description: "Dokument konnte nicht hinzugefügt werden.",
                                         variant: "destructive"
                                       });
                                     }
                                   }
                                 };
                                 input.click();
                               }}
                             >
                               <Plus className="h-4 w-4" />
                               Dokument hinzufügen
                             </Button>
                           </div>
                           
                           {/* Documents List */}
                           {taskDocumentDetails[task.id].map((document) => (
                             <div key={document.id} className="flex items-center gap-2 text-sm border border-border rounded p-3">
                               <Paperclip className="h-4 w-4" />
                               <span className="flex-1">{document.file_name}</span>
                               <div className="flex gap-1">
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   className="h-8 w-8 p-0"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     // Handle document download
                                   }}
                                   title="Herunterladen"
                                 >
                                   <Download className="h-4 w-4" />
                                 </Button>
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   className="h-8 w-8 p-0 text-destructive"
                                   onClick={async (e) => {
                                     e.stopPropagation();
                                     try {
                                       const { error } = await supabase
                                         .from('task_documents')
                                         .delete()
                                         .eq('id', document.id);
                                       
                                       if (error) throw error;
                                       loadTaskDocuments();
                                       loadTaskDocumentCounts();
                                       toast({ title: "Dokument gelöscht" });
                                     } catch (error) {
                                       console.error('Error deleting document:', error);
                                       toast({
                                         title: "Fehler",
                                         description: "Dokument konnte nicht gelöscht werden.",
                                         variant: "destructive"
                                       });
                                     }
                                   }}
                                   title="Löschen"
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                       
                       {/* Expandable Comments */}
                       {showCommentsFor === task.id && (
                         <div className="mt-4 space-y-3 animate-fade-in">
                           {/* Add Comment Form */}
                           <div className="border border-border rounded-lg p-3 bg-muted/10">
                             <div className="flex gap-2">
                               <Textarea
                                 value={newComment[task.id] || ''}
                                 onChange={(e) => setNewComment(prev => ({ ...prev, [task.id]: e.target.value }))}
                                 placeholder="Kommentar hinzufügen..."
                                 className="flex-1 min-h-[60px]"
                               />
                               <Button
                                 onClick={() => addComment(task.id)}
                                 disabled={!newComment[task.id]?.trim()}
                                 size="sm"
                               >
                                 <Send className="h-4 w-4" />
                               </Button>
                             </div>
                           </div>
                           
                           {/* Comments List */}
                           {taskComments[task.id]?.map((comment) => (
                             <div key={comment.id} className="border border-border rounded-lg p-3 bg-muted/20">
                               <div className="flex justify-between items-start mb-2">
                                 <span className="font-medium text-sm">{comment.userName}</span>
                                 <div className="flex items-center gap-2">
                                   <span className="text-xs text-muted-foreground">
                                     {new Date(comment.createdAt).toLocaleDateString('de-DE', {
                                       day: '2-digit',
                                       month: '2-digit',
                                       year: 'numeric',
                                       hour: '2-digit',
                                       minute: '2-digit'
                                     })}
                                   </span>
                                   {comment.userId === user?.id && (
                                     <div className="flex gap-1">
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         className="h-6 w-6 p-0"
                                         onClick={() => {
                                           setEditingComment(prev => ({ ...prev, [comment.id]: comment.content }));
                                         }}
                                       >
                                         <Edit2 className="h-3 w-3" />
                                       </Button>
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         className="h-6 w-6 p-0 text-destructive"
                                         onClick={async () => {
                                           try {
                                             const { error } = await supabase
                                               .from('task_comments')
                                               .delete()
                                               .eq('id', comment.id);
                                             
                                             if (error) throw error;
                                             loadTaskComments();
                                             toast({ title: "Kommentar gelöscht" });
                                           } catch (error) {
                                             console.error('Error deleting comment:', error);
                                             toast({
                                               title: "Fehler",
                                               description: "Kommentar konnte nicht gelöscht werden.",
                                               variant: "destructive"
                                             });
                                           }
                                         }}
                                       >
                                         <Trash2 className="h-3 w-3" />
                                       </Button>
                                     </div>
                                   )}
                                 </div>
                               </div>
                               
                               {editingComment[comment.id] !== undefined ? (
                                 <div className="flex gap-2">
                                   <Textarea
                                     value={editingComment[comment.id]}
                                     onChange={(e) => setEditingComment(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                     className="flex-1 min-h-[60px]"
                                   />
                                   <div className="flex flex-col gap-1">
                                     <Button
                                       size="sm"
                                       className="h-8"
                                       onClick={async () => {
                                         try {
                                           const { error } = await supabase
                                             .from('task_comments')
                                             .update({ content: editingComment[comment.id] })
                                             .eq('id', comment.id);
                                           
                                           if (error) throw error;
                                           setEditingComment(prev => {
                                             const { [comment.id]: _, ...rest } = prev;
                                             return rest;
                                           });
                                           loadTaskComments();
                                           toast({ title: "Kommentar aktualisiert" });
                                         } catch (error) {
                                           console.error('Error updating comment:', error);
                                           toast({
                                             title: "Fehler",
                                             description: "Kommentar konnte nicht aktualisiert werden.",
                                             variant: "destructive"
                                           });
                                         }
                                       }}
                                     >
                                       <Check className="h-3 w-3" />
                                     </Button>
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       className="h-8"
                                       onClick={() => {
                                         setEditingComment(prev => {
                                           const { [comment.id]: _, ...rest } = prev;
                                           return rest;
                                         });
                                       }}
                                     >
                                       <X className="h-3 w-3" />
                                     </Button>
                                   </div>
                                 </div>
                               ) : (
                                 <div className="text-sm">{comment.content}</div>
                               )}
                             </div>
                           )) || (
                             <div className="text-sm text-muted-foreground text-center py-4">
                               Keine Kommentare vorhanden
                             </div>
                           )}
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
      {console.log('Rendering TodoCreateDialog with todoCreateOpen:', todoCreateOpen)}
      <TodoCreateDialog
        open={todoCreateOpen}
        onOpenChange={(open) => {
          console.log('TodoCreateDialog onOpenChange called with:', open);
          setTodoCreateOpen(open);
        }}
        onTodoCreated={() => {
          console.log('Todo created callback called');
          loadTodos();
        }}
       />

      {/* Quick Note Dialog */}
      <Dialog open={quickNoteDialog.open} onOpenChange={(open) => setQuickNoteDialog({ open, taskId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Note zur Aufgabe erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notiz-Inhalt</Label>
              <Textarea
                value={quickNoteContent}
                onChange={(e) => setQuickNoteContent(e.target.value)}
                placeholder="Schreiben Sie Ihre Notiz zur Aufgabe..."
                className="mt-2 min-h-[120px]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setQuickNoteDialog({ open: false, taskId: null });
                  setQuickNoteContent("");
                }}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={createQuickNoteFromTask}
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