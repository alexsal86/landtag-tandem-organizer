import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useViewPreference } from "@/hooks/useViewPreference";
import { useMyWorkTasksData } from "@/hooks/useMyWorkTasksData";
import { useTenant } from "@/hooks/useTenant";
import { TaskTemplateButton } from "@/components/my-work/tasks/workspace/TaskTemplateDialog";
import { DEFAULT_TASK_STATUSES, useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useTaskCategories } from "@/hooks/useTaskCategories";
import { useTenantProfiles } from "@/hooks/useTenantProfiles";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { CelebrationAnimationSystem } from "@/components/celebrations";
import { TodoCreateDialog } from "@/features/tasks/components/TodoCreateDialog";
import { addDays, isAfter, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { MyWorkTasksToolbar } from "./MyWorkTasksToolbar";
import { MyWorkTasksBoard } from "./MyWorkTasksBoard";
import { MyWorkTasksList } from "./MyWorkTasksList";
import { MyWorkTaskDialogs } from "./MyWorkTaskDialogs";
import { MyWorkEmptyState } from "./MyWorkEmptyState";
import { ListTodo } from "lucide-react";
import { useMyWorkTaskActions } from "./useMyWorkTaskActions";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { TaskStafetteWorkspace } from "./tasks/workspace/TaskStafetteWorkspace";

export function MyWorkTasksTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewType, setViewType } = useViewPreference({
    key: "mywork-tasks",
    defaultView: "card",
  });
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
    loadTasks,
  } = useMyWorkTasksData(user?.id, currentTenant?.id);

  const [statusFilter, setStatusFilter] = usePersistentState<string>(
    "mywork-tasks-status-filter",
    "all",
  );
  const {
    data: taskStatuses,
  } = useTaskStatuses();
  const {
    data: taskCategories,
  } = useTaskCategories();
  const {
    data: profiles,
  } = useTenantProfiles();
  const [dueFollowUpsExpanded, setDueFollowUpsExpanded] = useState(true);
  const [scheduledFollowUpsExpanded, setScheduledFollowUpsExpanded] =
    useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const [todoCreateOpen, setTodoCreateOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = usePersistentState<"stafette" | "classic">(
    "mywork-tasks-workspace-mode",
    "stafette",
  );

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create-task") {
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
      setTodoCreateOpen(true);
    }
  }, [searchParams, setSearchParams]);

  const {
    availableTaskStatuses,
    availableTaskCategories,
    dialogState,
    helpers,
    actions,
  } = useMyWorkTaskActions({
    userId: user?.id,
    invalidateTasks: loadTasks,
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
        return (
          snoozedUntil &&
          isBefore(startOfDay(new Date(snoozedUntil)), addDays(now, 1))
        );
      });

      const scheduledFollowUps = tasks.filter((task) => {
        const snoozedUntil = taskSnoozes[task.id];
        return (
          !!snoozedUntil && isAfter(startOfDay(new Date(snoozedUntil)), now)
        );
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

  const filterTasks = <T extends { status: string }>(tasks: T[]) =>
    statusFilter === "all"
      ? tasks
      : tasks.filter((task) => task.status === statusFilter);

  const filteredCreatedTasks = filterTasks(
    splitTasksBySnooze.created.visibleTasks,
  );
  const filteredAssignedTasks = filterTasks(
    splitTasksBySnooze.assigned.visibleTasks,
  );
  const filteredDueCreatedTasks = filterTasks(
    splitTasksBySnooze.created.dueFollowUps,
  );
  const filteredDueAssignedTasks = filterTasks(
    splitTasksBySnooze.assigned.dueFollowUps,
  );
  const filteredScheduledCreatedTasks = filterTasks(
    splitTasksBySnooze.created.scheduledFollowUps,
  );
  const filteredScheduledAssignedTasks = filterTasks(
    splitTasksBySnooze.assigned.scheduledFollowUps,
  );

  const filteredScheduledTasks = Array.from(
    new Map(
      [...filteredScheduledCreatedTasks, ...filteredScheduledAssignedTasks].map(
        (task) => [task.id, task],
      ),
    ).values(),
  );

  const hiddenScheduledCount = filteredScheduledTasks.length;
  const dueFollowUpCount =
    filteredDueCreatedTasks.length + filteredDueAssignedTasks.length;
  const totalTasks = filteredAssignedTasks.length + filteredCreatedTasks.length;
  const keepMainListsScrollable = hiddenScheduledCount === 0;
  const availableStatusesForToolbar =
    availableTaskStatuses.length > 0
      ? availableTaskStatuses
      : DEFAULT_TASK_STATUSES;
  const allTasks = [
    ...assignedTasks,
    ...createdTasks,
    ...Object.values(subtasks).flat(),
  ];

  const TaskCollectionView =
    viewType === "card" ? MyWorkTasksBoard : MyWorkTasksList;
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
    onQuickClearSnooze: (taskId: string) =>
      void actions.handleQuickClearSnooze(taskId),
  };

  const dialogsAndExtras = (
    <>
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
          notify.success("Entscheidungsanfrage erstellt");
        }}
      />
      <CelebrationAnimationSystem
        isVisible={showCelebration}
        onAnimationComplete={() => setShowCelebration(false)}
      />
      <TodoCreateDialog
        open={todoCreateOpen}
        onOpenChange={setTodoCreateOpen}
        onTodoCreated={() => loadTasks()}
      />
    </>
  );

  const modeToggle = (
    <div className="flex justify-end gap-xs px-4 pt-2">
      {workspaceMode === "stafette" && <TaskTemplateButton userId={user?.id} tenantId={currentTenant?.id} onCreated={() => void loadTasks()} />}
      <Button size="sm" variant={workspaceMode === "stafette" ? "default" : "outline"} onClick={() => setWorkspaceMode("stafette")}>
        Stafette
      </Button>
      <Button size="sm" variant={workspaceMode === "classic" ? "default" : "outline"} onClick={() => setWorkspaceMode("classic")}>
        Klassisch
      </Button>
    </div>
  );

  if (workspaceMode === "stafette") {
    const uniqueTopLevel = Array.from(
      new Map([...assignedTasks, ...createdTasks].map((t) => [t.id, t])).values(),
    );
    return (
      <div className="min-h-[calc(100vh-20rem)] flex flex-col">
        {modeToggle}
        <div className="flex-1 min-h-0 flex flex-col pt-2">
          <TaskStafetteWorkspace
            userId={user?.id}
            tasks={uniqueTopLevel}
            profiles={profiles ?? []}
            onReload={loadTasks}
            onComplete={(id) => actions.handleToggleComplete(id)}
            onDecision={actions.handleDecision}
            onJourFixe={actions.handleAddToMeeting}
            onCreate={() => setTodoCreateOpen(true)}
          />
        </div>
        {dialogsAndExtras}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-20rem)] flex flex-col">
      {modeToggle}
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
          <Collapsible
            open={dueFollowUpsExpanded}
            onOpenChange={setDueFollowUpsExpanded}
          >
            <CollapsibleContent className="pt-2">
              <div className="rounded-lg border border-palette-amber/30 bg-palette-amber/10/40 p-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <TaskCollectionView
                    {...sharedTaskListProps}
                    {...(viewType === "card"
                      ? { onUpdateDescription: actions.handleUpdateDescription }
                      : {})}
                    tasks={filteredDueCreatedTasks}
                    title="Von mir erstellt"
                    emptyMessage="Keine fälligen Wiedervorlagen"
                    scrollable={false}
                    compact
                    allowQuickUnsnooze
                  />
                  <TaskCollectionView
                    {...sharedTaskListProps}
                    {...(viewType === "card"
                      ? { onUpdateDescription: actions.handleUpdateDescription }
                      : {})}
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
        <div className="flex-1 flex items-center justify-center p-4">
          <MyWorkEmptyState
            icon={ListTodo}
            title="Noch keine Aufgaben"
            description="Erstelle eine Aufgabe, um Themen zu sortieren, zuzuweisen und nachzuverfolgen."
            actionLabel="Aufgabe erstellen"
            onAction={() => setTodoCreateOpen(true)}
          />
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-2 gap-4 p-4",
            keepMainListsScrollable && "flex-1 min-h-0",
          )}
        >
          <TaskCollectionView
            {...sharedTaskListProps}
            {...(viewType === "card"
              ? { onUpdateDescription: actions.handleUpdateDescription }
              : {})}
            tasks={filteredCreatedTasks}
            title="Von mir erstellt"
            emptyMessage="Keine eigenen Aufgaben"
            scrollable={keepMainListsScrollable}
          />
          <TaskCollectionView
            {...sharedTaskListProps}
            {...(viewType === "card"
              ? { onUpdateDescription: actions.handleUpdateDescription }
              : {})}
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
          <Collapsible
            open={scheduledFollowUpsExpanded}
            onOpenChange={setScheduledFollowUpsExpanded}
          >
            <CollapsibleContent className="pt-2">
              <TaskCollectionView
                {...sharedTaskListProps}
                {...(viewType === "card"
                  ? { onUpdateDescription: actions.handleUpdateDescription }
                  : {})}
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

      {dialogsAndExtras}
    </div>
  );
}
