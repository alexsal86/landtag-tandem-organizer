import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Calendar, Flag, ExternalLink, ListTodo } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

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
}

interface Subtask {
  id: string;
  task_id: string;
  description: string | null;
  is_completed: boolean;
  due_date: string | null;
}

export function MyWorkTasksTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[]>>({});
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [assignedOpen, setAssignedOpen] = useState(true);
  const [createdOpen, setCreatedOpen] = useState(true);

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const loadTasks = async () => {
    if (!user) return;
    
    try {
      // Load tasks assigned to user
      const { data: assigned, error: assignedError } = await supabase
        .from("tasks")
        .select("*")
        .or(`assigned_to.cs.{${user.id}},assigned_to.like.%${user.id}%`)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (assignedError) throw assignedError;

      // Load tasks created by user
      const { data: created, error: createdError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (createdError) throw createdError;

      setAssignedTasks(assigned || []);
      // Filter out tasks that are also in assigned
      const assignedIds = new Set((assigned || []).map(t => t.id));
      const filteredCreated = (created || []).filter(t => !assignedIds.has(t.id));
      setCreatedTasks(filteredCreated);

      // Load subtasks for all tasks
      const allTaskIds = [...(assigned || []), ...filteredCreated].map(t => t.id);
      if (allTaskIds.length > 0) {
        const { data: subtasksData, error: subtasksError } = await supabase
          .from("subtasks")
          .select("id, task_id, description, is_completed, due_date")
          .in("task_id", allTaskIds)
          .eq("is_completed", false)
          .order("order_index", { ascending: true });

        if (subtasksError) throw subtasksError;

        // Group subtasks by task_id
        const grouped: Record<string, Subtask[]> = {};
        (subtasksData || []).forEach(st => {
          if (!grouped[st.task_id]) grouped[st.task_id] = [];
          grouped[st.task_id].push(st);
        });
        setSubtasks(grouped);
        
        // Auto-expand tasks with subtasks
        const tasksWithSubtasks = Object.keys(grouped);
        setExpandedTasks(new Set(tasksWithSubtasks));
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", taskId);

      if (error) throw error;
      toast({ title: "Aufgabe erledigt" });
      loadTasks();
    } catch (error) {
      console.error("Error completing task:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleToggleSubtaskComplete = async (subtaskId: string) => {
    try {
      const { error } = await supabase
        .from("subtasks")
        .update({ is_completed: true })
        .eq("id", subtaskId);

      if (error) throw error;
      toast({ title: "Unteraufgabe erledigt" });
      loadTasks();
    } catch (error) {
      console.error("Error completing subtask:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-500";
      case "medium": return "text-yellow-500";
      default: return "text-green-500";
    }
  };

  const getDueDateColor = (dueDate: string | null) => {
    if (!dueDate) return "text-muted-foreground";
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return "text-red-500";
    if (isToday(date)) return "text-orange-500";
    return "text-muted-foreground";
  };

  const TaskItem = ({ task }: { task: Task }) => {
    const taskSubtasks = subtasks[task.id] || [];
    const hasSubtasks = taskSubtasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <div className="rounded-lg border bg-card">
        <div className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors">
          <Checkbox
            className="mt-0.5"
            onCheckedChange={() => handleToggleComplete(task.id)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{task.title}</span>
              <Flag className={cn("h-3 w-3 flex-shrink-0", getPriorityColor(task.priority))} />
              {hasSubtasks && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTaskExpanded(task.id);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              )}
              {hasSubtasks && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  <ListTodo className="h-2.5 w-2.5 mr-1" />
                  {taskSubtasks.length}
                </Badge>
              )}
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {task.description.replace(/<[^>]*>/g, '')}
              </p>
            )}
            {task.due_date && (
              <div className={cn("flex items-center gap-1 mt-1 text-xs", getDueDateColor(task.due_date))}>
                <Calendar className="h-3 w-3" />
                {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={() => navigate("/tasks")}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
        
        {/* Subtasks */}
        {hasSubtasks && isExpanded && (
          <div className="border-t bg-muted/30 px-3 py-2 space-y-1">
            {taskSubtasks.map((subtask) => (
              <div 
                key={subtask.id} 
                className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  className="h-3 w-3"
                  onCheckedChange={() => handleToggleSubtaskComplete(subtask.id)}
                />
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  {subtask.description}
                </span>
                {subtask.due_date && (
                  <span className={cn("text-[10px]", getDueDateColor(subtask.due_date))}>
                    {format(new Date(subtask.due_date), "dd.MM.", { locale: de })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  const totalTasks = assignedTasks.length + createdTasks.length;

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-4 p-4">
        {totalTasks === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Keine offenen Aufgaben</p>
          </div>
        ) : (
          <>
            {/* Mir zugewiesen */}
            <Collapsible open={assignedOpen} onOpenChange={setAssignedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                  <div className="flex items-center gap-2">
                    {assignedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">Mir zugewiesen</span>
                  </div>
                  <Badge variant="secondary">{assignedTasks.length}</Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {assignedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2">Keine Aufgaben zugewiesen</p>
                ) : (
                  assignedTasks.map((task) => <TaskItem key={task.id} task={task} />)
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Von mir erstellt */}
            <Collapsible open={createdOpen} onOpenChange={setCreatedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                  <div className="flex items-center gap-2">
                    {createdOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">Von mir erstellt</span>
                  </div>
                  <Badge variant="secondary">{createdTasks.length}</Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {createdTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2">Keine eigenen Aufgaben</p>
                ) : (
                  createdTasks.map((task) => <TaskItem key={task.id} task={task} />)
                )}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
    </ScrollArea>
  );
}