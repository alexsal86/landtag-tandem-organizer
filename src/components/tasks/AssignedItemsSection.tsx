import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TopicDisplay } from "@/components/topics/TopicSelector";
import { UserBadge } from "@/components/ui/user-badge";
import { 
  ListTodo, 
  AlarmClock, 
  Edit2, 
  Calendar, 
  MoreHorizontal,
  ChevronRight,
  CheckCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "completed";
  dueDate: string;
  category: string;
  assignedTo?: string;
  user_id?: string;
  task_id?: string;
}

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  assigned_to?: string[];
  assigned_to_names?: string;
  due_date?: string;
  priority?: string;
  task_title?: string;
}

interface Todo {
  id: string;
  title: string;
  category_label: string;
  category_color: string;
  assigned_to: string | null;
  due_date: string | null;
  is_completed: boolean;
}

interface AssignedItemsSectionProps {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    status: "todo" | "in-progress" | "completed";
    dueDate: string;
    category: string;
    assignedTo?: string;
    user_id?: string;
  }>;
  subtasks: Subtask[];
  todos: Todo[];
  taskSnoozes: { [taskId: string]: string };
  subtaskSnoozes: { [subtaskId: string]: string };
  hideSnoozeSubtasks: boolean;
  onToggleHideSnoozeSubtasks: (hide: boolean) => void;
  onTaskToggleComplete: (taskId: string) => void;
  onSubtaskToggleComplete: (subtaskId: string, completed: boolean, resultText?: string) => void;
  onTodoToggleComplete: (todoId: string, completed: boolean) => void;
  onTaskSnooze: (taskId: string) => void;
  onSubtaskSnooze: (subtaskId: string) => void;
  onTaskEdit: (task: any) => void;
  onSubtaskEdit: (subtask: Subtask) => void;
  resolveUserNames: (assignedTo?: string[]) => string;
  children?: React.ReactNode;
}

const priorityBorderColors: Record<string, string> = {
  high: 'border-l-destructive',
  medium: 'border-l-orange-500',
  low: 'border-l-muted-foreground/30',
};

const isOverdue = (dateString?: string | null): boolean => {
  if (!dateString || dateString === '1970-01-01T00:00:00.000Z' || dateString === '1970-01-01') {
    return false;
  }
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString || dateString === '1970-01-01T00:00:00.000Z' || dateString === '1970-01-01') {
    return 'unbefristet';
  }
  return new Date(dateString).toLocaleDateString('de-DE');
};

// Component for individual item card
function ItemCard({ 
  type,
  title,
  description,
  priority,
  dueDate,
  isCompleted,
  isSnoozed,
  snoozeDate,
  topicIds,
  categoryLabel,
  parentTitle,
  assignedToNames,
  onToggleComplete,
  onSnooze,
  onEdit,
}: {
  type: 'task' | 'subtask' | 'todo';
  title: string;
  description?: string | null;
  priority?: string;
  dueDate?: string | null;
  isCompleted?: boolean;
  isSnoozed?: boolean;
  snoozeDate?: string;
  topicIds?: string[];
  categoryLabel?: string;
  parentTitle?: string;
  assignedToNames?: string;
  onToggleComplete?: (completed: boolean) => void;
  onSnooze?: () => void;
  onEdit?: () => void;
}) {
  const borderColor = priorityBorderColors[priority || 'low'] || priorityBorderColors.low;
  const overdue = isOverdue(dueDate);

  const typeLabels: Record<string, { label: string; className: string }> = {
    task: { label: 'Aufgabe', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
    subtask: { label: 'Unteraufgabe', className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800' },
    todo: { label: 'ToDo', className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  };

  const typeInfo = typeLabels[type];

  return (
    <Card 
      className={cn(
        "border-l-4 hover:bg-muted/50 transition-colors",
        borderColor,
        isSnoozed && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[3fr_2fr] gap-4">
          {/* Left column (60%) - Checkbox, Title, Description, Topics */}
          <div className="flex items-start gap-3 min-w-0">
            <Checkbox
              checked={isCompleted}
              onCheckedChange={(checked) => onToggleComplete?.(!!checked)}
              className="mt-1 flex-shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-foreground">
                  {title}
                </h3>
                {isCompleted && (
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                )}
              </div>
              {parentTitle && (
                <p className="text-xs text-muted-foreground">
                  Aufgabe: {parentTitle}
                </p>
              )}
              {description && (
                <RichTextDisplay 
                  content={description} 
                  className="text-sm text-muted-foreground line-clamp-2" 
                />
              )}
              {assignedToNames && (
                <p className="text-xs text-muted-foreground">
                  Zuständig: {assignedToNames}
                </p>
              )}
              {topicIds && topicIds.length > 0 && (
                <TopicDisplay topicIds={topicIds} maxDisplay={3} />
              )}
              {isSnoozed && snoozeDate && (
                <Badge variant="secondary" className="text-xs">
                  <AlarmClock className="h-3 w-3 mr-1" />
                  Wiedervorlage: {formatDate(snoozeDate)}
                </Badge>
              )}
            </div>
          </div>

          {/* Right column (40%) - Metadata & Actions */}
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
              <Badge variant="outline" className={cn("text-xs", typeInfo.className)}>
                {categoryLabel || typeInfo.label}
              </Badge>
            </div>

            {/* Middle - Due date */}
            <div className="flex flex-col items-end gap-1">
              <div className={cn(
                "flex items-center gap-1 text-xs",
                overdue ? "text-destructive font-medium" : "text-muted-foreground"
              )}>
                <Calendar className="h-3 w-3" />
                {formatDate(dueDate)}
                {overdue && " (überfällig)"}
              </div>
            </div>

            {/* Bottom - Actions */}
            <div className="flex items-center gap-1">
              {onSnooze && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onSnooze(); }}
                  className="h-8 w-8 p-0"
                  title="Wiedervorlage"
                >
                  <AlarmClock className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="h-8 w-8 p-0"
                  title="Bearbeiten"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssignedItemsSection({
  tasks,
  subtasks,
  todos,
  taskSnoozes,
  subtaskSnoozes,
  hideSnoozeSubtasks,
  onToggleHideSnoozeSubtasks,
  onTaskToggleComplete,
  onSubtaskToggleComplete,
  onTodoToggleComplete,
  onTaskSnooze,
  onSubtaskSnooze,
  onTaskEdit,
  onSubtaskEdit,
  resolveUserNames,
  children,
}: AssignedItemsSectionProps) {
  // Load task topics for all tasks
  const [taskTopics, setTaskTopics] = useState<{ [taskId: string]: string[] }>({});

  useEffect(() => {
    const loadAllTaskTopics = async () => {
      const taskIds = tasks.map(t => t.id);
      if (taskIds.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('task_topics')
          .select('task_id, topic_id')
          .in('task_id', taskIds);

        if (error) throw error;

        const topicsMap: { [taskId: string]: string[] } = {};
        data?.forEach(item => {
          if (!topicsMap[item.task_id]) {
            topicsMap[item.task_id] = [];
          }
          topicsMap[item.task_id].push(item.topic_id);
        });
        setTaskTopics(topicsMap);
      } catch (error) {
        console.error('Error loading task topics:', error);
      }
    };

    loadAllTaskTopics();
  }, [tasks]);

  // Filter snoozed items
  const filteredTasks = tasks.filter(task => {
    return !taskSnoozes[task.id] || new Date(taskSnoozes[task.id]) <= new Date();
  });

  const filteredSubtasks = subtasks.filter(subtask => {
    if (hideSnoozeSubtasks) {
      const isSnoozed = subtaskSnoozes[subtask.id] && new Date(subtaskSnoozes[subtask.id]) > new Date();
      if (isSnoozed) return false;
    }
    return true;
  });

  const totalCount = tasks.length + subtasks.length + todos.length;
  const visibleCount = filteredTasks.length + filteredSubtasks.length + todos.length;
  const hasHiddenItems = totalCount !== visibleCount;

  if (totalCount === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Mir zugewiesene Aufgaben & Unteraufgaben ({totalCount})
            {hasHiddenItems && (
              <span className="text-sm text-muted-foreground font-normal">
                ({visibleCount} sichtbar)
              </span>
            )}
          </CardTitle>
          {subtasks.length !== filteredSubtasks.length && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleHideSnoozeSubtasks(!hideSnoozeSubtasks)}
              className="h-8 px-3 text-xs"
            >
              {hideSnoozeSubtasks ? 'Alle anzeigen' : 'Wiedervorlagen ausblenden'}
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          Aufgaben: {tasks.length} | Unteraufgaben: {subtasks.length} (sichtbar: {filteredSubtasks.length}) | ToDos: {todos.length}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Decision requests passed as children */}
        {children}
        
        {/* Tasks */}
        {filteredTasks.map((task) => {
          const isSnoozed = taskSnoozes[task.id] && new Date(taskSnoozes[task.id]) > new Date();
          return (
            <ItemCard
              key={`task-${task.id}`}
              type="task"
              title={task.title}
              description={task.description}
              priority={task.priority}
              dueDate={task.dueDate}
              isCompleted={task.status === "completed"}
              isSnoozed={isSnoozed}
              snoozeDate={isSnoozed ? taskSnoozes[task.id] : undefined}
              topicIds={taskTopics[task.id] || []}
              onToggleComplete={() => onTaskToggleComplete(task.id)}
              onSnooze={() => onTaskSnooze(task.id)}
              onEdit={() => onTaskEdit(task)}
            />
          );
        })}

        {/* Subtasks */}
        {filteredSubtasks.map((subtask) => {
          const isSnoozed = subtaskSnoozes[subtask.id] && new Date(subtaskSnoozes[subtask.id]) > new Date();
          return (
            <ItemCard
              key={`subtask-${subtask.id}`}
              type="subtask"
              title={subtask.title || subtask.description || ''}
              description={subtask.title ? subtask.description : undefined}
              priority={subtask.priority}
              dueDate={subtask.due_date}
              isCompleted={subtask.is_completed}
              isSnoozed={isSnoozed}
              snoozeDate={isSnoozed ? subtaskSnoozes[subtask.id] : undefined}
              parentTitle={subtask.task_title}
              assignedToNames={subtask.assigned_to_names || resolveUserNames(subtask.assigned_to)}
              onToggleComplete={(checked) => {
                if (checked) {
                  // For now, complete without result text - the parent handles the dialog
                  onSubtaskToggleComplete(subtask.id, true);
                } else {
                  onSubtaskToggleComplete(subtask.id, false);
                }
              }}
              onSnooze={() => onSubtaskSnooze(subtask.id)}
              onEdit={() => onSubtaskEdit(subtask)}
            />
          );
        })}

        {/* Todos */}
        {todos.map((todo) => (
          <ItemCard
            key={`todo-${todo.id}`}
            type="todo"
            title={todo.title}
            categoryLabel={todo.category_label}
            dueDate={todo.due_date}
            isCompleted={todo.is_completed}
            onToggleComplete={(checked) => onTodoToggleComplete(todo.id, checked)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
