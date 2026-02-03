import { useState, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { TaskBadges } from "./TaskBadges";
import { TaskActionIcons } from "./TaskActionIcons";
import { Calendar as CalendarIcon, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
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
  onUpdateDueDate?: (taskId: string, date: Date | null) => void;
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
  onUpdateDueDate,
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
  const [dueDatePopoverOpen, setDueDatePopoverOpen] = useState(false);
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

  const handleDueDateSelect = (date: Date | undefined) => {
    if (onUpdateDueDate) {
      onUpdateDueDate(task.id, date || null);
    }
    setDueDatePopoverOpen(false);
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

        {/* Due date + Actions + Navigate */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Due date - clickable for editing */}
          <Popover open={dueDatePopoverOpen} onOpenChange={setDueDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-2 text-xs w-16 justify-start",
                  getDueDateColor(task.due_date)
                )}
              >
                <CalendarIcon className="h-3 w-3 mr-1" />
                {task.due_date 
                  ? format(new Date(task.due_date), "dd.MM.", { locale: de })
                  : "–"
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={task.due_date ? new Date(task.due_date) : undefined}
                onSelect={handleDueDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Separator - visible on hover */}
          <Separator 
            orientation="vertical" 
            className="h-4 mx-1 opacity-0 group-hover:opacity-100 transition-opacity" 
          />

          {/* Actions - visible on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <TaskActionIcons
              taskId={task.id}
              onReminder={onReminder}
              onAssign={onAssign}
              onComment={onComment}
              onDecision={onDecision}
              onDocuments={onDocuments}
            />
          </div>

          {/* Navigate button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => onNavigate(task.id)}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
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
