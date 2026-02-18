import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlarmClock, UserPlus, MessageSquare, Vote, Paperclip, CalendarDays, Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskActionIconsProps {
  taskId: string;
  onReminder?: (taskId: string) => void;
  onAssign?: (taskId: string) => void;
  onComment?: (taskId: string) => void;
  onDecision?: (taskId: string) => void;
  onDocuments?: (taskId: string) => void;
  onAddToMeeting?: (taskId: string) => void;
  onCreateChildTask?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  hasComments?: boolean;
  commentCount?: number;
  hasDocuments?: boolean;
  hasMeetingLink?: boolean;
  hasReminder?: boolean;
  hasMultipleAssignees?: boolean;
  assignTooltipText?: string;
  className?: string;
}

export function TaskActionIcons({
  taskId,
  onReminder,
  onAssign,
  onComment,
  onDecision,
  onDocuments,
  onAddToMeeting,
  onCreateChildTask,
  onEdit,
  hasComments = false,
  commentCount = 0,
  hasDocuments = false,
  hasMeetingLink = false,
  hasReminder = false,
  hasMultipleAssignees = false,
  assignTooltipText,
  className,
}: TaskActionIconsProps) {
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-0.5", className)}>
        {onReminder && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 hover:bg-muted/80 rounded-full",
                  hasReminder && "text-amber-600"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onReminder(taskId);
                }}
              >
                <AlarmClock className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Wiedervorlage</TooltipContent>
          </Tooltip>
        )}

        {onAssign && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 hover:bg-muted/80 rounded-full",
                  hasMultipleAssignees && "text-cyan-600"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onAssign(taskId);
                }}
              >
                <UserPlus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{assignTooltipText || "Zuweisen"}</TooltipContent>
          </Tooltip>
        )}

        {onComment && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 hover:bg-muted/80 rounded-full relative",
                  (hasComments || commentCount > 0) && "text-blue-600"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onComment(taskId);
                }}
              >
                <MessageSquare className="h-3 w-3" />
                {commentCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-1 rounded-full bg-blue-600 text-[9px] leading-none text-white flex items-center justify-center font-medium">
                    {commentCount > 99 ? '99+' : commentCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Kommentare</TooltipContent>
          </Tooltip>
        )}

        {onDecision && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-muted/80 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onDecision(taskId);
                }}
              >
                <Vote className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Entscheidung anfordern</TooltipContent>
          </Tooltip>
        )}

        {onDocuments && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 hover:bg-muted/80 rounded-full",
                  hasDocuments && "text-amber-600"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onDocuments(taskId);
                }}
              >
                <Paperclip className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Dokumente</TooltipContent>
          </Tooltip>
        )}

        {onAddToMeeting && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 hover:bg-muted/80 rounded-full",
                  hasMeetingLink && "text-purple-600"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToMeeting(taskId);
                }}
              >
                <CalendarDays className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Jour Fixe</TooltipContent>
          </Tooltip>
        )}


        {onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-muted/80 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(taskId);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Aufgabe bearbeiten</TooltipContent>
          </Tooltip>
        )}
        {onCreateChildTask && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-muted/80 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateChildTask(taskId);
                }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Unteraufgabe erstellen</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
