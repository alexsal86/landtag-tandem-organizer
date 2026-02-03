import { useState, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TaskBadges } from "./TaskBadges";
import { TaskActionIcons } from "./TaskActionIcons";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";

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
}

interface Subtask {
  id: string;
  task_id: string;
  description: string | null;
  is_completed: boolean;
  due_date: string | null;
}

interface TaskListRowProps {
  task: Task;
  subtasks?: Subtask[];
  assigneeName?: string;
  onComplete: (taskId: string) => void;
  onSubtaskComplete: (subtaskId: string) => void;
  onNavigate: (taskId: string) => void;
  onUpdateTitle?: (taskId: string, title: string) => void;
  onReminder?: (taskId: string) => void;
  onAssign?: (taskId: string) => void;
  onComment?: (taskId: string) => void;
  onDecision?: (taskId: string) => void;
  onDocuments?: (taskId: string) => void;
}

export function TaskListRow({
  task,
  subtasks = [],
  assigneeName,
  onComplete,
  onSubtaskComplete,
  onNavigate,
  onUpdateTitle,
  onReminder,
  onAssign,
  onComment,
  onDecision,
  onDocuments,
}: TaskListRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [expanded, setExpanded] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const hasSubtasks = subtasks.length > 0;

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

  return (
    <div className="group">
      <div
        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors border-b"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Expand toggle for subtasks */}
        <div className="w-4 flex-shrink-0">
          {hasSubtasks && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Checkbox */}
        <Checkbox
          className="h-4 w-4 flex-shrink-0"
          onCheckedChange={() => onComplete(task.id)}
        />

        {/* Title - inline editable on double-click */}
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
            <span
              className="text-sm truncate block cursor-text hover:bg-muted px-1 -mx-1 rounded"
              onDoubleClick={() => onUpdateTitle && setEditingTitle(true)}
              onClick={() => onNavigate(task.id)}
            >
              {task.title}
              {hasSubtasks && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({subtasks.length})
                </span>
              )}
            </span>
          )}
        </div>

        {/* Badges */}
        <div className="flex-shrink-0 w-32">
          {/* Small squares - visible when NOT hovering */}
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
          {/* Full badges - visible on hover */}
          <div className="hidden group-hover:block">
            <TaskBadges
              priority={task.priority}
              status={task.status}
              isHovered={true}
            />
          </div>
        </div>

        {/* Due date */}
        <div className={cn("flex-shrink-0 w-20 text-xs", getDueDateColor(task.due_date))}>
          {task.due_date ? (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date), "dd.MM.", { locale: de })}
            </div>
          ) : (
            <span className="text-muted-foreground">–</span>
          )}
        </div>

        {/* Actions - visible on hover */}
        <div className="flex-shrink-0 w-28 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <TaskActionIcons
            taskId={task.id}
            onReminder={onReminder}
            onAssign={onAssign}
            onComment={onComment}
            onDecision={onDecision}
            onDocuments={onDocuments}
          />
        </div>
      </div>

      {/* Subtasks */}
      {expanded && hasSubtasks && (
        <div className="bg-muted/30 border-b">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-2 px-3 py-1.5 pl-12 hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                className="h-4 w-4"
                onCheckedChange={() => onSubtaskComplete(subtask.id)}
              />
              <span className="text-sm text-foreground flex-1 truncate">
                {subtask.description}
              </span>
              {subtask.due_date && (
                <span className={cn("text-xs", getDueDateColor(subtask.due_date))}>
                  {format(new Date(subtask.due_date), "dd.MM.", { locale: de })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
