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
import { Calendar as CalendarIcon, Clock3, ExternalLink, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { LetterSourceLink } from "@/components/letters/LetterSourceLink";
import { extractLetterSourceId, stripLetterSourceMarker } from "@/utils/letterSource";

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

interface TaskCardProps {
  task: Task;
  subtasks?: Task[];
  assigneeName?: string;
  resolveAssigneeName?: (assignedTo: string | null) => string | undefined;
  hasMeetingLink?: boolean;
  hasReminder?: boolean;
  followUpDate?: string | null;
  commentCount?: number;
  depth?: number;
  isLastChild?: boolean;
  className?: string;
  highlightRef?: (el: HTMLElement | null) => void;
  isHighlighted?: (taskId: string) => boolean;
  getHighlightRef?: (taskId: string) => (el: HTMLElement | null) => void;
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
  onAddToMeeting?: (taskId: string) => void;
  onCreateChildTask?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  getChildTasks?: (taskId: string) => Task[];
  getCommentCount?: (taskId: string) => number;
  showPersistentCommentIndicator?: boolean;
}

export function TaskCard({
  task,
  subtasks = [],
  assigneeName,
  resolveAssigneeName,
  hasMeetingLink,
  hasReminder,
  followUpDate,
  commentCount = 0,
  depth = 0,
  isLastChild = false,
  className,
  highlightRef,
  isHighlighted,
  getHighlightRef,
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
  onAddToMeeting,
  onCreateChildTask,
  onEdit,
  getChildTasks,
  getCommentCount,
  showPersistentCommentIndicator = false,
}: TaskCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [descriptionValue, setDescriptionValue] = useState(task.description || "");
  const [dueDatePopoverOpen, setDueDatePopoverOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  const childTasks = getChildTasks ? getChildTasks(task.id) : subtasks;
  const currentCommentCount = getCommentCount ? getCommentCount(task.id) : commentCount;
  const hasSubtasks = childTasks.length > 0;
  const hasDueDate = Boolean(task.due_date);
  const sourceLetterId = extractLetterSourceId(task.description);
  const cleanDescription = stripLetterSourceMarker(task.description);
  const currentAssigneeName = assigneeName ?? resolveAssigneeName?.(task.assigned_to);
  const assigneeIds = (task.assigned_to || "")
    .replace(/[{}]/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const hasMultipleAssignees = assigneeIds.length > 1;
  const assignTooltipText = currentAssigneeName
    ? `Zugewiesen an ${currentAssigneeName}`
    : "Zuweisen";
  const CHECKBOX_SIZE = 16;
  const CHECKBOX_CENTER = CHECKBOX_SIZE / 2;
  const CONNECTOR_X = CHECKBOX_CENTER + 8;
  const PARENT_LINE_START_TOP = 6;
  const CHILD_CONNECTOR_TARGET_TOP = 16;
  const [parentLineHeight, setParentLineHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const childrenRef = useRef<HTMLDivElement>(null);
  const measureRafIdRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!hasSubtasks || !containerRef.current || !childrenRef.current) {
      setParentLineHeight(null);
      return;
    }

    const measure = () => {
      const container = containerRef.current;
      const childrenEl = childrenRef.current;
      if (!container || !childrenEl) return;
      const lastChild = childrenEl.lastElementChild as HTMLElement | null;
      if (!lastChild) return;

      const containerTop = container.getBoundingClientRect().top;
      const lastChildRect = lastChild.getBoundingClientRect();
      const lineStart = PARENT_LINE_START_TOP;
      const lineEnd = lastChildRect.top - containerTop + CHILD_CONNECTOR_TARGET_TOP;
      setParentLineHeight(Math.max(0, lineEnd - lineStart));
    };

    const scheduleMeasure = () => {
      if (measureRafIdRef.current != null) return;
      measureRafIdRef.current = requestAnimationFrame(() => {
        measureRafIdRef.current = null;
        measure();
      });
    };

    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(childrenRef.current);

    return () => {
      observer.disconnect();
      if (measureRafIdRef.current != null) {
        cancelAnimationFrame(measureRafIdRef.current);
        measureRafIdRef.current = null;
      }
    };
  }, [hasSubtasks, childTasks.length]);

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
      ref={(el) => {
        containerRef.current = el;
        const targetRef = getHighlightRef ? getHighlightRef(task.id) : highlightRef;
        targetRef?.(el);
      }}
      className={cn("relative rounded-md", depth > 0 && "ml-8", className)}
    >
      {hasSubtasks && parentLineHeight != null && parentLineHeight > 0 && (
        <div
          className="absolute bg-border/70"
          aria-hidden="true"
          style={{
            left: `${CONNECTOR_X}px`,
            top: `${PARENT_LINE_START_TOP}px`,
            height: `${parentLineHeight}px`,
            width: "2px",
          }}
        />
      )}

      {depth > 0 && (
        <div
          className="absolute"
          aria-hidden="true"
          style={{
            left: `-${CHECKBOX_CENTER + 8}px`,
            top: 0,
            width: `${CHECKBOX_CENTER + 4}px`,
            height: `${CHILD_CONNECTOR_TARGET_TOP}px`,
            borderLeft: "2px solid hsl(var(--border) / 0.7)",
            borderBottom: "2px solid hsl(var(--border) / 0.7)",
            borderBottomLeftRadius: "8px",
          }}
        />
      )}

      <div
        className={cn(
          "border border-border rounded-lg bg-card",
          isHighlighted?.(task.id) && "notification-highlight",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-start gap-3 p-3">
          <Checkbox className="mt-0.5 h-4 w-4 flex-shrink-0" onCheckedChange={() => onComplete(task.id)} />
          <div className="flex-1 min-w-0 space-y-1">
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
                    {childTasks.length}
                  </Badge>
                )}
              </div>
            )}

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
            ) : cleanDescription ? (
              <div className="cursor-text hover:bg-muted/50 px-1 -mx-1 rounded" onClick={() => onUpdateDescription && setEditingDescription(true)}>
                <RichTextDisplay content={cleanDescription} className="text-xs line-clamp-2" />
              </div>
            ) : null}

            {sourceLetterId && (
              <div className="px-1">
                <LetterSourceLink letterId={sourceLetterId} />
              </div>
            )}
          </div>
        </div>

        <div className="px-3 pb-2 flex items-center justify-between">
          <div className="flex-1">
            <div className={cn(isHovered && "hidden")}>
              <TaskBadges
                priority={task.priority}
                status={task.status}
                category={task.category}
                assignedTo={task.assigned_to}
                assigneeName={currentAssigneeName}
                isHovered={false}
              />
            </div>
            <div className={cn(!isHovered && "hidden")}>
              <TaskBadges
                priority={task.priority}
                status={task.status}
                category={task.category}
                assignedTo={task.assigned_to}
                assigneeName={currentAssigneeName}
                isHovered={true}
              />
            </div>
          </div>

          <div className="ml-auto flex items-center">
            {followUpDate && (
              <Badge
                variant="outline"
                className="mr-1 h-6 px-2 text-[11px] border-amber-400 text-amber-700 bg-amber-50"
              >
                <Clock3 className="h-3 w-3 mr-1" />
                {format(new Date(followUpDate), "dd.MM.yy", { locale: de })}
              </Badge>
            )}

            <Popover open={dueDatePopoverOpen} onOpenChange={setDueDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-xs transition-opacity",
                    !hasDueDate && !isHovered && "opacity-0 pointer-events-none",
                    getDueDateColor(task.due_date)
                  )}
                >
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {task.due_date ? format(new Date(task.due_date), "dd.MM.", { locale: de }) : "–"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={task.due_date ? new Date(task.due_date) : undefined} onSelect={handleDueDateSelect} initialFocus />
              </PopoverContent>
            </Popover>

            <div className={cn("items-center", !isHovered ? "hidden" : "flex")}>
              <Separator orientation="vertical" className="h-4 mx-1" />
              <TaskActionIcons
                taskId={task.id}
                hasReminder={hasReminder}
                hasMeetingLink={hasMeetingLink}
                commentCount={currentCommentCount}
                hasMultipleAssignees={hasMultipleAssignees}
                assignTooltipText={assignTooltipText}
                onReminder={onReminder}
                onAssign={onAssign}
                onComment={onComment}
                onDecision={onDecision}
                onDocuments={onDocuments}
                onAddToMeeting={onAddToMeeting}
                onCreateChildTask={onCreateChildTask}
                onEdit={onEdit}
              />
            </div>

            {isHovered && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => onNavigate(task.id)}>
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {hasSubtasks && (
        <div ref={childrenRef} className="mt-2 space-y-2">
          {childTasks.map((childTask, index) => (
            <TaskCard
              key={childTask.id}
              task={childTask}
              isHighlighted={isHighlighted}
              getHighlightRef={getHighlightRef}
              subtasks={getChildTasks ? getChildTasks(childTask.id) : []}
              resolveAssigneeName={resolveAssigneeName}
              hasMeetingLink={!!(childTask.meeting_id || childTask.pending_for_jour_fixe)}
              hasReminder={hasReminder}
              depth={depth + 1}
              isLastChild={index === childTasks.length - 1}
              onComplete={onComplete}
              onSubtaskComplete={onSubtaskComplete}
              onNavigate={onNavigate}
              onUpdateTitle={onUpdateTitle}
              onUpdateDescription={onUpdateDescription}
              onUpdateDueDate={onUpdateDueDate}
              onReminder={onReminder}
              onAssign={onAssign}
              onComment={onComment}
              onDecision={onDecision}
              onDocuments={onDocuments}
              onAddToMeeting={onAddToMeeting}
              onCreateChildTask={onCreateChildTask}
              onEdit={onEdit}
              getChildTasks={getChildTasks}
              getCommentCount={getCommentCount}
              showPersistentCommentIndicator={showPersistentCommentIndicator}
            />
          ))}
        </div>
      )}
    </div>
  );
}
