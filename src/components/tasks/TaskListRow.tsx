import { useState, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { TaskBadges } from "./TaskBadges";
import { TaskActionIcons } from "./TaskActionIcons";
import { Calendar as CalendarIcon, ChevronDown, ChevronRight, Clock3, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { LetterSourceLink } from "@/components/letters/LetterSourceLink";
import { extractLetterSourceId } from "@/utils/letterSource";

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
}

interface TaskListRowProps {
  task: Task;
  subtasks?: Task[];
  assigneeName?: string;
  hasMeetingLink?: boolean;
  hasReminder?: boolean;
  depth?: number;
  onComplete: (taskId: string) => void;
  onSubtaskComplete: (subtaskId: string) => void;
  onNavigate: (taskId: string) => void;
  onUpdateTitle?: (taskId: string, title: string) => void;
  onUpdateDueDate?: (taskId: string, date: Date | null) => void;
  onReminder?: (taskId: string) => void;
  onAssign?: (taskId: string) => void;
  onComment?: (taskId: string) => void;
  onDecision?: (taskId: string) => void;
  onDocuments?: (taskId: string) => void;
  onAddToMeeting?: (taskId: string) => void;
  onCreateChildTask?: (taskId: string) => void;
  getChildTasks?: (taskId: string) => Task[];
}

export function TaskListRow({
  task,
  subtasks = [],
  assigneeName,
  hasMeetingLink,
  hasReminder,
  depth = 0,
  onComplete,
  onSubtaskComplete,
  onNavigate,
  onUpdateTitle,
  onUpdateDueDate,
  onReminder,
  onAssign,
  onComment,
  onDecision,
  onDocuments,
  onAddToMeeting,
  onCreateChildTask,
  getChildTasks,
}: TaskListRowProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [expanded, setExpanded] = useState(false);
  const [dueDatePopoverOpen, setDueDatePopoverOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const childTasks = getChildTasks ? getChildTasks(task.id) : subtasks;
  const hasSubtasks = childTasks.length > 0;
  const sourceLetterId = extractLetterSourceId(task.description);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const getDueDateColor = (dueDate: string | null) => {
    if (!dueDate) return "text-muted-foreground";
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return "text-red-500";
    if (isToday(date)) return "text-orange-500";
    return "text-muted-foreground";
  };

  const handleTitleSave = () => {
    if (titleValue.trim() && titleValue !== task.title && onUpdateTitle) {
      onUpdateTitle(task.id, titleValue.trim());
    } else {
      setTitleValue(task.title);
    }
    setEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === "Escape") {
      setTitleValue(task.title);
      setEditingTitle(false);
    }
  };

  const handleDueDateSelect = (date: Date | undefined) => {
    if (onUpdateDueDate) {
      onUpdateDueDate(task.id, date || null);
    }
    setDueDatePopoverOpen(false);
  };

  return (
    <div className="group">
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors border-b" style={{ paddingLeft: `${12 + depth * 20}px` }}>
        <div className="w-4 flex-shrink-0">
          {hasSubtasks && (
            <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        <Checkbox className="h-4 w-4 flex-shrink-0" onCheckedChange={() => onComplete(task.id)} />

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <Input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleKeyDown}
              className="h-6 text-sm py-0"
            />
          ) : (
            <div className="flex items-center gap-1">
              <span
                className="text-sm truncate block cursor-text hover:bg-muted px-1 -mx-1 rounded"
                onDoubleClick={() => onUpdateTitle && setEditingTitle(true)}
                onClick={() => onNavigate(task.id)}
              >
                {task.title}
                {hasSubtasks && <span className="text-xs text-muted-foreground ml-2">({childTasks.length})</span>}
              </span>
              {sourceLetterId && <LetterSourceLink letterId={sourceLetterId} className="h-6 px-1" />}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 w-32">
          <div className="group-hover:hidden">
            <TaskBadges
              priority={task.priority}
              status={task.status}
              category={task.category}
              assignedTo={task.assigned_to}
              assigneeName={assigneeName}
              isHovered={false}
            />
          </div>
          <div className="hidden group-hover:block">
            <TaskBadges priority={task.priority} status={task.status} isHovered={true} />
          </div>
        </div>

        <div className="flex items-center flex-shrink-0">
          <Popover open={dueDatePopoverOpen} onOpenChange={setDueDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={cn("h-6 px-2 text-xs w-16 justify-start", getDueDateColor(task.due_date))}>
                <CalendarIcon className="h-3 w-3 mr-1" />
                {task.due_date ? format(new Date(task.due_date), "dd.MM.", { locale: de }) : "–"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={task.due_date ? new Date(task.due_date) : undefined} onSelect={handleDueDateSelect} initialFocus />
            </PopoverContent>
          </Popover>

          <div className="hidden group-hover:flex items-center">
            <Separator orientation="vertical" className="h-4 mx-1" />
            <TaskActionIcons
              taskId={task.id}
              hasMeetingLink={hasMeetingLink}
              hasReminder={hasReminder}
              commentCount={commentCount}
              onReminder={onReminder}
              onAssign={onAssign}
              onComment={onComment}
              onDecision={onDecision}
              onDocuments={onDocuments}
              onAddToMeeting={onAddToMeeting}
              onCreateChildTask={onCreateChildTask}
            />
          </div>

          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => onNavigate(task.id)}>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {expanded && hasSubtasks && (
        <div className="bg-muted/30 border-b">
          {childTasks.map((childTask) => (
            <TaskListRow
              key={childTask.id}
              task={childTask}
              subtasks={getChildTasks ? getChildTasks(childTask.id) : []}
              assigneeName={assigneeName}
              hasMeetingLink={!!(childTask.meeting_id || childTask.pending_for_jour_fixe)}
              hasReminder={hasReminder}
              depth={depth + 1}
              onComplete={onComplete}
              onSubtaskComplete={onSubtaskComplete}
              onNavigate={onNavigate}
              onUpdateTitle={onUpdateTitle}
              onUpdateDueDate={onUpdateDueDate}
              onReminder={onReminder}
              onAssign={onAssign}
              onComment={onComment}
              onDecision={onDecision}
              onDocuments={onDocuments}
              onAddToMeeting={onAddToMeeting}
              onCreateChildTask={onCreateChildTask}
              getChildTasks={getChildTasks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
