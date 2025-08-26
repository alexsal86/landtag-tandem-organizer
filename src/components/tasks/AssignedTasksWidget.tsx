import { CheckSquare, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AssignedSubtask, Todo } from "@/types/taskTypes";
import { formatDate } from "@/utils/taskUtils";

interface AssignedTasksWidgetProps {
  assignedSubtasks: AssignedSubtask[];
  todos: Todo[];
  subtaskSnoozes: { [subtaskId: string]: string };
  hideSnoozeSubtasks: boolean;
  onCompleteSubtask: (subtaskId: string, sourceType?: string) => void;
  onToggleTodo: (todoId: string) => void;
}

export function AssignedTasksWidget({
  assignedSubtasks,
  todos,
  subtaskSnoozes,
  hideSnoozeSubtasks,
  onCompleteSubtask,
  onToggleTodo
}: AssignedTasksWidgetProps) {
  const filteredSubtasks = hideSnoozeSubtasks 
    ? assignedSubtasks.filter(subtask => !subtaskSnoozes[subtask.id])
    : assignedSubtasks;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Assigned Subtasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Zugewiesene Unteraufgaben ({filteredSubtasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-80 overflow-y-auto">
          {filteredSubtasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">Keine zugewiesenen Unteraufgaben</p>
          ) : (
            <div className="space-y-3">
              {filteredSubtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg ${
                    subtaskSnoozes[subtask.id] ? 'bg-muted/50' : ''
                  }`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCompleteSubtask(subtask.id, subtask.source_type)}
                    className="p-1 h-auto"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{subtask.task_title}</p>
                    <p className="text-sm text-muted-foreground">{subtask.title}</p>
                    
                    {subtask.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {subtask.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2">
                      {subtask.due_date && (
                        <Badge variant="outline" className="text-xs">
                          {formatDate(subtask.due_date)}
                        </Badge>
                      )}
                      
                      {subtask.priority && (
                        <Badge variant="secondary" className="text-xs">
                          {subtask.priority}
                        </Badge>
                      )}
                      
                      {subtaskSnoozes[subtask.id] && (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Wiedervorlage
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* TODOs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            TODOs ({todos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-80 overflow-y-auto">
          {todos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Keine offenen TODOs</p>
          ) : (
            <div className="space-y-3">
              {todos.map((todo) => (
                <div key={todo.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={todo.is_completed}
                    onCheckedChange={() => onToggleTodo(todo.id)}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${todo.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                      {todo.title}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{ backgroundColor: todo.category_color }}
                      >
                        {todo.category_label}
                      </Badge>
                      
                      {todo.due_date && (
                        <Badge variant="outline" className="text-xs">
                          {formatDate(todo.due_date)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}