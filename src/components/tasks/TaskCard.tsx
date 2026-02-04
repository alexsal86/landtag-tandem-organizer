import { useState, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { TaskBadges } from "./TaskBadges";
import { TaskActionIcons } from "./TaskActionIcons";
import { Calendar as CalendarIcon, ExternalLink, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface TaskCardProps {
  task: Task;
  subtasks?: Subtask[];
  assigneeName?: string;
  onComplete: (taskId: string) => void;
  onSubtaskComplete: (subtaskId: string) => void;
  onNavigate: (taskId: string) => void;
  onUpdateTitle?: (taskId: string, title: string) => void;
  onUpdateDescription?: (taskId: string, description: string) => void;
  onUpdateDueDate?: (taskId: string, date: Date | null) => void;
  onReminder?: (taskId: string) => void;
  onAssign?: (taskId: string) => void;
  onComment?: (taskId: string) => void;
  onDecision?: (taskId: string) => void;
  onDocuments?: (taskId: string) => void;
}

export function TaskCard({
  task,
  subtasks = [],
  assigneeName,
  onComplete,
  onSubtaskComplete,
  onNavigate,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateDueDate,
  onReminder,
  onAssign,
  onComment,
  onDecision,
  onDocuments,
}: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [descriptionValue, setDescriptionValue] = useState(task.description || "");
  const [dueDatePopoverOpen, setDueDatePopoverOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  const hasSubtasks = subtasks.length > 0;

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (editingDescription && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  }, [editingDescription]);

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

  const handleDescriptionSave = () => {
    if (descriptionValue !== task.description && onUpdateDescription) {
      onUpdateDescription(task.id, descriptionValue);
    }
    setEditingDescription(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: "title" | "description") => {
    if (e.key === "Enter" && type === "title") {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === "Escape") {
      if (type === "title") {
        setTitleValue(task.title);
        setEditingTitle(false);
      } else {
        setDescriptionValue(task.description || "");
        setEditingDescription(false);
      }
    }
  };

  const handleDueDateSelect = (date: Date | undefined) => {
    if (onUpdateDueDate) {
      onUpdateDueDate(task.id, date || null);
    }
    setDueDatePopoverOpen(false);
  };

  return (
    <div
      className="group rounded-lg border bg-card relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3 p-3">
        <Checkbox
          className="mt-0.5 h-4 w-4 flex-shrink-0"
          onCheckedChange={() => onComplete(task.id)}
        />
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title - inline editable */}
          {editingTitle ? (
            <Input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => handleKeyDown(e, "title")}
              className="h-7 text-sm font-medium py-0"
            />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                className="font-semibold text-sm cursor-text hover:bg-muted/50 px-1 -mx-1 rounded"
                onClick={() => onUpdateTitle && setEditingTitle(true)}
              >
                {task.title}
              </span>
              {hasSubtasks && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  <ListTodo className="h-2.5 w-2.5 mr-1" />
                  {subtasks.length}
                </Badge>
              )}
            </div>
          )}

          {/* Description - inline editable */}
          {editingDescription ? (
            <Textarea
              ref={descriptionInputRef}
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              onBlur={handleDescriptionSave}
              onKeyDown={(e) => handleKeyDown(e, "description")}
              className="min-h-[60px] text-xs"
              rows={2}
            />
          ) : task.description ? (
            <div 
              className="cursor-text hover:bg-muted/50 px-1 -mx-1 rounded"
              onClick={() => onUpdateDescription && setEditingDescription(true)}
            >
              <RichTextDisplay content={task.description} className="text-xs line-clamp-2" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom bar with badges and actions */}
      <div className="px-3 pb-2 flex items-center justify-between">
        {/* Left: Badges */}
        <div className="flex-1">
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
              category={task.category}
              assignedTo={task.assigned_to}
              assigneeName={assigneeName}
              isHovered={true}
            />
          </div>
        </div>

        {/* Right: Due date + Actions + Navigate */}
        <div className="flex items-center">
          {/* Due date - always visible, clickable for editing */}
          <Popover open={dueDatePopoverOpen} onOpenChange={setDueDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-2 text-xs",
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

          {/* Separator + Action icons - hidden when not hovered to remove spacing */}
          <div className="hidden group-hover:flex items-center">
            <Separator orientation="vertical" className="h-4 mx-1" />
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
            size="sm"
            className="h-6 w-6 p-0 flex-shrink-0"
            onClick={() => onNavigate(task.id)}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Subtasks */}
      {hasSubtasks && (
        <div className="border-t bg-muted/30 px-3 py-2 space-y-1">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/50 transition-colors"
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
