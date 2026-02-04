import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlarmClock, UserPlus, MessageSquare, Vote, Paperclip, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskActionIconsProps {
  taskId: string;
  onReminder?: (taskId: string) => void;
  onAssign?: (taskId: string) => void;
  onComment?: (taskId: string) => void;
  onDecision?: (taskId: string) => void;
  onDocuments?: (taskId: string) => void;
  onAddToMeeting?: (taskId: string) => void;
  hasComments?: boolean;
  hasDocuments?: boolean;
  hasMeetingLink?: boolean;
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
  hasComments = false,
  hasDocuments = false,
  hasMeetingLink = false,
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
                className="h-6 w-6 hover:bg-muted/80 rounded-full"
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
                className="h-6 w-6 hover:bg-muted/80 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onAssign(taskId);
                }}
              >
                <UserPlus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Zuweisen</TooltipContent>
          </Tooltip>
        )}

        {onComment && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 hover:bg-muted/80 rounded-full",
                  hasComments && "text-blue-600"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onComment(taskId);
                }}
              >
                <MessageSquare className="h-3 w-3" />
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
      </div>
    </TooltipProvider>
  );
}
