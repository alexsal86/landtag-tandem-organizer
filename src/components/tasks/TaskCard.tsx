import { useState } from "react";
import { CheckSquare, Square, Clock, Flag, Calendar, User, Edit2, MessageCircle, ChevronDown, ChevronRight, Paperclip, AlarmClock, StickyNote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Task, TaskConfiguration, User as UserType } from "@/types/taskTypes";
import { formatDate, getPriorityColor, getStatusColor, getCategoryLabel, getStatusLabel, isOverdue, parseAssignedUsers, getUserDisplayName } from "@/utils/taskUtils";

interface TaskCardProps {
  task: Task;
  taskCategories: TaskConfiguration[];
  taskStatuses: TaskConfiguration[];
  users: UserType[];
  taskDocumentCounts: { [taskId: string]: number };
  taskCommentCounts: { [taskId: string]: number };
  subtaskCounts: { [taskId: string]: number };
  taskSnoozes: { [taskId: string]: string };
  onComplete: () => void;
  onEdit: () => void;
  onShowComments: () => void;
  onShowDocuments: () => void;
  onShowSubtasks: () => void;
  onSetSnooze: () => void;
  onQuickNote: () => void;
  onSelect: () => void;
}

export function TaskCard({
  task,
  taskCategories,
  taskStatuses,
  users,
  taskDocumentCounts,
  taskCommentCounts,
  subtaskCounts,
  taskSnoozes,
  onComplete,
  onEdit,
  onShowComments,
  onShowDocuments,
  onShowSubtasks,
  onSetSnooze,
  onQuickNote,
  onSelect
}: TaskCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const assignedUsers = parseAssignedUsers(task.assignedTo);
  const isTaskOverdue = task.dueDate && isOverdue(task.dueDate);
  const documentCount = taskDocumentCounts[task.id] || 0;
  const commentCount = taskCommentCounts[task.id] || 0;
  const subtaskCount = subtaskCounts[task.id] || 0;
  const isTaskSnoozed = taskSnoozes[task.id];

  return (
    <Card className={`mb-4 ${isTaskSnoozed ? 'bg-muted/50' : ''} ${isTaskOverdue ? 'border-destructive' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Checkbox
              checked={task.status === 'completed'}
              onCheckedChange={onComplete}
            />
            <div className="flex-1">
              <CardTitle className={`text-lg ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
                <Badge variant={getStatusColor(task.status)}>
                  {getStatusLabel(task.status, taskStatuses)}
                </Badge>
                <Badge variant="outline">
                  {getCategoryLabel(task.category, taskCategories)}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {showDetails && (
        <CardContent>
          {task.description && (
            <p className="text-sm text-muted-foreground mb-4">{task.description}</p>
          )}
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            {task.dueDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className={isTaskOverdue ? 'text-destructive font-medium' : ''}>
                  {formatDate(task.dueDate)}
                </span>
              </div>
            )}
            
            {assignedUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>
                  {assignedUsers.map(userId => getUserDisplayName(userId, users)).join(', ')}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <TooltipProvider>
              {commentCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={onShowComments}>
                      <MessageCircle className="h-4 w-4" />
                      <span className="ml-1">{commentCount}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{commentCount} Kommentar(e)</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {documentCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={onShowDocuments}>
                      <Paperclip className="h-4 w-4" />
                      <span className="ml-1">{documentCount}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{documentCount} Dokument(e)</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {subtaskCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={onShowSubtasks}>
                      <CheckSquare className="h-4 w-4" />
                      <span className="ml-1">{subtaskCount}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{subtaskCount} Unteraufgabe(n)</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={onSetSnooze}>
                    <AlarmClock className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Wiedervorlage</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={onQuickNote}>
                    <StickyNote className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Schnelle Notiz</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isTaskSnoozed && (
              <Badge variant="secondary" className="ml-auto">
                <Clock className="h-3 w-3 mr-1" />
                Wiedervorlage
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}