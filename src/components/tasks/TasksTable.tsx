import { CheckSquare, Square, Calendar, User, Edit2, MessageCircle, Paperclip, AlarmClock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Task, TaskConfiguration, User as UserType } from "@/types/taskTypes";
import { formatDate, getPriorityColor, getStatusColor, getCategoryLabel, getStatusLabel, isOverdue, parseAssignedUsers, getUserDisplayName } from "@/utils/taskUtils";

interface TasksTableProps {
  tasks: Task[];
  taskCategories: TaskConfiguration[];
  taskStatuses: TaskConfiguration[];
  users: UserType[];
  taskDocumentCounts: { [taskId: string]: number };
  taskCommentCounts: { [taskId: string]: number };
  subtaskCounts: { [taskId: string]: number };
  taskSnoozes: { [taskId: string]: string };
  onComplete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onShowComments: (taskId: string) => void;
  onShowDocuments: (taskId: string) => void;
  onShowSubtasks: (taskId: string) => void;
  onSetSnooze: (taskId: string) => void;
  onSelect: (task: Task) => void;
}

export function TasksTable({
  tasks,
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
  onSelect
}: TasksTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Status</TableHead>
            <TableHead>Titel</TableHead>
            <TableHead>Priorität</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead>Zugewiesen an</TableHead>
            <TableHead>Fälligkeitsdatum</TableHead>
            <TableHead>Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const assignedUsers = parseAssignedUsers(task.assignedTo);
            const isTaskOverdue = task.dueDate && isOverdue(task.dueDate);
            const documentCount = taskDocumentCounts[task.id] || 0;
            const commentCount = taskCommentCounts[task.id] || 0;
            const subtaskCount = subtaskCounts[task.id] || 0;
            const isTaskSnoozed = taskSnoozes[task.id];

            return (
              <TableRow 
                key={task.id} 
                className={`cursor-pointer hover:bg-muted/50 ${isTaskSnoozed ? 'bg-muted/30' : ''}`}
                onClick={() => onSelect(task)}
              >
                <TableCell>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={task.status === 'completed'}
                      onCheckedChange={() => onComplete(task.id)}
                    />
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="space-y-1">
                    <p className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge variant={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <Badge variant="outline">
                    {getCategoryLabel(task.category, taskCategories)}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  {assignedUsers.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {assignedUsers.slice(0, 2).map(userId => (
                        <Badge key={userId} variant="secondary" className="text-xs">
                          {getUserDisplayName(userId, users)}
                        </Badge>
                      ))}
                      {assignedUsers.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{assignedUsers.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Nicht zugewiesen</span>
                  )}
                </TableCell>
                
                <TableCell>
                  {task.dueDate && (
                    <div className={`flex items-center gap-2 ${isTaskOverdue ? 'text-destructive' : ''}`}>
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">
                        {formatDate(task.dueDate)}
                      </span>
                    </div>
                  )}
                </TableCell>
                
                <TableCell>
                  <TooltipProvider>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(task);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bearbeiten</p>
                        </TooltipContent>
                      </Tooltip>

                      {commentCount > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowComments(task.id);
                              }}
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span className="ml-1 text-xs">{commentCount}</span>
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
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowDocuments(task.id);
                              }}
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="ml-1 text-xs">{documentCount}</span>
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
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowSubtasks(task.id);
                              }}
                            >
                              <CheckSquare className="h-4 w-4" />
                              <span className="ml-1 text-xs">{subtaskCount}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{subtaskCount} Unteraufgabe(n)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetSnooze(task.id);
                            }}
                          >
                            <AlarmClock className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Wiedervorlage</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}