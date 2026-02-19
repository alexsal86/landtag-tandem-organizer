import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, Clock, Hourglass, LayoutGrid, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useViewPreference, ViewType } from "@/hooks/useViewPreference";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskListRow } from "@/components/tasks/TaskListRow";
import { TaskDecisionCreator } from "@/components/task-decisions/TaskDecisionCreator";
import { TaskCommentSidebar } from "@/components/tasks/TaskCommentSidebar";
import { TaskDocumentDialog } from "@/components/tasks/TaskDocumentDialog";
import { TaskMeetingSelector } from "@/components/tasks/TaskMeetingSelector";
import { CelebrationAnimationSystem } from "@/components/celebrations";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Input } from "@/components/ui/input";
import { addDays, isAfter, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  user_id: string;
  created_at: string;
  category?: string;
  meeting_id?: string | null;
  pending_for_jour_fixe?: boolean | null;
  parent_task_id?: string | null;
  tenant_id?: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

export function MyWorkTasksTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewType, setViewType } = useViewPreference({ key: "mywork-tasks", defaultView: "card" });
  
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [taskStatuses, setTaskStatuses] = useState<{name: string, label: string}[]>([]);
  const [taskSnoozes, setTaskSnoozes] = useState<Record<string, string>>({});
  const [taskCommentCounts, setTaskCommentCounts] = useState<Record<string, number>>({});
  const [dueFollowUpsExpanded, setDueFollowUpsExpanded] = useState(true);
  const [scheduledFollowUpsExpanded, setScheduledFollowUpsExpanded] = useState(false);

  // Dialog states
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [snoozeTaskId, setSnoozeTaskId] = useState<string | null>(null);
  
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);
  const [assignSelectedUserIds, setAssignSelectedUserIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(false);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  
  const [decisionTaskId, setDecisionTaskId] = useState<string | null>(null);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [documentTaskId, setDocumentTaskId] = useState<string | null>(null);
  
  // Meeting selector states
  const [meetingSelectorOpen, setMeetingSelectorOpen] = useState(false);
  const [meetingTaskId, setMeetingTaskId] = useState<string | null>(null);
  
  // Unicorn animation state
  const [showCelebration, setShowCelebration] = useState(false);

  const [taskEditDialogOpen, setTaskEditDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDescription, setEditTaskDescription] = useState('');


  // Handle action parameter from URL
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-task') {
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      navigate('/tasks?action=create');
    }
  }, [searchParams, setSearchParams, navigate]);

  useEffect(() => {
    if (user) {
      loadTasks();
      loadProfiles();
      loadTaskStatuses();
    }
  }, [user]);

  const loadTaskStatuses = async () => {
    try {
      const { data: statuses } = await supabase
        .from('task_statuses')
        .select('name, label')
        .eq('is_active', true)
        .order('order_index');
      setTaskStatuses(statuses || []);
    } catch (error) {
      console.error('Error loading task statuses:', error);
    }
  };

  const loadTasks = async () => {
    if (!user) return;
    
    try {
      const [assignedResult, createdResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%`)
          .neq("status", "completed")
          .is("parent_task_id", null)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .neq("status", "completed")
          .is("parent_task_id", null)
          .order("due_date", { ascending: true, nullsFirst: false }),
      ]);

      if (assignedResult.error) throw assignedResult.error;
      if (createdResult.error) throw createdResult.error;

      const assigned = assignedResult.data;
      const created = createdResult.data;

      const allAssigned = assigned || [];
      const allCreated = created || [];
      
      // Links: Selbst erstellte Aufgaben, ABER Meeting-Aufgaben ausschließen, die einem zugewiesen sind
      const createdByMe = allCreated.filter(t => 
        !(t.category === 'meeting' && normalizeAssignedTo(t.assigned_to).includes(user.id))
      );
      
      // Rechts: Von ANDEREN erstellte + Meeting-Aufgaben, die mir zugewiesen sind
      const meetingTasksAssignedToMe = allCreated.filter(t => 
        t.category === 'meeting' && normalizeAssignedTo(t.assigned_to).includes(user.id)
      );
      const assignedByOthers = [
        ...allAssigned.filter(t => t.user_id !== user.id),
        ...meetingTasksAssignedToMe
      ];
      
      setCreatedTasks(createdByMe);
      setAssignedTasks(assignedByOthers);

      // Load child-task tree + existing task snoozes
      const allTaskIds = [...new Set([...createdByMe, ...assignedByOthers].map(t => t.id))];
      if (allTaskIds.length > 0) {
        const { data: snoozesData, error: snoozesError } = await supabase
          .from("task_snoozes")
          .select("task_id, snoozed_until")
          .eq("user_id", user.id);

        if (snoozesError) throw snoozesError;

        const grouped: Record<string, Task[]> = {};
        const visitedParentIds = new Set<string>();
        let parentIdsToLoad = [...allTaskIds];

        while (parentIdsToLoad.length > 0) {
          const currentBatch = parentIdsToLoad.filter((id) => !visitedParentIds.has(id));
          if (currentBatch.length === 0) break;

          currentBatch.forEach((id) => visitedParentIds.add(id));

          const { data: childTasksData, error: childTasksError } = await supabase
            .from("tasks")
            .select("*")
            .in("parent_task_id", currentBatch)
            .neq("status", "completed")
            .order("due_date", { ascending: true, nullsFirst: false });

          if (childTasksError) throw childTasksError;

          const children = childTasksData || [];
          children.forEach((childTask) => {
            if (!childTask.parent_task_id) return;
            if (!grouped[childTask.parent_task_id]) grouped[childTask.parent_task_id] = [];
            grouped[childTask.parent_task_id].push(childTask);
          });

          parentIdsToLoad = children.map((childTask) => childTask.id);
        }

        setSubtasks(grouped);

        const snoozeMap: Record<string, string> = {};
        (snoozesData || []).forEach((snooze) => {
          if (snooze.task_id) {
            snoozeMap[snooze.task_id] = snooze.snoozed_until;
          }
        });
        setTaskSnoozes(snoozeMap);

        // Load comment counts for all tasks
        const { data: commentsData } = await supabase
          .from("task_comments")
          .select("task_id")
          .in("task_id", allTaskIds);

        const commentCounts: Record<string, number> = {};
        (commentsData || []).forEach((comment) => {
          if (!comment.task_id) return;
          commentCounts[comment.task_id] = (commentCounts[comment.task_id] || 0) + 1;
        });
        setTaskCommentCounts(commentCounts);
      } else {
        setSubtasks({});
        setTaskSnoozes({});
        setTaskCommentCounts({});
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const handleToggleComplete = async (taskId: string) => {
    const task = [...assignedTasks, ...createdTasks, ...Object.values(subtasks).flat()].find(t => t.id === taskId);
    if (!task || !user) return;
    
    try {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ status: "completed", progress: 100 })
        .eq("id", taskId)
        .select();

      if (updateError) throw updateError;

      await supabase
        .from('archived_tasks')
        .insert({
          task_id: taskId,
          user_id: user.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          category: 'personal',
          assigned_to: task.assigned_to || '',
          progress: 100,
          due_date: task.due_date,
          completed_at: new Date().toISOString(),
          auto_delete_after_days: null,
        });

      await supabase.from('tasks').delete().eq('id', taskId);
      
      setAssignedTasks(prev => prev.filter(t => t.id !== taskId));
      setCreatedTasks(prev => prev.filter(t => t.id !== taskId));
      await loadTasks();

      setShowCelebration(true);
      toast({ title: "Aufgabe erledigt und archiviert" });
    } catch (error: any) {
      console.error("Error completing task:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleToggleSubtaskComplete = async (subtaskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: 'completed', progress: 100 })
        .eq("id", subtaskId)
        .select();

      if (error) throw error;
      setShowCelebration(true);
      toast({ title: "Unteraufgabe erledigt" });
      loadTasks();
    } catch (error) {
      console.error("Error completing subtask:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleUpdateTitle = async (taskId: string, title: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ title })
        .eq("id", taskId)
        .select();

      if (error) throw error;
      
      setAssignedTasks(prev => prev.map(t => t.id === taskId ? { ...t, title } : t));
      setCreatedTasks(prev => prev.map(t => t.id === taskId ? { ...t, title } : t));
      await loadTasks();
      toast({ title: "Titel aktualisiert" });
    } catch (error) {
      console.error("Error updating title:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  const handleUpdateDescription = async (taskId: string, description: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ description })
        .eq("id", taskId)
        .select();

      if (error) throw error;
      
      setAssignedTasks(prev => prev.map(t => t.id === taskId ? { ...t, description } : t));
      setCreatedTasks(prev => prev.map(t => t.id === taskId ? { ...t, description } : t));
      await loadTasks();
      toast({ title: "Beschreibung aktualisiert" });
    } catch (error) {
      console.error("Error updating description:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  const handleUpdateDueDate = async (taskId: string, date: Date | null) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: date?.toISOString() || null })
        .eq("id", taskId)
        .select();

      if (error) throw error;
      
      const newDueDate = date?.toISOString() || null;
      setAssignedTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: newDueDate } : t));
      setCreatedTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: newDueDate } : t));
      await loadTasks();
      toast({ title: "Frist aktualisiert" });
    } catch (error) {
      console.error("Error updating due date:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  // Action handlers - open dialogs instead of navigating
  const handleReminder = (taskId: string) => {
    setSnoozeTaskId(taskId);
    setSnoozeDialogOpen(true);
  };

  const handleSetSnooze = async (date: Date) => {
    if (!snoozeTaskId || !user) return;
    const targetTaskId = snoozeTaskId;
    
    try {
      // Check if there's already a snooze for this task
      const { data: existingSnooze } = await supabase
        .from('task_snoozes')
        .select('id')
        .eq('task_id', snoozeTaskId)
        .eq('user_id', user.id)
        .single();

      if (existingSnooze) {
        // Update existing snooze
        const { error } = await supabase
          .from('task_snoozes')
          .update({ snoozed_until: date.toISOString() })
          .eq('id', existingSnooze.id);
        if (error) throw error;
      } else {
        // Create new snooze
        const { error } = await supabase
          .from('task_snoozes')
          .insert({
            user_id: user.id,
            task_id: snoozeTaskId,
            snoozed_until: date.toISOString()
          });
        if (error) throw error;
      }
      
      toast({ title: "Wiedervorlage gesetzt" });
      setTaskSnoozes(prev => ({ ...prev, [targetTaskId]: date.toISOString() }));
      setSnoozeDialogOpen(false);
      setSnoozeTaskId(null);
      loadTasks();
    } catch (error) {
      console.error("Error setting snooze:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const clearSnoozeForTask = async (taskId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('task_snoozes')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', user.id);

    if (error) throw error;
  };

  const handleClearSnooze = async () => {
    if (!snoozeTaskId || !user) return;
    const targetTaskId = snoozeTaskId;

    try {
      await clearSnoozeForTask(snoozeTaskId);

      toast({ title: "Wiedervorlage entfernt" });
      setTaskSnoozes(prev => {
        const next = { ...prev };
        delete next[targetTaskId];
        return next;
      });
      setSnoozeDialogOpen(false);
      setSnoozeTaskId(null);
      loadTasks();
    } catch (error) {
      console.error("Error clearing snooze:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleQuickClearSnooze = async (taskId: string) => {
    try {
      await clearSnoozeForTask(taskId);
      toast({ title: "Wiedervorlage entfernt" });
      setTaskSnoozes(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      loadTasks();
    } catch (error) {
      console.error("Error clearing snooze:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleAssign = (taskId: string) => {
    const task = [...assignedTasks, ...createdTasks, ...Object.values(subtasks).flat()].find((t) => t.id === taskId);
    setAssignSelectedUserIds(normalizeAssignedTo(task?.assigned_to ?? null));
    setAssignTaskId(taskId);
    setAssignDialogOpen(true);
  };

  const handleUpdateAssignee = async (userIds: string[]) => {
    if (!assignTaskId) return;
    const normalizedAssignees = userIds.map((id) => id.trim()).filter(Boolean);
    const assignedToValue = normalizedAssignees.length > 0 ? normalizedAssignees.join(',') : null;
    
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_to: assignedToValue })
        .eq("id", assignTaskId)
        .select();

      if (error) throw error;
      
      setAssignedTasks(prev => prev.map(t => 
        t.id === assignTaskId ? { ...t, assigned_to: assignedToValue } : t
      ));
      setCreatedTasks(prev => prev.map(t => 
        t.id === assignTaskId ? { ...t, assigned_to: assignedToValue } : t
      ));
      
      toast({ title: "Zuweisung aktualisiert" });
      setAssignDialogOpen(false);
      setAssignTaskId(null);
      setAssignSelectedUserIds([]);
      loadTasks(); // Reload to update lists
    } catch (error) {
      console.error("Error updating assignee:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleComment = (taskId: string) => {
    setCommentTaskId(taskId);
    setCommentSidebarOpen(true);
  };

  const handleDecision = (taskId: string) => {
    setDecisionTaskId(taskId);
    setDecisionDialogOpen(true);
  };

  const handleDocuments = (taskId: string) => {
    setDocumentTaskId(taskId);
    setDocumentDialogOpen(true);
  };

  const handleAddToMeeting = (taskId: string) => {
    setMeetingTaskId(taskId);
    setMeetingSelectorOpen(true);
  };

  const handleSelectMeeting = async (meetingId: string, meetingTitle: string) => {
    if (!meetingTaskId || !user) return;
    
    try {
      console.log('Adding task to meeting:', { taskId: meetingTaskId, meetingId });
      
      const { data, error } = await supabase
        .from('tasks')
        .update({ meeting_id: meetingId, pending_for_jour_fixe: false })
        .eq('id', meetingTaskId)
        .select();

      if (error) {
        console.error('Error adding task to meeting:', error);
        toast({ 
          title: "Fehler", 
          description: error.message || "Aufgabe konnte nicht zugeordnet werden.",
          variant: "destructive" 
        });
        return;
      }
      
      if (!data || data.length === 0) {
        toast({ 
          title: "Warnung", 
          description: "Keine Aufgabe aktualisiert.",
          variant: "destructive" 
        });
        return;
      }
      
      toast({ title: `Aufgabe zu "${meetingTitle}" hinzugefügt` });
      loadTasks();
    } catch (error: any) {
      console.error('Error adding task to meeting:', error);
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setMeetingTaskId(null);
    }
  };

  const handleMarkForNextJourFixe = async () => {
    if (!meetingTaskId || !user) return;
    
    try {
      console.log('Marking task for next jour fixe:', meetingTaskId);
      
      const { data, error } = await supabase
        .from('tasks')
        .update({ pending_for_jour_fixe: true, meeting_id: null })
        .eq('id', meetingTaskId)
        .select();

      if (error) {
        console.error('Error marking task:', error);
        toast({ 
          title: "Fehler", 
          description: error.message || "Aufgabe konnte nicht vorgemerkt werden.",
          variant: "destructive" 
        });
        return;
      }
      
      toast({ title: "Aufgabe für nächsten Jour Fixe vorgemerkt" });
      loadTasks();
    } catch (error: any) {
      console.error('Error marking task for next jour fixe:', error);
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setMeetingTaskId(null);
    }
  };

  const handleCreateChildTask = async (parentTaskId: string) => {
    if (!user) return;

    const parentTask = [...createdTasks, ...assignedTasks, ...Object.values(subtasks).flat()].find((task) => task.id === parentTaskId);
    if (!parentTask?.tenant_id) {
      toast({ title: "Fehler", description: "Übergeordnete Aufgabe nicht gefunden.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          tenant_id: parentTask.tenant_id,
          parent_task_id: parentTaskId,
          title: "Neue Unteraufgabe",
          description: null,
          status: "todo",
          priority: "medium",
          category: parentTask.category || "personal",
          assigned_to: user.id,
        });

      if (error) throw error;
      toast({ title: "Unteraufgabe erstellt" });
      await loadTasks();
    } catch (error) {
      console.error("Error creating child task:", error);
      toast({ title: "Fehler", description: "Unteraufgabe konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const getChildTasks = (parentId: string) => subtasks[parentId] || [];

  const toEditorHtml = (value: string | null | undefined) => {
    if (!value) return "";
    if (/<[^>]+>/.test(value)) return value;
    return `<p>${value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</p>`;
  };

  const openTaskEditDialog = (taskId: string) => {
    const task = [...assignedTasks, ...createdTasks, ...Object.values(subtasks).flat()].find((t) => t.id === taskId);
    if (!task) return;

    setEditingTaskId(taskId);
    setEditTaskTitle(task.title || '');
    setEditTaskDescription(toEditorHtml(task.description));
    setTaskEditDialogOpen(true);
  };

  const handleSaveTaskEdit = async () => {
    if (!editingTaskId) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: editTaskTitle.trim() || 'Ohne Titel',
          description: editTaskDescription || null,
        })
        .eq("id", editingTaskId)
        .select();

      if (error) throw error;

      toast({ title: "Aufgabe aktualisiert" });
      setTaskEditDialogOpen(false);
      setEditingTaskId(null);
      await loadTasks();
    } catch (error) {
      console.error("Error updating task:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  const getTaskTitle = (taskId: string | null) => {
    if (!taskId) return undefined;
    const task = [...assignedTasks, ...createdTasks, ...Object.values(subtasks).flat()].find(t => t.id === taskId);
    return task?.title;
  };

  const normalizeAssignedTo = (assignedTo: string | null | undefined) => {
    if (!assignedTo) return [];

    return assignedTo
      .replace(/[{}]/g, '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const profileNameMap = useMemo(() => {
    return profiles.reduce((acc, profile) => {
      acc[profile.user_id] = profile.display_name || profile.user_id;
      return acc;
    }, {} as Record<string, string>);
  }, [profiles]);

  const resolveAssigneeName = (assignedTo: string | null | undefined) => {
    const assigneeIds = normalizeAssignedTo(assignedTo);
    if (assigneeIds.length === 0) return undefined;

    return assigneeIds
      .map((id) => profileNameMap[id] || id)
      .join(', ');
  };

  const splitTasksBySnooze = useMemo(() => {
    const now = startOfDay(new Date());

    const split = (tasks: Task[]) => {
      // Analog zu Quick Notes:
      // - fällige Wiedervorlagen separat anzeigen
      // - geplante Wiedervorlagen bis zum Datum ausblenden
      // - normale Hauptliste enthält nur Aufgaben OHNE Wiedervorlage
      const dueFollowUps = tasks.filter((task) => {
        const snoozedUntil = taskSnoozes[task.id];
        return snoozedUntil && isBefore(startOfDay(new Date(snoozedUntil)), addDays(now, 1));
      });

      const scheduledFollowUps = tasks.filter((task) => {
        const snoozedUntil = taskSnoozes[task.id];
        return !!snoozedUntil && isAfter(startOfDay(new Date(snoozedUntil)), now);
      });

      const visibleTasks = tasks.filter((task) => !taskSnoozes[task.id]);

      return { dueFollowUps, visibleTasks, scheduledFollowUps };
    };

    return {
      created: split(createdTasks),
      assigned: split(assignedTasks),
    };
  }, [createdTasks, assignedTasks, taskSnoozes]);

  const renderTaskList = (
    tasks: Task[],
    title: string,
    emptyMessage: string,
    options?: { scrollable?: boolean; compact?: boolean; allowQuickUnsnooze?: boolean; showFollowUpDateBadge?: boolean }
  ) => {
    const { scrollable = true, compact = false, allowQuickUnsnooze = false, showFollowUpDateBadge = false } = options || {};

    const listContent = tasks.length === 0 ? (
      <p className="text-sm text-muted-foreground px-2 py-4">{emptyMessage}</p>
    ) : viewType === "card" ? (
      <div className="space-y-2 pr-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            subtasks={subtasks[task.id]}
            resolveAssigneeName={resolveAssigneeName}
            hasMeetingLink={!!(task.meeting_id || task.pending_for_jour_fixe)}
            hasReminder={!!taskSnoozes[task.id]}
            followUpDate={showFollowUpDateBadge ? taskSnoozes[task.id] : undefined}
            onComplete={handleToggleComplete}
            onSubtaskComplete={handleToggleSubtaskComplete}
            onNavigate={(id) => navigate(`/tasks?id=${id}`)}
            onUpdateTitle={handleUpdateTitle}
            onUpdateDescription={handleUpdateDescription}
            onUpdateDueDate={handleUpdateDueDate}
            onReminder={(taskId) => {
              if (allowQuickUnsnooze && taskSnoozes[taskId]) {
                void handleQuickClearSnooze(taskId);
                return;
              }
              handleReminder(taskId);
            }}
            onAssign={handleAssign}
            onComment={handleComment}
            onDecision={handleDecision}
            onDocuments={handleDocuments}
            onAddToMeeting={handleAddToMeeting}
            onCreateChildTask={handleCreateChildTask}
            onEdit={openTaskEditDialog}
            getChildTasks={getChildTasks}
            getCommentCount={(taskId) => taskCommentCounts[taskId] || 0}
            showPersistentCommentIndicator
          />
        ))}
      </div>
    ) : (
      <div className="border rounded-lg overflow-hidden">
        {tasks.map((task) => (
          <TaskListRow
            key={task.id}
            task={task}
            subtasks={subtasks[task.id]}
            resolveAssigneeName={resolveAssigneeName}
            hasMeetingLink={!!(task.meeting_id || task.pending_for_jour_fixe)}
            hasReminder={!!taskSnoozes[task.id]}
            followUpDate={showFollowUpDateBadge ? taskSnoozes[task.id] : undefined}
            onComplete={handleToggleComplete}
            onSubtaskComplete={handleToggleSubtaskComplete}
            onNavigate={(id) => navigate(`/tasks?id=${id}`)}
            onUpdateTitle={handleUpdateTitle}
            onUpdateDueDate={handleUpdateDueDate}
            onReminder={(taskId) => {
              if (allowQuickUnsnooze && taskSnoozes[taskId]) {
                void handleQuickClearSnooze(taskId);
                return;
              }
              handleReminder(taskId);
            }}
            onAssign={handleAssign}
            onComment={handleComment}
            onDecision={handleDecision}
            onDocuments={handleDocuments}
            onAddToMeeting={handleAddToMeeting}
            onCreateChildTask={handleCreateChildTask}
            onEdit={openTaskEditDialog}
            getChildTasks={getChildTasks}
            getCommentCount={(taskId) => taskCommentCounts[taskId] || 0}
            showPersistentCommentIndicator
          />
        ))}
      </div>
    );

    return (
      <div className={`flex flex-col ${scrollable ? 'h-full' : ''}`}>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{title}</h3>
            <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
          </div>
        </div>
        
        {scrollable ? (
          <ScrollArea className="flex-1">{listContent}</ScrollArea>
        ) : (
          listContent
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  // Apply status filter
  const filteredCreatedTasks = statusFilter === 'all' 
    ? splitTasksBySnooze.created.visibleTasks 
    : splitTasksBySnooze.created.visibleTasks.filter(t => t.status === statusFilter);
  const filteredAssignedTasks = statusFilter === 'all' 
    ? splitTasksBySnooze.assigned.visibleTasks 
    : splitTasksBySnooze.assigned.visibleTasks.filter(t => t.status === statusFilter);

  const filteredDueCreatedTasks = statusFilter === 'all'
    ? splitTasksBySnooze.created.dueFollowUps
    : splitTasksBySnooze.created.dueFollowUps.filter(t => t.status === statusFilter);
  const filteredDueAssignedTasks = statusFilter === 'all'
    ? splitTasksBySnooze.assigned.dueFollowUps
    : splitTasksBySnooze.assigned.dueFollowUps.filter(t => t.status === statusFilter);

  const filteredScheduledCreatedTasks = statusFilter === 'all'
    ? splitTasksBySnooze.created.scheduledFollowUps
    : splitTasksBySnooze.created.scheduledFollowUps.filter(t => t.status === statusFilter);
  const filteredScheduledAssignedTasks = statusFilter === 'all'
    ? splitTasksBySnooze.assigned.scheduledFollowUps
    : splitTasksBySnooze.assigned.scheduledFollowUps.filter(t => t.status === statusFilter);

  const filteredScheduledTasks = Array.from(
    new Map(
      [...filteredScheduledCreatedTasks, ...filteredScheduledAssignedTasks].map((task) => [task.id, task])
    ).values()
  );

  const hiddenScheduledCount = filteredScheduledTasks.length;
  const dueFollowUpCount = filteredDueCreatedTasks.length + filteredDueAssignedTasks.length;
  const totalTasks = filteredAssignedTasks.length + filteredCreatedTasks.length;
  const keepMainListsScrollable = hiddenScheduledCount === 0;

  return (
    <div className="h-[calc(100vh-20rem)] flex flex-col">
      {/* Header with view toggle and status filter */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Aufgaben</span>
          <Badge variant="outline">{totalTasks}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {taskStatuses.map(status => (
                <SelectItem key={status.name} value={status.name}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup 
            type="single" 
            value={viewType} 
            onValueChange={(value) => value && setViewType(value as ViewType)}
            className="bg-muted rounded-md p-0.5"
          >
            <ToggleGroupItem value="card" aria-label="Kartenansicht" className="h-7 w-7 p-0">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Listenansicht" className="h-7 w-7 p-0">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {dueFollowUpCount > 0 && (
        <div className="px-4 pt-2">
          <Collapsible open={dueFollowUpsExpanded} onOpenChange={setDueFollowUpsExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", !dueFollowUpsExpanded && "-rotate-90")} />
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Fällige Wiedervorlagen</span>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">{dueFollowUpCount}</Badge>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="pt-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {renderTaskList(filteredDueCreatedTasks, "Von mir erstellt", "Keine fälligen Wiedervorlagen", { scrollable: false, compact: true, allowQuickUnsnooze: true })}
                  {renderTaskList(filteredDueAssignedTasks, "Mir zugewiesen", "Keine fälligen Wiedervorlagen", { scrollable: false, compact: true, allowQuickUnsnooze: true })}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Main content - 50/50 split */}
      {totalTasks === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Keine offenen Aufgaben</p>
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-2 gap-4 p-4",
            keepMainListsScrollable && "flex-1 min-h-0"
          )}
        >
          {renderTaskList(filteredCreatedTasks, "Von mir erstellt", "Keine eigenen Aufgaben", { scrollable: keepMainListsScrollable })}
          {renderTaskList(filteredAssignedTasks, "Mir zugewiesen", "Keine Aufgaben zugewiesen", { scrollable: keepMainListsScrollable })}
        </div>
      )}

      {hiddenScheduledCount > 0 && (
        <div className="px-4 pb-3">
          <Separator className="mb-3" />
          <Collapsible open={scheduledFollowUpsExpanded} onOpenChange={setScheduledFollowUpsExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", !scheduledFollowUpsExpanded && "-rotate-90")} />
                <Hourglass className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Geplant (bis zum Datum ausgeblendet)</span>
                <Badge variant="secondary" className="text-xs">{hiddenScheduledCount}</Badge>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="pt-2">
              {renderTaskList(
                filteredScheduledTasks,
                "Geplante Wiedervorlagen",
                "Keine geplanten Wiedervorlagen",
                { scrollable: false, compact: true, allowQuickUnsnooze: false, showFollowUpDateBadge: true }
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Snooze/Wiedervorlage Dialog */}
      <Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Wiedervorlage setzen</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={snoozeTaskId && taskSnoozes[snoozeTaskId] ? new Date(taskSnoozes[snoozeTaskId]) : undefined}
            onSelect={(date) => date && handleSetSnooze(date)}
            disabled={(date) => date < new Date()}
            initialFocus
          />
          {snoozeTaskId && taskSnoozes[snoozeTaskId] && (
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={handleClearSnooze}>
              Wiedervorlage entfernen
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Aufgabe zuweisen</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              <MultiSelect
                options={profiles.map((profile) => ({
                  value: profile.user_id,
                  label: profile.display_name || 'Unbekannter Benutzer',
                }))}
                selected={assignSelectedUserIds}
                onChange={setAssignSelectedUserIds}
                placeholder="Personen auswählen"
              />
              <div className="flex justify-end">
                <Button onClick={() => handleUpdateAssignee(assignSelectedUserIds)}>
                  Zuweisung speichern
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={taskEditDialogOpen} onOpenChange={setTaskEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Aufgabe bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Titel</div>
              <Input value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} placeholder="Titel" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Beschreibung</div>
              <SimpleRichTextEditor
                initialContent={editTaskDescription}
                onChange={setEditTaskDescription}
                placeholder="Beschreibung eingeben..."
                minHeight="180px"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveTaskEdit}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comment Sidebar */}
      <TaskCommentSidebar
        taskId={commentTaskId}
        taskTitle={getTaskTitle(commentTaskId)}
        isOpen={commentSidebarOpen}
        onOpenChange={setCommentSidebarOpen}
      />

      {/* Decision Creator - controlled dialog with pre-filled values */}
      {decisionTaskId && (
        <TaskDecisionCreator 
          taskId={decisionTaskId}
          isOpen={decisionDialogOpen}
          onOpenChange={(open) => {
            setDecisionDialogOpen(open);
            if (!open) setDecisionTaskId(null);
          }}
          initialTitle={(() => {
            const task = [...assignedTasks, ...createdTasks].find(t => t.id === decisionTaskId);
            return task?.title;
          })()}
          initialDescription={(() => {
            const task = [...assignedTasks, ...createdTasks].find(t => t.id === decisionTaskId);
            return task?.description || undefined;
          })()}
          onDecisionCreated={() => {
            setDecisionDialogOpen(false);
            setDecisionTaskId(null);
            toast({ title: "Entscheidungsanfrage erstellt" });
          }}
        />
      )}

      {/* Document Dialog */}
      <TaskDocumentDialog
        taskId={documentTaskId}
        taskTitle={getTaskTitle(documentTaskId)}
        isOpen={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
      />

      {/* Meeting Selector Dialog */}
      <TaskMeetingSelector
        open={meetingSelectorOpen}
        onOpenChange={setMeetingSelectorOpen}
        onSelect={handleSelectMeeting}
        onMarkForNextJourFixe={handleMarkForNextJourFixe}
      />

      {/* Celebration Animation on task completion */}
      <CelebrationAnimationSystem 
        isVisible={showCelebration} 
        onAnimationComplete={() => setShowCelebration(false)} 
      />
    </div>
  );
}
