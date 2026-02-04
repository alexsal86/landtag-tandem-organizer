import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { UserBadge } from "@/components/ui/user-badge";
import { TopicDisplay } from "@/components/topics/TopicSelector";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { 
  CheckCircle, 
  AlarmClock, 
  Edit2, 
  Calendar, 
  MoreHorizontal,
  ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ItemType = 'task' | 'subtask' | 'todo' | 'decision';
export type Priority = 'low' | 'medium' | 'high';

interface AssignedItemCardProps {
  id: string;
  type: ItemType;
  title: string;
  description?: string | null;
  priority?: Priority;
  dueDate?: string | null;
  isCompleted?: boolean;
  isSnoozed?: boolean;
  snoozeDate?: string;
  topicIds?: string[];
  creatorName?: string | null;
  creatorUserId?: string;
  creatorBadgeColor?: string | null;
  categoryLabel?: string;
  categoryColor?: string;
  parentTitle?: string;
  onClick?: () => void;
  onToggleComplete?: (completed: boolean) => void;
  onSnooze?: () => void;
  onEdit?: () => void;
  showCheckbox?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const priorityBorderColors: Record<Priority, string> = {
  high: 'border-l-destructive',
  medium: 'border-l-orange-500',
  low: 'border-l-muted-foreground/30',
};

const typeLabels: Record<ItemType, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  task: { label: 'Aufgabe', variant: 'outline' },
  subtask: { label: 'Unteraufgabe', variant: 'outline' },
  todo: { label: 'ToDo', variant: 'secondary' },
  decision: { label: 'Entscheidung', variant: 'default' },
};

const isOverdue = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  if (isNaN(date.getTime()) || date.getFullYear() <= 1970) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const formatDate = (dateString: string): string => {
  if (!dateString) return 'unbefristet';
  const date = new Date(dateString);
  if (isNaN(date.getTime()) || date.getFullYear() <= 1970) return 'unbefristet';
  return date.toLocaleDateString('de-DE');
};

export function AssignedItemCard({
  id,
  type,
  title,
  description,
  priority = 'low',
  dueDate,
  isCompleted = false,
  isSnoozed = false,
  snoozeDate,
  topicIds = [],
  creatorName,
  creatorUserId,
  creatorBadgeColor,
  categoryLabel,
  categoryColor,
  parentTitle,
  onClick,
  onToggleComplete,
  onSnooze,
  onEdit,
  showCheckbox = true,
  className,
  children,
}: AssignedItemCardProps) {
  const borderColor = priorityBorderColors[priority];
  const typeInfo = typeLabels[type];
  const overdue = dueDate ? isOverdue(dueDate) : false;

  return (
    <Card 
      className={cn(
        "border-l-4 cursor-pointer hover:bg-muted/50 transition-colors",
        borderColor,
        isSnoozed && "opacity-60",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Title & Description */}
          <div className="flex-1 min-w-0 flex items-start gap-3">
            {showCheckbox && (
              <Checkbox
                checked={isCompleted}
                onCheckedChange={(checked) => {
                  if (onToggleComplete) {
                    onToggleComplete(!!checked);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-foreground truncate">
                  {title}
                </h3>
                {isCompleted && (
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                )}
              </div>
              {parentTitle && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {type === 'subtask' ? 'Aufgabe' : 'Bezug'}: {parentTitle}
                </p>
              )}
            </div>
          </div>

          {/* Right side - Actions dropdown */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {(onSnooze || onEdit) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onSnooze && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSnooze(); }}>
                      <AlarmClock className="h-4 w-4 mr-2" />
                      Wiedervorlage
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-4 pb-3">
        <div className="grid grid-cols-[3fr_2fr] gap-4">
          {/* Left column (60%) - Description & Topics */}
          <div className="space-y-2 min-w-0">
            {description && (
              <RichTextDisplay 
                content={description} 
                className="text-sm text-muted-foreground line-clamp-2" 
              />
            )}
            {topicIds.length > 0 && (
              <TopicDisplay topicIds={topicIds} maxDisplay={3} />
            )}
            {isSnoozed && snoozeDate && (
              <Badge variant="secondary" className="text-xs">
                <AlarmClock className="h-3 w-3 mr-1" />
                Wiedervorlage: {formatDate(snoozeDate)}
              </Badge>
            )}
          </div>

          {/* Right column (40%) - Metadata & Badges */}
          <div className="flex flex-col justify-between items-end gap-2">
            {/* Top - Priority & Type badges */}
            <div className="flex flex-wrap gap-1 justify-end">
              {priority && priority !== 'low' && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    priority === 'high' && "border-destructive text-destructive",
                    priority === 'medium' && "border-orange-500 text-orange-600"
                  )}
                >
                  {priority === 'high' ? 'Hoch' : 'Mittel'}
                </Badge>
              )}
              <Badge variant={typeInfo.variant} className="text-xs">
                {categoryLabel || typeInfo.label}
              </Badge>
            </div>

            {/* Bottom - Due date & Creator */}
            <div className="flex flex-col items-end gap-1">
              {dueDate && (
                <div className={cn(
                  "flex items-center gap-1 text-xs",
                  overdue ? "text-destructive font-medium" : "text-muted-foreground"
                )}>
                  <Calendar className="h-3 w-3" />
                  {formatDate(dueDate)}
                  {overdue && " (überfällig)"}
                </div>
              )}
              {creatorUserId && (
                <UserBadge
                  userId={creatorUserId}
                  displayName={creatorName}
                  badgeColor={creatorBadgeColor}
                  size="sm"
                />
              )}
            </div>
          </div>
        </div>

        {/* Additional children content */}
        {children}
      </CardContent>
    </Card>
  );
}
