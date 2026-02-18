import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, CheckSquare, Square, Clock, Flag, Calendar, User, Edit2, Archive, MessageCircle, Send, Filter, Trash2, Check, X, Paperclip, Download, ChevronDown, ChevronRight, ListTodo, AlarmClock, StickyNote } from "lucide-react";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AssignedItemsSection } from "./tasks/AssignedItemsSection";
import { LetterSourceLink } from "@/components/letters/LetterSourceLink";
import { extractLetterSourceId, stripLetterSourceMarker } from "@/utils/letterSource";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { TaskArchiveModal } from "./TaskArchiveModal";
import { TaskDetailSidebar } from "./TaskDetailSidebar";
import { SnoozeManagementSidebar } from "./SnoozeManagementSidebar";
import { TodoCreateDialog } from "./TodoCreateDialog";
import { TaskDecisionCreator } from "./task-decisions/TaskDecisionCreator";
import { TaskDecisionStatus } from "./task-decisions/TaskDecisionStatus";
import { TaskDecisionList } from "./task-decisions/TaskDecisionList";
import { useNewItemIndicators } from "@/hooks/useNewItemIndicators";
import { NewItemIndicator } from "./NewItemIndicator";
import { CelebrationAnimationSystem } from "./celebrations";

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
  tenant_id?: string;
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
  source_type?: 'task_child' | 'planning' | 'call_followup';
  checklist_item_title?: string;
  call_log_id?: string;
  contact_name?: string;
  priority?: string;
  created_at?: string;
  updated_at?: string;
}

export function TasksView() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Clear indicators when component unmounts
  useEffect(() => {
    return () => {
      // Clear indicators when leaving the tasks view
    };
  }, []);
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
  const [hideSnoozeSubtasks, setHideSnoozeSubtasks] = useState(() => {
    try {
      const saved = localStorage.getItem('hideSnoozeSubtasks');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
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
  const [showCelebration, setShowCelebration] = useState(false);
  
  console.log('TodoCreateOpen state:', todoCreateOpen); // Debug log
  
  const { toast } = useToast();
  const { isItemNew, clearAllIndicators } = useNewItemIndicators('tasks');

  // Handle URL action parameter for QuickActions
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-task') {
      setTodoCreateOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

      // 1b. Get task-child subtasks assigned to this user
      const { data: childTasksData, error: childTasksError } = await supabase
        .from('tasks')
        .select('id, title, description, parent_task_id, assigned_to, due_date, status, created_at, updated_at, priority')
        .not('parent_task_id', 'is', null)
        .neq('status', 'completed');

      if (childTasksError) {
        console.error('❌ Error loading task-child subtasks:', childTasksError);
      } else {
        for (const childTask of childTasksData || []) {
          const assignees = Array.isArray(childTask.assigned_to)
            ? childTask.assigned_to
            : (childTask.assigned_to || '').split(',').map((item) => item.trim()).filter(Boolean);

          const isAssigned = assignees.includes(user.id);
          if (!isAssigned) continue;

          let parentTitle = 'Unbekannte Aufgabe';
          if (childTask.parent_task_id) {
            const { data: parentTask } = await supabase
              .from('tasks')
              .select('title')
              .eq('id', childTask.parent_task_id)
              .single();
            parentTitle = parentTask?.title || parentTitle;
          }

          allSubtasks.push({
            id: childTask.id,
            title: childTask.title,
            description: childTask.description || '',
            task_id: childTask.parent_task_id,
            task_title: parentTitle,
            source_type: 'task_child' as const,
            assigned_to: assignees,
            assigned_to_names: resolveUserNames(assignees),
            due_date: childTask.due_date,
            is_completed: childTask.status === 'completed',
            created_at: childTask.created_at,
            updated_at: childTask.updated_at,
            priority: childTask.priority,
            order_index: 0,
          });
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
    if (!user) return;
    
    try {
      // Filter tasks: only show own tasks or tasks assigned to the user
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .is('parent_task_id', null)
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%`)
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
        call_log_id: task.call_log_id,
        tenant_id: task.tenant_id
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
      const { data: childTasks, error } = await supabase
        .from('tasks')
        .select('id, parent_task_id')
        .not('parent_task_id', 'is', null);

      if (error) throw error;

      const counts: { [taskId: string]: number } = {};
      (childTasks || []).forEach(task => {
        if (!task.parent_task_id) return;
        counts[task.parent_task_id] = (counts[task.parent_task_id] || 0) + 1;
      });

      setSubtaskCounts(counts);
    } catch (error) {
      console.error('Error loading subtask counts:', error);
    }
  };

  const loadSubtasksForTask = async (taskId: string) => {
    try {
      const { data: childTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mappedChildTasks = (childTasks || []).map((task, index) => ({
        id: task.id,
        task_id: taskId,
        title: task.title,
        description: task.description || '',
        is_completed: task.status === 'completed',
        assigned_to: Array.isArray(task.assigned_to)
          ? task.assigned_to
          : (task.assigned_to ? String(task.assigned_to).split(',').map((item) => item.trim()).filter(Boolean) : []),
        due_date: task.due_date,
        order_index: index,
        completed_at: task.status === 'completed' ? task.updated_at : null,
        source_type: 'task_child' as const,
        created_at: task.created_at,
        updated_at: task.updated_at,
        priority: task.priority,
      }));

      setSubtasks(prev => ({
        ...prev,
        [taskId]: mappedChildTasks as any
      }));
    } catch (error) {
      console.error('Error loading subtasks:', error);
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  // State for preventing double clicks
  const [processingTaskIds, setProcessingTaskIds] = useState<Set<string>>(new Set());

  const toggleTaskStatus = async (taskId: string) => {
    // Prevent double clicks
    if (processingTaskIds.has(taskId)) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task || !user) return;

    const newStatus = task.status === "completed" ? "todo" : "completed";
    const originalStatus = task.status;
    const originalProgress = task.progress || 0;
    
    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: newStatus } : t
    ));
    
    setProcessingTaskIds(prev => new Set(prev).add(taskId));
    
    try {
      const updateData = { 
        status: newStatus,
        progress: newStatus === "completed" ? 100 : originalProgress
      };

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) {
        // Check for network errors
        const isNetworkError = error.message?.includes('Failed to fetch') || 
                               error.message?.includes('NetworkError') ||
                               error.message?.includes('TypeError');
        
        if (isNetworkError) {
          console.warn('Network interruption, verifying task status...', error);
          
          // Bei Netzwerkfehler UND Erledigt-Markierung: Nach Verzoegerung verifizieren und Archivierung nachholen
          setTimeout(async () => {
            const { data: freshTask } = await supabase
              .from('tasks')
              .select('*')
              .eq('id', taskId)
              .single();
            
            if (!freshTask) {
              // Task was deleted (archived successfully)
              setTasks(prev => prev.filter(t => t.id !== taskId));
              setShowCelebration(true);
              toast({
                title: "Status aktualisiert",
                description: "Aufgabe wurde archiviert."
              });
            } else if (freshTask.status === 'completed' && newStatus === 'completed') {
              // Status wurde auf completed gesetzt - jetzt Archivierung pruefen und nachholen
              const { data: existingArchive } = await supabase
                .from('archived_tasks')
                .select('id')
                .eq('task_id', taskId)
                .maybeSingle();
              
              if (!existingArchive) {
                // Archiv-Eintrag fehlt - jetzt erstellen
                await supabase.from('archived_tasks').insert({
                  task_id: taskId,
                  user_id: user.id,
                  title: freshTask.title,
                  description: freshTask.description,
                  priority: freshTask.priority,
                  category: freshTask.category,
                  assigned_to: freshTask.assigned_to || '',
                  progress: 100,
                  due_date: freshTask.due_date,
                  completed_at: new Date().toISOString(),
                  auto_delete_after_days: null,
                } as any);
                
                // Task loeschen
                await supabase.from('tasks').delete().eq('id', taskId);
              }
              
              // UI aktualisieren
              setTasks(prev => prev.filter(t => t.id !== taskId));
              setShowCelebration(true);
              toast({
                title: "Status aktualisiert",
                description: "Aufgabe wurde archiviert."
              });
            } else if (freshTask.status === newStatus) {
              // Non-completed status update was successful
              loadTasks();
              toast({
                title: "Status aktualisiert",
                description: "Aufgabe wurde als offen markiert."
              });
            } else {
              // Update didn't go through, revert UI
              setTasks(prev => prev.map(t => 
                t.id === taskId ? { ...t, status: originalStatus } : t
              ));
            }
            
            setProcessingTaskIds(prev => {
              const next = new Set(prev);
              next.delete(taskId);
              return next;
            });
          }, 500);
          
          return; // Don't proceed, let verification handle it
        }
        
        throw error;
      }

      // If task is completed, archive it
      if (newStatus === "completed") {
        const { error: archiveError } = await supabase
          .from('archived_tasks')
          .insert({
            task_id: taskId,
            user_id: user.id,
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
          const isNetworkError = archiveError.message?.includes('Failed to fetch') || 
                                 archiveError.message?.includes('NetworkError');
          
          if (isNetworkError) {
            // Verify after delay
            setTimeout(async () => {
              const { data: archived } = await supabase
                .from('archived_tasks')
                .select('id')
                .eq('task_id', taskId)
                .single();
              
              if (archived) {
                // Archive succeeded, delete task
                await supabase.from('tasks').delete().eq('id', taskId);
                setTasks(prev => prev.filter(t => t.id !== taskId));
                setShowCelebration(true);
                toast({
                  title: "Status aktualisiert",
                  description: "Aufgabe wurde archiviert."
                });
              }
              loadTasks();
              
              setProcessingTaskIds(prev => {
                const next = new Set(prev);
                next.delete(taskId);
                return next;
              });
            }, 500);
            return;
          }
          
          // Real error - rollback
          await supabase
            .from('tasks')
            .update({ status: originalStatus, progress: originalProgress })
            .eq('id', taskId);
          throw archiveError;
        }

        // Delete task from tasks table
        await supabase.from('tasks').delete().eq('id', taskId);
        
        // SOFORT aus lokalem State entfernen - nicht auf loadTasks() warten
        setTasks(prev => prev.filter(t => t.id !== taskId));
        
        // Fire and forget: mark notifications as read
        void supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('navigation_context', 'tasks');
          
        setShowCelebration(true);
      } else {
        // Nur bei Status-Wechsel ohne Archivierung neu laden
        loadTasks();
      }
      
      toast({
        title: "Status aktualisiert",
        description: newStatus === "completed" 
          ? "Aufgabe wurde als erledigt markiert und archiviert."
          : "Aufgabe wurde als offen markiert."
      });
      
    } catch (error: any) {
      console.error('Error updating task:', error);
      
      // Check for network errors in catch
      const isNetworkError = error?.message?.includes('Failed to fetch') || 
                             error?.message?.includes('NetworkError');
      
      if (isNetworkError) {
        setTimeout(() => loadTasks(), 500);
        setProcessingTaskIds(prev => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
        return;
      }
      
      // Rollback UI on real error
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: originalStatus } : t
      ));
      
      toast({
        title: "Fehler",
        description: error.message || "Status konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    } finally {
      setProcessingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
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
      } else if (subtask.source_type === 'task_child') {
        const { error } = await supabase
          .from('tasks')
          .update({ status: isCompleted ? 'completed' : 'todo' })
          .eq('id', subtaskId);

        if (error) throw error;
      } else {
        // Handle regular and planning subtasks
        const tableName = 'planning_item_subtasks';
        
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
      
      // Trigger unicorn animation when subtask is completed
      if (isCompleted) {
        setShowCelebration(true);
      }
      
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

  // Filter out snoozed tasks from assigned tasks
  const filteredAssignedTasksWithSnooze = assignedTasks.filter(task => {
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

  // Handle hideSnoozeSubtasks toggle with persistence
  const handleToggleHideSnoozeSubtasks = (hide: boolean) => {
    setHideSnoozeSubtasks(hide);
    try {
      localStorage.setItem('hideSnoozeSubtasks', JSON.stringify(hide));
    } catch (error) {
      console.error('Failed to save hideSnoozeSubtasks setting:', error);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-subtle p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Aufgaben</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Verwalten Sie Ihre Aufgaben und To-Dos effizient
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button className="gap-2 min-h-[44px] flex-1 sm:flex-none" onClick={() => window.location.href = '/tasks/new'}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Neue Aufgabe</span>
                  <span className="sm:hidden">Aufgabe</span>
                </Button>
                <Button 
                  className="gap-2 min-h-[44px] flex-1 sm:flex-none"
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
                  <span className="hidden sm:inline">Neues ToDo</span>
                  <span className="sm:hidden">ToDo</span>
                </Button>
              </div>
              
              {/* Secondary actions row directly under main buttons */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2 min-h-[44px] flex-1 sm:flex-none"
                  onClick={() => setArchiveModalOpen(true)}
                >
                  <Archive className="h-4 w-4" />
                  <span className="hidden sm:inline">Aufgaben-Archiv</span>
                  <span className="sm:hidden">Archiv</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2 min-h-[44px] flex-1 sm:flex-none"
                  onClick={() => setSnoozeManagementOpen(true)}
                >
                  <AlarmClock className="h-4 w-4" />
                  <span className="hidden sm:inline">Wiedervorlagen</span>
                  <span className="sm:hidden">WV</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-4 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filter:</span>
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] min-h-[44px]">
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
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[160px] min-h-[44px]">
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

        {/* Assigned Tasks, Subtasks and ToDos Cards */}
        <AssignedItemsSection
          tasks={assignedTasks}
          subtasks={assignedSubtasks}
          todos={todos}
          taskSnoozes={taskSnoozes}
          subtaskSnoozes={subtaskSnoozes}
          hideSnoozeSubtasks={hideSnoozeSubtasks}
          onToggleHideSnoozeSubtasks={handleToggleHideSnoozeSubtasks}
          onTaskToggleComplete={toggleTaskStatus}
          onSubtaskToggleComplete={(subtaskId, completed, resultText) => {
            if (completed) {
              setCompletingSubtask(subtaskId);
              setCompletionResult('');
            } else {
              handleSubtaskComplete(subtaskId, false);
            }
          }}
          onTodoToggleComplete={async (todoId, completed) => {
            if (completed) {
              try {
                const { error } = await supabase
                  .from('todos')
                  .update({ 
                    is_completed: true,
                    completed_at: new Date().toISOString()
                  })
                  .eq('id', todoId);
                
                if (error) throw error;
                loadTodos();
                setShowCelebration(true);
                
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
          onTaskSnooze={(taskId) => {
            setSnoozeDialogOpen({ type: 'task', id: taskId });
            setSnoozeDate('');
          }}
          onSubtaskSnooze={(subtaskId) => {
            setSnoozeDialogOpen({ type: 'subtask', id: subtaskId });
            setSnoozeDate('');
          }}
          onTaskEdit={(task) => handleTaskClick(task)}
          onSubtaskEdit={(subtask) => {
            const parentTask = tasks.find(t => t.id === subtask.task_id);
            if (parentTask) {
              handleTaskClick(parentTask);
            }
          }}
          resolveUserNames={resolveUserNames}
        />


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
            filteredTasksWithSnooze.map((task) => {
              const taskSourceLetterId = extractLetterSourceId(task.description) || extractLetterSourceId(task.title);
              const cleanTaskTitle = stripLetterSourceMarker(task.title);
              const cleanTaskDescription = stripLetterSourceMarker(task.description);

              return (
              <Card key={task.id} className="hover:shadow-md transition-shadow cursor-pointer relative" onClick={() => handleTaskClick(task)}>
                <NewItemIndicator isVisible={isItemNew(task.id, task.created_at || '')} />
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
                          <h3 className="font-medium text-foreground text-lg">{cleanTaskTitle || task.title}</h3>
                          {cleanTaskDescription && (
                            <RichTextDisplay content={cleanTaskDescription} className="mt-1 leading-relaxed" />
                          )}
                          {taskSourceLetterId && (
                            <div className="mt-2">
                              <LetterSourceLink letterId={taskSourceLetterId} />
                            </div>
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
                          <TaskDecisionCreator 
                            taskId={task.id} 
                            onDecisionCreated={() => {
                              loadTasks();
                              // Reload decision list as well  
                              window.location.reload();
                            }} 
                          />
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
                           <span className={isOverdue(task.dueDate) ? "" : ""}>
                             {task.dueDate ? new Date(task.dueDate).toLocaleDateString('de-DE') : 'unbefristet'}
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
                                       const tenantId = task.tenant_id || currentTenant?.id;
                                       if (!tenantId) {
                                         throw new Error('Missing tenant_id for subtask creation');
                                       }

                                       const { error } = await supabase
                                         .from('tasks')
                                         .insert({
                                           title,
                                           description: null,
                                           status: 'todo',
                                           priority: task.priority || 'medium',
                                           category: task.category || 'personal',
                                           user_id: user.id,
                                           tenant_id: tenantId,
                                           assigned_to: task.assignedTo || user.id,
                                           parent_task_id: task.id,
                                         } as any);
                                       
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
                           <div className="space-y-0">
                           {subtasks[task.id].map((subtask) => {
                             const subtaskSourceLetterId = extractLetterSourceId(subtask.title);
                             const cleanSubtaskTitle = stripLetterSourceMarker(subtask.title);

                             return (
                             <div key={subtask.id} className="group/subtask ml-4 border border-border rounded-lg p-4 bg-muted/20">
                               <div className="flex items-start gap-3">
                                 <Checkbox
                                   checked={subtask.is_completed}
                                   onCheckedChange={async (checked) => {
                                     const isChecked = checked === true;
                                     try {
                                       const { error } = await supabase
                                         .from('tasks')
                                         .update({ status: isChecked ? 'completed' : 'todo' })
                                         .eq('id', subtask.id);
                                       
                                       if (error) throw error;
                                       loadSubtasksForTask(task.id);
                                       
                                       // Trigger unicorn animation when subtask is completed
                                       if (isChecked) {
                                         setShowCelebration(true);
                                       }
                                       
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
                                     {cleanSubtaskTitle || subtask.title}
                                   </div>
                                    {subtaskSourceLetterId && (
                                      <div className="mt-2">
                                        <LetterSourceLink letterId={subtaskSourceLetterId} className="h-6 px-1" />
                                      </div>
                                    )}
                                    {subtask.is_completed && (
                                      <div className="mt-2 p-3 bg-emerald-500/10 border-l-4 border-emerald-500 rounded">
                                        {subtask.result_text && (
                                          <>
                                            <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                                              Ergebnis:
                                            </div>
                                            <div className="text-sm text-emerald-600 dark:text-emerald-300 mb-2">
                                              {subtask.result_text}
                                            </div>
                                          </>
                                        )}
                                        <div className="text-xs text-emerald-500 dark:text-emerald-400">
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
                                 <div className="flex gap-1 opacity-0 pointer-events-none transition-opacity group-hover/subtask:opacity-100 group-hover/subtask:pointer-events-auto">
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
                                               .from('tasks')
                                               .update({ title: newTitle })
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
                                             .from('tasks')
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
                           )})}
                           </div>
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
                        
                        {/* Task Decision Status */}
                        <TaskDecisionStatus 
                          taskId={task.id} 
                          createdBy={task.user_id || ''} 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
            )})
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
        onToggleHideSnoozeSubtasks={handleToggleHideSnoozeSubtasks}
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

      {/* Celebration Animation */}
      <CelebrationAnimationSystem 
        isVisible={showCelebration} 
        onAnimationComplete={() => setShowCelebration(false)} 
      />
     </>
   );
 }
