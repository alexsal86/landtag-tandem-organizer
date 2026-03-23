import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addDays, isAfter, isBefore, startOfDay } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useViewPreference } from "@/hooks/useViewPreference";
import { useMyWorkTasksData } from "@/hooks/useMyWorkTasksData";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { CelebrationAnimationSystem } from "@/components/celebrations";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { toEditorHtml } from "@/components/my-work/utils/editorContent";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Input } from "@/components/ui/input";
import { addDays, isAfter, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { debugConsole } from "@/utils/debugConsole";
import { MyWorkTasksToolbar } from "./MyWorkTasksToolbar";
import { MyWorkTasksBoard } from "./MyWorkTasksBoard";
import { MyWorkTasksList } from "./MyWorkTasksList";
import { MyWorkTaskDialogs } from "./MyWorkTaskDialogs";
import { useMyWorkTaskActions } from "./useMyWorkTaskActions";

interface Profile {
  user_id: string;
  display_name: string | null;
}

const DEFAULT_TASK_STATUSES = [
  { name: "todo", label: "Offen" },
  { name: "in-progress", label: "In Bearbeitung" },
  { name: "completed", label: "Erledigt" },
];

export function MyWorkTasksTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewType, setViewType } = useViewPreference({ key: "mywork-tasks", defaultView: "card" });
  const { isHighlighted, highlightRef } = useNotificationHighlight();

  const {
    assignedTasks,
    setAssignedTasks,
    createdTasks,
    setCreatedTasks,
    subtasks,
    setSubtasks,
    taskSnoozes,
    setTaskSnoozes,
    taskCommentCounts,
    loading,
  } = useMyWorkTasksData(user?.id);

  const [statusFilter, setStatusFilter] = usePersistentState<string>("mywork-tasks-status-filter", "all");
  const [taskStatuses, setTaskStatuses] = useState<{ name: string; label: string }[]>([]);
  const [taskCategories, setTaskCategories] = useState<{ name: string; label: string }[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dueFollowUpsExpanded, setDueFollowUpsExpanded] = useState(true);
  const [scheduledFollowUpsExpanded, setScheduledFollowUpsExpanded] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create-task") {
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
      navigate("/tasks?action=create");
    }
  }, [navigate, searchParams, setSearchParams]);

  useEffect(() => {
    if (!user) return;

    const loadProfiles = async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("user_id, display_name").order("display_name");
        if (error) throw error;
        setProfiles(data || []);
      } catch (error) {
        debugConsole.error("Error loading profiles:", error);
      }
    };

    const loadTaskStatuses = async () => {
      try {
        const { data } = await supabase.from("task_statuses").select("name, label").eq("is_active", true).order("order_index");
        setTaskStatuses(data || []);
      } catch (error) {
        debugConsole.error("Error loading task statuses:", error);
      }
    };

    const loadTaskCategories = async () => {
      try {
        const { data } = await supabase.from("task_categories").select("name, label").eq("is_active", true).order("order_index");
        setTaskCategories(data || []);
      } catch (error) {
        debugConsole.error("Error loading task categories:", error);
      }
      
      toast({ title: "Aufgabe für nächsten Jour Fixe vorgemerkt" });
    } catch (error: unknown) {
      debugConsole.error('Error marking task for next jour fixe:', error);
      toast({ title: "Fehler", description: error instanceof Error ? error.message : "Unbekannter Fehler", variant: "destructive" });
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
      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          user_id: user.id,
          tenant_id: parentTask.tenant_id,
          parent_task_id: parentTaskId,
          title: "Neue Unteraufgabe",
          description: null,
          status: "todo",
          priority: "medium",
          category: parentTask.category || "personal",
          assigned_to: user.id,
        }])
        .select("id, title, description, priority, status, due_date, assigned_to, user_id, created_at, category, meeting_id, pending_for_jour_fixe, parent_task_id, tenant_id")
        .single();

      if (error) throw error;
      toast({ title: "Unteraufgabe erstellt" });
      if (!data) return;
      setSubtasks(prev => ({
        ...prev,
        [parentTaskId]: [
          ...(prev[parentTaskId] || []),
          data,
        ],
      }));
    } catch (error) {
      debugConsole.error("Error creating child task:", error);
      toast({ title: "Fehler", description: "Unteraufgabe konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const getChildTasks = (parentId: string) => subtasks[parentId] || [];

  const openTaskEditDialog = (taskId: string) => {
    const task = [...assignedTasks, ...createdTasks, ...Object.values(subtasks).flat()].find((t) => t.id === taskId);
    if (!task) return;

    setEditingTaskId(taskId);
    setEditTaskTitle(task.title || '');
    setEditTaskDescription(toEditorHtml(task.description));
    setEditTaskPriority(task.priority || 'medium');
    setEditTaskStatus(task.status || 'todo');
    setEditTaskCategory(task.category || 'personal');
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
          priority: editTaskPriority,
          status: editTaskStatus,
          category: editTaskCategory,
        })
        .eq("id", editingTaskId)
        .select();

      if (error) throw error;

      toast({ title: "Aufgabe aktualisiert" });
      setTaskEditDialogOpen(false);
      setEditingTaskId(null);
      setAssignedTasks(prev => prev.map((task) =>
        task.id === editingTaskId
          ? {
              ...task,
              title: editTaskTitle.trim() || 'Ohne Titel',
              description: editTaskDescription || null,
              priority: editTaskPriority,
              status: editTaskStatus,
              category: editTaskCategory,
            }
          : task
      ));
      setCreatedTasks(prev => prev.map((task) =>
        task.id === editingTaskId
          ? {
              ...task,
              title: editTaskTitle.trim() || 'Ohne Titel',
              description: editTaskDescription || null,
              priority: editTaskPriority,
              status: editTaskStatus,
              category: editTaskCategory,
            }
          : task
      ));
      setSubtasks(prev => {
        const next: Record<string, MyWorkTask[]> = {};
        Object.entries(prev).forEach(([parentId, list]) => {
          next[parentId] = list.map((task) =>
            task.id === editingTaskId
              ? {
                  ...task,
                  title: editTaskTitle.trim() || 'Ohne Titel',
                  description: editTaskDescription || null,
                  priority: editTaskPriority,
                  status: editTaskStatus,
                  category: editTaskCategory,
                }
              : task
          );
        });
        return next;
      });
    } catch (error) {
      debugConsole.error("Error updating task:", error);
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

    void Promise.all([loadProfiles(), loadTaskStatuses(), loadTaskCategories()]);
  }, [user]);

  const { availableTaskStatuses, availableTaskCategories, dialogState, helpers, actions } = useMyWorkTaskActions({
    userId: user?.id,
    assignedTasks,
    setAssignedTasks,
    createdTasks,
    setCreatedTasks,
    subtasks,
    setSubtasks,
    taskSnoozes,
    setTaskSnoozes,
    profiles,
    taskStatuses,
    taskCategories,
    onCelebrate: () => setShowCelebration(true),
  });

  const splitTasksBySnooze = useMemo(() => {
    const now = startOfDay(new Date());

    const split = <T extends { id: string }>(tasks: T[]) => {
      const dueFollowUps = tasks.filter((task) => {
        const snoozedUntil = taskSnoozes[task.id];
        return snoozedUntil && isBefore(startOfDay(new Date(snoozedUntil)), addDays(now, 1));
      });

      const scheduledFollowUps = tasks.filter((task) => {
        const snoozedUntil = taskSnoozes[task.id];
        return !!snoozedUntil && isAfter(startOfDay(new Date(snoozedUntil)), now);
      });

      const visibleTasks = tasks.filter((task) => !taskSnoozes[task.id]);
      return { dueFollowUps, scheduledFollowUps, visibleTasks };
    };

    return {
      created: split(createdTasks),
      assigned: split(assignedTasks),
    };
  }, [assignedTasks, createdTasks, taskSnoozes]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}</div>
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}</div>
      </div>
    );
  }

  const filterTasks = <T extends { status: string }>(tasks: T[]) => statusFilter === "all" ? tasks : tasks.filter((task) => task.status === statusFilter);

  const filteredCreatedTasks = filterTasks(splitTasksBySnooze.created.visibleTasks);
  const filteredAssignedTasks = filterTasks(splitTasksBySnooze.assigned.visibleTasks);
  const filteredDueCreatedTasks = filterTasks(splitTasksBySnooze.created.dueFollowUps);
  const filteredDueAssignedTasks = filterTasks(splitTasksBySnooze.assigned.dueFollowUps);
  const filteredScheduledCreatedTasks = filterTasks(splitTasksBySnooze.created.scheduledFollowUps);
  const filteredScheduledAssignedTasks = filterTasks(splitTasksBySnooze.assigned.scheduledFollowUps);

  const filteredScheduledTasks = Array.from(
    new Map([...filteredScheduledCreatedTasks, ...filteredScheduledAssignedTasks].map((task) => [task.id, task])).values()
  );

  const hiddenScheduledCount = filteredScheduledTasks.length;
  const dueFollowUpCount = filteredDueCreatedTasks.length + filteredDueAssignedTasks.length;
  const totalTasks = filteredAssignedTasks.length + filteredCreatedTasks.length;
  const keepMainListsScrollable = hiddenScheduledCount === 0;
  const availableStatusesForToolbar = availableTaskStatuses.length > 0 ? availableTaskStatuses : DEFAULT_TASK_STATUSES;
  const allTasks = [...assignedTasks, ...createdTasks, ...Object.values(subtasks).flat()];

  const TaskCollectionView = viewType === "card" ? MyWorkTasksBoard : MyWorkTasksList;
  const sharedTaskListProps = {
    isHighlighted,
    highlightRef,
    subtasks,
    taskSnoozes,
    taskCommentCounts,
    resolveAssigneeName: helpers.resolveAssigneeName,
    onNavigate: (taskId: string) => navigate(`/tasks?id=${taskId}`),
    onComplete: actions.handleToggleComplete,
    onSubtaskComplete: actions.handleToggleSubtaskComplete,
    onUpdateTitle: actions.handleUpdateTitle,
    onUpdateDueDate: actions.handleUpdateDueDate,
    onReminder: actions.handleReminder,
    onAssign: actions.handleAssign,
    onComment: actions.handleComment,
    onDecision: actions.handleDecision,
    onDocuments: actions.handleDocuments,
    onAddToMeeting: actions.handleAddToMeeting,
    onCreateChildTask: actions.handleCreateChildTask,
    onEdit: actions.openTaskEditDialog,
    getChildTasks: helpers.getChildTasks,
    onQuickClearSnooze: (taskId: string) => void actions.handleQuickClearSnooze(taskId),
  };

  return (
    <div className="h-[calc(100vh-20rem)] flex flex-col">
      <MyWorkTasksToolbar
        totalTasks={totalTasks}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        taskStatuses={availableStatusesForToolbar}
        viewType={viewType}
        onViewTypeChange={setViewType}
        dueFollowUpCount={dueFollowUpCount}
        dueFollowUpsExpanded={dueFollowUpsExpanded}
        onDueFollowUpsExpandedChange={setDueFollowUpsExpanded}
        hiddenScheduledCount={hiddenScheduledCount}
        scheduledFollowUpsExpanded={scheduledFollowUpsExpanded}
        onScheduledFollowUpsExpandedChange={setScheduledFollowUpsExpanded}
      />

      {dueFollowUpCount > 0 && (
        <div className="px-4 pt-2">
          <Collapsible open={dueFollowUpsExpanded} onOpenChange={setDueFollowUpsExpanded}>
            <CollapsibleContent className="pt-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <TaskCollectionView
                    {...sharedTaskListProps}
                    {...(viewType === "card" ? { onUpdateDescription: actions.handleUpdateDescription } : {})}
                    tasks={filteredDueCreatedTasks}
                    title="Von mir erstellt"
                    emptyMessage="Keine fälligen Wiedervorlagen"
                    scrollable={false}
                    compact
                    allowQuickUnsnooze
                  />
                  <TaskCollectionView
                    {...sharedTaskListProps}
                    {...(viewType === "card" ? { onUpdateDescription: actions.handleUpdateDescription } : {})}
                    tasks={filteredDueAssignedTasks}
                    title="Mir zugewiesen"
                    emptyMessage="Keine fälligen Wiedervorlagen"
                    scrollable={false}
                    compact
                    allowQuickUnsnooze
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {totalTasks === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Keine offenen Aufgaben</p>
        </div>
      ) : (
        <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4 p-4", keepMainListsScrollable && "flex-1 min-h-0")}>
          <TaskCollectionView
            {...sharedTaskListProps}
            {...(viewType === "card" ? { onUpdateDescription: actions.handleUpdateDescription } : {})}
            tasks={filteredCreatedTasks}
            title="Von mir erstellt"
            emptyMessage="Keine eigenen Aufgaben"
            scrollable={keepMainListsScrollable}
          />
          <TaskCollectionView
            {...sharedTaskListProps}
            {...(viewType === "card" ? { onUpdateDescription: actions.handleUpdateDescription } : {})}
            tasks={filteredAssignedTasks}
            title="Mir zugewiesen"
            emptyMessage="Keine Aufgaben zugewiesen"
            scrollable={keepMainListsScrollable}
          />
        </div>
      )}

      {hiddenScheduledCount > 0 && (
        <div className="px-4 pb-3">
          <Separator className="mb-3" />
          <Collapsible open={scheduledFollowUpsExpanded} onOpenChange={setScheduledFollowUpsExpanded}>
            <CollapsibleContent className="pt-2">
              <TaskCollectionView
                {...sharedTaskListProps}
                {...(viewType === "card" ? { onUpdateDescription: actions.handleUpdateDescription } : {})}
                tasks={filteredScheduledTasks}
                title="Geplante Wiedervorlagen"
                emptyMessage="Keine geplanten Wiedervorlagen"
                scrollable={false}
                compact
                showFollowUpDateBadge
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      <MyWorkTaskDialogs
        profiles={profiles}
        tasks={allTasks}
        taskSnoozes={taskSnoozes}
        availableTaskStatuses={availableTaskStatuses}
        availableTaskCategories={availableTaskCategories}
        dialogState={dialogState}
        getTaskTitle={helpers.getTaskTitle}
        onSetSnooze={actions.handleSetSnooze}
        onClearSnooze={actions.handleClearSnooze}
        onUpdateAssignee={actions.handleUpdateAssignee}
        onSelectMeeting={actions.handleSelectMeeting}
        onMarkForNextJourFixe={actions.handleMarkForNextJourFixe}
        onSaveTaskEdit={actions.handleSaveTaskEdit}
        onDecisionCreated={() => {
          toast({ title: "Entscheidungsanfrage erstellt" });
        }}
      />

      <CelebrationAnimationSystem isVisible={showCelebration} onAnimationComplete={() => setShowCelebration(false)} />
    </div>
  );
}
