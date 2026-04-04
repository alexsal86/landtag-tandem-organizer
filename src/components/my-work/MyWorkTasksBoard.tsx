import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "@/components/tasks/TaskCard";
import { MyWorkTask } from "@/hooks/useMyWorkTasksData";

interface MyWorkTasksBoardProps {
  tasks: MyWorkTask[];
  title: string;
  emptyMessage: string;
  scrollable?: boolean;
  compact?: boolean;
  allowQuickUnsnooze?: boolean;
  showFollowUpDateBadge?: boolean;
  isHighlighted: (taskId: string) => boolean;
  highlightRef: (taskId: string) => (el: HTMLElement | null) => void;
  subtasks: Record<string, MyWorkTask[]>;
  taskSnoozes: Record<string, string>;
  taskCommentCounts: Record<string, number>;
  resolveAssigneeName: (assignedTo: string | null | undefined) => string | undefined;
  onNavigate: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onSubtaskComplete: (taskId: string) => void;
  onUpdateTitle: (taskId: string, title: string) => void;
  onUpdateDescription?: (taskId: string, description: string) => void;
  onUpdateDueDate: (taskId: string, date: Date | null) => void;
  onReminder: (taskId: string) => void;
  onAssign: (taskId: string) => void;
  onComment: (taskId: string) => void;
  onDecision: (taskId: string) => void;
  onDocuments: (taskId: string) => void;
  onAddToMeeting: (taskId: string) => void;
  onCreateChildTask: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  getChildTasks: (taskId: string) => MyWorkTask[];
  onQuickClearSnooze: (taskId: string) => void;
}

export function MyWorkTasksBoard({
  tasks,
  title,
  emptyMessage,
  scrollable = true,
  compact = false,
  allowQuickUnsnooze = false,
  showFollowUpDateBadge = false,
  isHighlighted,
  highlightRef,
  subtasks,
  taskSnoozes,
  taskCommentCounts,
  resolveAssigneeName,
  onNavigate,
  onComplete,
  onSubtaskComplete,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateDueDate,
  onReminder,
  onAssign,
  onComment,
  onDecision,
  onDocuments,
  onAddToMeeting,
  onCreateChildTask,
  onEdit,
  getChildTasks,
  onQuickClearSnooze,
}: MyWorkTasksBoardProps) {
  const listContent = tasks.length === 0 ? (
    <p className="text-sm text-muted-foreground px-2 py-4">{emptyMessage}</p>
  ) : (
    <div className="space-y-2 pr-2 pb-6">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          isHighlighted={isHighlighted}
          getHighlightRef={highlightRef}
          className={isHighlighted(task.id) ? "notification-highlight" : undefined}
          highlightRef={highlightRef(task.id)}
          subtasks={subtasks[task.id]}
          resolveAssigneeName={resolveAssigneeName}
          hasMeetingLink={!!(task.meeting_id || task.pending_for_jour_fixe)}
          hasReminder={!!taskSnoozes[task.id]}
          followUpDate={showFollowUpDateBadge ? taskSnoozes[task.id] : undefined}
          onComplete={onComplete}
          onSubtaskComplete={onSubtaskComplete}
          onNavigate={onNavigate}
          onUpdateTitle={onUpdateTitle}
          onUpdateDescription={onUpdateDescription}
          onUpdateDueDate={onUpdateDueDate}
          onReminder={(taskId) => {
            if (allowQuickUnsnooze && taskSnoozes[taskId]) {
              onQuickClearSnooze(taskId);
              return;
            }
            onReminder(taskId);
          }}
          onAssign={onAssign}
          onComment={onComment}
          onDecision={onDecision}
          onDocuments={onDocuments}
          onAddToMeeting={onAddToMeeting}
          onCreateChildTask={onCreateChildTask}
          onEdit={onEdit}
          getChildTasks={getChildTasks}
          getCommentCount={(taskId) => taskCommentCounts[taskId] || 0}
          showPersistentCommentIndicator
          connectorParentLineStartTop={16}
          connectorChildTargetTop={16}
        />
      ))}
    </div>
  );

  return (
    <div className={`flex flex-col ${scrollable ? "h-full" : ""}`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>{title}</h3>
          <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
        </div>
      </div>
      {scrollable ? <ScrollArea className="flex-1">{listContent}</ScrollArea> : listContent}
    </div>
  );
}
