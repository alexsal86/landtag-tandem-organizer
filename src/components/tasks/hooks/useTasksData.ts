import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import type { AppUserRef, ProfileSummary, TaskDocumentInfo, TenantRef } from "@/components/shared/featureDomainTypes";
import type { Task, TaskComment, Subtask, TodoItem, SnoozeEntry } from "../types";



export interface UseTasksDataReturn {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  loading: boolean;
  taskComments: Record<string, TaskComment[]>;
  taskCategories: Array<{ name: string; label: string }>;
  taskStatuses: Array<{ name: string; label: string }>;
  users: ProfileSummary[];
  taskDocuments: Record<string, number>;
  taskDocumentDetails: Record<string, TaskDocumentInfo[]>;
  subtaskCounts: Record<string, number>;
  subtasks: Record<string, Subtask[]>;
  assignedSubtasks: Array<Subtask & { task_title: string }>;
  taskSnoozes: Record<string, string>;
  subtaskSnoozes: Record<string, string>;
  allSnoozes: SnoozeEntry[];
  todos: TodoItem[];
  resolveUserNames: (assignedToField: string | string[] | null) => string;
  loadTasks: () => Promise<void>;
  loadTaskComments: () => Promise<void>;
  loadTaskDocuments: () => Promise<void>;
  loadTaskDocumentCounts: () => Promise<void>;
  loadSubtaskCounts: () => Promise<void>;
  loadSubtasksForTask: (taskId: string) => Promise<void>;
  loadTaskSnoozes: () => Promise<void>;
  loadAllSnoozes: () => Promise<void>;
  loadTodos: () => Promise<void>;
  loadAssignedSubtasks: () => Promise<void>;
  user: AppUserRef | null;
  currentTenant: TenantRef | null;
}
export function useTasksData(options?: { enabled?: boolean }): UseTasksDataReturn {
  const enabled = options?.enabled !== false;
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [searchParams] = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskComments, setTaskComments] = useState<{ [taskId: string]: TaskComment[] }>({});
  const [taskCategories, setTaskCategories] = useState<Array<{ name: string; label: string }>>([]);
  const [taskStatuses, setTaskStatuses] = useState<Array<{ name: string; label: string }>>([]);
  const [users, setUsers] = useState<ProfileSummary[]>([]);
  const [taskDocuments, setTaskDocuments] = useState<{ [taskId: string]: number }>({});
  const [taskDocumentDetails, setTaskDocumentDetails] = useState<Record<string, TaskDocumentInfo[]>>({});
  const [subtaskCounts, setSubtaskCounts] = useState<{ [taskId: string]: number }>({});
  const [subtasks, setSubtasks] = useState<{ [taskId: string]: Subtask[] }>({});
  const [assignedSubtasks, setAssignedSubtasks] = useState<Array<Subtask & { task_title: string }>>([]);
  const [taskSnoozes, setTaskSnoozes] = useState<{ [taskId: string]: string }>({});
  const [subtaskSnoozes, setSubtaskSnoozes] = useState<{ [subtaskId: string]: string }>({});
  const [allSnoozes, setAllSnoozes] = useState<SnoozeEntry[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);

  // Synchronous helper that uses cached user data
  const resolveUserNames = (assignedToField: string | string[] | null): string => {
    if (!assignedToField) return '';
    let cleanField = assignedToField;
    if (typeof assignedToField === 'string') {
      cleanField = assignedToField.replace(/[{}]/g, '').trim();
    }
    const userIds = Array.isArray(cleanField)
      ? cleanField
      : typeof cleanField === 'string'
        ? cleanField.split(',').map(id => id.trim()).filter(id => id)
        : [];
    return userIds
      .map(userId => {
        const u = users.find(u => u.user_id === userId);
        return u?.display_name || userId;
      })
      .join(', ');
  };

  // Async helper
  const resolveUserNamesAsync = async (assignedToField: string | string[] | null): Promise<string> => {
    if (!assignedToField) return '';
    let cleanField = assignedToField;
    if (typeof assignedToField === 'string') {
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
      const nameMap = new Map(data?.map((profile: Record<string, any>) => [profile.user_id, profile.display_name]) || []);
      return userIds.map(userId => nameMap.get(userId) || userId).join(', ');
    } catch {
      return userIds.join(', ');
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');
      if (error) throw error;
      setUsers((data || []).map(u: Record<string, any> => ({ user_id: u.user_id, display_name: u.display_name ?? undefined })));
    } catch (error) {
      debugConsole.error('Error loading users:', error);
    }
  };

  const loadTasks = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, priority, status, due_date, category, assigned_to, progress, created_at, updated_at, user_id, call_log_id, tenant_id, source_type, source_id')
        .is('parent_task_id', null)
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const transformedTasks: Task[] = (data || []).map((task: Record<string, any>) => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority as Task['priority'],
        status: task.status as Task['status'],
        dueDate: task.due_date,
        category: task.category as Task['category'],
        assignedTo: Array.isArray(task.assigned_to) ? task.assigned_to.join(',') : (task.assigned_to || ''),
        progress: task.progress ?? undefined,
        created_at: task.created_at,
        updated_at: task.updated_at,
        user_id: task.user_id,
        call_log_id: task.call_log_id,
        tenant_id: task.tenant_id,
        source_type: task.source_type,
        source_id: task.source_id
      }));
      setTasks(transformedTasks);
      setLoading(false);
      await loadTaskComments();
    } catch (error) {
      debugConsole.error('Error loading tasks:', error);
      setLoading(false);
    }
  };

  const loadTaskConfiguration = async () => {
    try {
      const [categoriesRes, statusesRes] = await Promise.all([
        supabase.from('task_categories').select('name, label').eq('is_active', true).order('order_index'),
        supabase.from('task_statuses').select('name, label').eq('is_active', true).order('order_index')
      ]);
      if (categoriesRes.data) setTaskCategories(categoriesRes.data);
      if (statusesRes.data) setTaskStatuses(statusesRes.data);
    } catch (error) {
      debugConsole.error('Error loading task configuration:', error);
    }
  };

  const loadTaskComments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`id, task_id, content, user_id, created_at, profiles!inner(display_name)`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const commentsMap: { [taskId: string]: TaskComment[] } = {};
      (data || []).forEach((comment: Record<string, any>) => {
        if (!commentsMap[comment.task_id]) commentsMap[comment.task_id] = [];
        commentsMap[comment.task_id].push({
          id: comment.id,
          taskId: comment.task_id,
          content: comment.content,
          userId: comment.user_id,
          userName: ((comment as unknown as { profiles: { display_name: string } | null }).profiles)?.display_name || 'Unbekannter Benutzer',
          createdAt: comment.created_at
        });
      });
      setTaskComments(commentsMap);
    } catch {
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('task_comments')
          .select('id, task_id, content, user_id, created_at')
          .order('created_at', { ascending: true });
        if (fallbackError) throw fallbackError;
        const commentsMap: { [taskId: string]: TaskComment[] } = {};
        (fallbackData || []).forEach((comment: Record<string, any>) => {
          if (!commentsMap[comment.task_id]) commentsMap[comment.task_id] = [];
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
        debugConsole.error('Fallback query also failed:', fallbackError);
      }
    }
  };

  const loadTaskDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_documents')
        .select('id, task_id, file_name, file_path, file_size, file_type, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const detailsMap: Record<string, TaskDocumentInfo[]> = {};
      (data || []).forEach((doc: Record<string, any>) => {
        if (!detailsMap[doc.task_id]) detailsMap[doc.task_id] = [];
        detailsMap[doc.task_id].push(doc);
      });
      setTaskDocumentDetails(detailsMap);
    } catch (error) {
      debugConsole.error('Error loading task documents:', error);
    }
  };

  const loadTaskDocumentCounts = async () => {
    try {
      const { data, error } = await supabase.from('task_documents').select('task_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const counts: { [taskId: string]: number } = {};
      (data || []).forEach((doc: Record<string, any>) => { counts[doc.task_id] = (counts[doc.task_id] || 0) + 1; });
      setTaskDocuments(counts);
    } catch (error) {
      debugConsole.error('Error loading task document counts:', error);
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
      (childTasks || []).forEach((task: Record<string, any>) => {
        if (!task.parent_task_id) return;
        counts[task.parent_task_id] = (counts[task.parent_task_id] || 0) + 1;
      });
      setSubtaskCounts(counts);
    } catch (error) {
      debugConsole.error('Error loading subtask counts:', error);
    }
  };

  const loadSubtasksForTask = async (taskId: string) => {
    try {
      const { data: childTasks, error } = await supabase
        .from('tasks')
        .select('id, title, description, parent_task_id, assigned_to, due_date, status, created_at, updated_at, priority')
        .eq('parent_task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const mappedChildTasks = (childTasks || []).map((task: Record<string, any>, index: Record<string, any>) => ({
        id: task.id,
        task_id: taskId,
        title: task.title,
        description: task.description || '',
        is_completed: task.status === 'completed',
        assigned_to: Array.isArray(task.assigned_to)
          ? task.assigned_to
          : (task.assigned_to ? String(task.assigned_to).split(',').map(item => item.trim()).filter(Boolean) : []),
        due_date: task.due_date,
        order_index: index,
        completed_at: task.status === 'completed' ? task.updated_at : null,
        source_type: 'task_child' as const,
        created_at: task.created_at,
        updated_at: task.updated_at,
        priority: task.priority,
      }));
      setSubtasks(prev => ({ ...prev, [taskId]: mappedChildTasks as Subtask[] }));
    } catch (error) {
      debugConsole.error('Error loading subtasks:', error);
    }
  };

  const loadTaskSnoozes = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('task_snoozes')
        .select('id, task_id, subtask_id, snoozed_until')
        .eq('user_id', user.id)
        .gt('snoozed_until', new Date().toISOString());
      if (error) throw error;
      const taskSnoozeMap: { [taskId: string]: string } = {};
      const subtaskSnoozeMap: { [subtaskId: string]: string } = {};
      (data || []).forEach((snooze: Record<string, any>) => {
        if (snooze.task_id) taskSnoozeMap[snooze.task_id] = snooze.snoozed_until;
        else if (snooze.subtask_id) subtaskSnoozeMap[snooze.subtask_id] = snooze.snoozed_until;
      });
      setTaskSnoozes(taskSnoozeMap);
      setSubtaskSnoozes(subtaskSnoozeMap);
    } catch (error) {
      debugConsole.error('Error loading task snoozes:', error);
    }
  };

  const loadAllSnoozes = async () => {
    if (!user) return;
    try {
      const { data: taskSnoozesData, error: taskError } = await supabase
        .from('task_snoozes')
        .select('id, task_id, snoozed_until')
        .eq('user_id', user.id)
        .not('task_id', 'is', null);
      if (taskError) throw taskError;

      const { data: subtaskSnoozesData } = await supabase
        .from('task_snoozes')
        .select('id, subtask_id, snoozed_until')
        .eq('user_id', user.id)
        .not('subtask_id', 'is', null);

      const taskTitles: { [taskId: string]: string } = {};
      if (taskSnoozesData && taskSnoozesData.length > 0) {
        const taskIds = taskSnoozesData.map(s: Record<string, any> => s.task_id).filter((id: Record<string, any>): id is string => id != null);
        if (taskIds.length > 0) {
          const { data: tasksData } = await supabase.from('tasks').select('id, title').in('id', taskIds);
          tasksData?.forEach((task: Record<string, any>) => { taskTitles[task.id] = task.title; });
        }
      }

      setAllSnoozes([
        ...(taskSnoozesData || []).map((snooze: Record<string, any>) => ({
          id: snooze.id,
          task_id: snooze.task_id,
          snoozed_until: snooze.snoozed_until,
          task_title: snooze.task_id ? (taskTitles[snooze.task_id] || 'Unbekannte Aufgabe') : 'Unbekannte Aufgabe',
        })),
        ...(subtaskSnoozesData || []).map((snooze: Record<string, any>) => ({
          id: snooze.id,
          subtask_id: snooze.subtask_id,
          snoozed_until: snooze.snoozed_until,
          subtask_description: 'Unteraufgabe',
          task_title: 'Aufgabe',
        }))
      ]);
    } catch (error) {
      debugConsole.error('Error loading all snoozes:', error);
    }
  };

  const loadTodos = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('todos')
        .select(`id, title, assigned_to, due_date, is_completed, todo_categories!inner(label, color)`)
        .eq('user_id', user.id)
        .eq('is_completed', false);
      if (error) throw error;
      setTodos((data || []).map((todo: Record<string, any>) => ({
        id: todo.id,
        title: todo.title,
        category_label: todo.todo_categories.label,
        category_color: todo.todo_categories.color ?? '',
        assigned_to: Array.isArray(todo.assigned_to) ? todo.assigned_to.join(',') : (todo.assigned_to || ''),
        due_date: todo.due_date,
        is_completed: todo.is_completed
      })));
    } catch (error) {
      debugConsole.error('Error loading todos:', error);
    }
  };

  const loadAssignedSubtasks = async () => {
    if (!user) return;
    setAssignedSubtasks([]);
    try {
      const allSubtasks: Array<Subtask & { task_title: string }> = [];

      // 1. Task-child subtasks
      const { data: childTasksData } = await supabase
        .from('tasks')
        .select('id, title, description, parent_task_id, assigned_to, due_date, status, created_at, updated_at, priority')
        .not('parent_task_id', 'is', null)
        .neq('status', 'completed');

      for (const childTask of childTasksData || []) {
        const assignees = Array.isArray(childTask.assigned_to)
          ? childTask.assigned_to
          : (childTask.assigned_to || '').split(',').map((item: Record<string, any>) => item.trim()).filter(Boolean);
        if (!assignees.includes(user.id)) continue;

        let parentTitle = 'Unbekannte Aufgabe';
        if (childTask.parent_task_id) {
          const { data: parentTask } = await supabase.from('tasks').select('title').eq('id', childTask.parent_task_id).single();
          parentTitle = parentTask?.title || parentTitle;
        }
        allSubtasks.push({
          id: childTask.id, title: childTask.title, description: childTask.description || '',
          task_id: childTask.parent_task_id, task_title: parentTitle, source_type: 'task_child',
          assigned_to: assignees, assigned_to_names: resolveUserNames(assignees),
          due_date: childTask.due_date, is_completed: childTask.status === 'completed',
          created_at: childTask.created_at, updated_at: childTask.updated_at,
          priority: childTask.priority, order_index: 0,
        });
      }

      // 2. Planning subtasks
      const { data: planningSubtasksData } = await supabase
        .from('planning_item_subtasks')
        .select('id, description, assigned_to, due_date, is_completed, planning_item_id, order_index, created_at, updated_at')
        .eq('assigned_to', user.id)
        .eq('is_completed', false);

      if (planningSubtasksData) {
        for (const subtask of planningSubtasksData) {
          try {
            const resolvedAssignedTo = await resolveUserNamesAsync([subtask.assigned_to].filter(Boolean) as string[]);
            const { data: checklistItemData } = await supabase
              .from('event_planning_checklist_items')
              .select('title, event_planning_id')
              .eq('id', subtask.planning_item_id)
              .single();
            let planningTitle = 'Unbekannte Planung';
            if (checklistItemData?.event_planning_id) {
              const { data: planningData } = await supabase.from('event_plannings').select('title').eq('id', checklistItemData.event_planning_id).single();
              planningTitle = planningData?.title || 'Unbekannte Planung';
            }
            allSubtasks.push({
              ...subtask, task_id: subtask.planning_item_id || subtask.id,
              title: checklistItemData?.title || subtask.description || 'Unterpunkt',
              task_title: planningTitle, source_type: 'planning' as const,
              checklist_item_title: checklistItemData?.title ?? null, planning_item_id: subtask.planning_item_id,
              assigned_to_names: resolvedAssignedTo, assigned_to: [subtask.assigned_to].filter(Boolean) as string[]
            });
          } catch {
            allSubtasks.push({
              ...subtask, task_id: subtask.planning_item_id || subtask.id,
              title: subtask.description || 'Unterpunkt',
              task_title: 'Unbekannte Planung', source_type: 'planning' as const,
              planning_item_id: subtask.planning_item_id,
              assigned_to_names: resolveUserNames([subtask.assigned_to].filter(Boolean) as string[]),
              assigned_to: [subtask.assigned_to].filter(Boolean) as string[]
            });
          }
        }
      }


      setAssignedSubtasks(allSubtasks);
    } catch (error) {
      debugConsole.error('Critical error loading assigned subtasks:', error);
    }
  };

  // Initial load - only when enabled
  useEffect(() => {
    if (!enabled) return;
    const loadAllData = async () => {
      await loadUsers();
      await Promise.all([
        loadTasks(), loadTaskConfiguration(), loadTaskDocumentCounts(),
        loadSubtaskCounts(), loadTaskSnoozes(), loadTodos(), loadTaskComments()
      ]);
      await loadAssignedSubtasks();
    };
    loadAllData();
  }, [enabled]);

  return {
    tasks, setTasks, loading, taskComments, taskCategories, taskStatuses,
    users, taskDocuments, taskDocumentDetails, subtaskCounts, subtasks,
    assignedSubtasks, taskSnoozes, subtaskSnoozes, allSnoozes, todos,
    resolveUserNames, loadTasks, loadTaskComments, loadTaskDocuments,
    loadTaskDocumentCounts, loadSubtaskCounts, loadSubtasksForTask,
    loadTaskSnoozes, loadAllSnoozes, loadTodos, loadAssignedSubtasks,
    user, currentTenant,
  };
}
