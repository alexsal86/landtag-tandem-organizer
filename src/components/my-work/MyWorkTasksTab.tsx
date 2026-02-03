import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useViewPreference, ViewType } from "@/hooks/useViewPreference";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskListRow } from "@/components/tasks/TaskListRow";

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

export function MyWorkTasksTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewType, setViewType } = useViewPreference({ key: "mywork-tasks", defaultView: "card" });
  
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[]>>({});
  const [loading, setLoading] = useState(true);

  // Handle action parameter from URL
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-task') {
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      navigate('/tasks?action=create');
    }
  }, [searchParams, setSearchParams, navigate]);

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
        .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%`)
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

      const allAssigned = assigned || [];
      const allCreated = created || [];
      
      // Filter: created = tasks user created but are NOT assigned to them
      const assignedIds = new Set(allAssigned.map(t => t.id));
      const filteredCreated = allCreated.filter(t => !assignedIds.has(t.id));
      
      setAssignedTasks(allAssigned);
      setCreatedTasks(filteredCreated);

      // Load subtasks for all tasks
      const allTaskIds = [...allAssigned, ...filteredCreated].map(t => t.id);
      if (allTaskIds.length > 0) {
        const { data: subtasksData, error: subtasksError } = await supabase
          .from("subtasks")
          .select("id, task_id, description, is_completed, due_date")
          .in("task_id", allTaskIds)
          .eq("is_completed", false)
          .order("order_index", { ascending: true });

        if (subtasksError) throw subtasksError;

        const grouped: Record<string, Subtask[]> = {};
        (subtasksData || []).forEach(st => {
          if (!grouped[st.task_id]) grouped[st.task_id] = [];
          grouped[st.task_id].push(st);
        });
        setSubtasks(grouped);
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (taskId: string) => {
    const task = [...assignedTasks, ...createdTasks].find(t => t.id === taskId);
    if (!task || !user) return;
    
    try {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ status: "completed", progress: 100 })
        .eq("id", taskId)
        .select();

      if (updateError) throw updateError;

      await supabase
        .from('archived_tasks')
        .insert({
          task_id: taskId,
          user_id: user.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          category: 'personal',
          assigned_to: task.assigned_to || '',
          progress: 100,
          due_date: task.due_date,
          completed_at: new Date().toISOString(),
          auto_delete_after_days: null,
        });

      await supabase.from('tasks').delete().eq('id', taskId);
      
      setAssignedTasks(prev => prev.filter(t => t.id !== taskId));
      setCreatedTasks(prev => prev.filter(t => t.id !== taskId));
      
      toast({ title: "Aufgabe erledigt und archiviert" });
    } catch (error: any) {
      console.error("Error completing task:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleToggleSubtaskComplete = async (subtaskId: string) => {
    try {
      const { error } = await supabase
        .from("subtasks")
        .update({ is_completed: true })
        .eq("id", subtaskId)
        .select();

      if (error) throw error;
      toast({ title: "Unteraufgabe erledigt" });
      loadTasks();
    } catch (error) {
      console.error("Error completing subtask:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleUpdateTitle = async (taskId: string, title: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ title })
        .eq("id", taskId)
        .select();

      if (error) throw error;
      
      setAssignedTasks(prev => prev.map(t => t.id === taskId ? { ...t, title } : t));
      setCreatedTasks(prev => prev.map(t => t.id === taskId ? { ...t, title } : t));
      toast({ title: "Titel aktualisiert" });
    } catch (error) {
      console.error("Error updating title:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  const handleUpdateDescription = async (taskId: string, description: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ description })
        .eq("id", taskId)
        .select();

      if (error) throw error;
      
      setAssignedTasks(prev => prev.map(t => t.id === taskId ? { ...t, description } : t));
      setCreatedTasks(prev => prev.map(t => t.id === taskId ? { ...t, description } : t));
      toast({ title: "Beschreibung aktualisiert" });
    } catch (error) {
      console.error("Error updating description:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  // Placeholder action handlers
  const handleReminder = (taskId: string) => {
    toast({ title: "Wiedervorlage", description: "Funktion kommt bald" });
  };

  const handleAssign = (taskId: string) => {
    navigate(`/tasks?id=${taskId}&action=assign`);
  };

  const handleComment = (taskId: string) => {
    navigate(`/tasks?id=${taskId}&tab=comments`);
  };

  const handleDecision = (taskId: string) => {
    toast({ title: "Entscheidung anfordern", description: "Funktion kommt bald" });
  };

  const handleDocuments = (taskId: string) => {
    navigate(`/tasks?id=${taskId}&tab=documents`);
  };

  const renderTaskList = (tasks: Task[], title: string, emptyMessage: string) => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm">{title}</h3>
            <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2 py-4">{emptyMessage}</p>
          ) : viewType === "card" ? (
            <div className="space-y-2 pr-2">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  subtasks={subtasks[task.id]}
                  onComplete={handleToggleComplete}
                  onSubtaskComplete={handleToggleSubtaskComplete}
                  onNavigate={(id) => navigate(`/tasks?id=${id}`)}
                  onUpdateTitle={handleUpdateTitle}
                  onUpdateDescription={handleUpdateDescription}
                  onReminder={handleReminder}
                  onAssign={handleAssign}
                  onComment={handleComment}
                  onDecision={handleDecision}
                  onDocuments={handleDocuments}
                />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {tasks.map((task) => (
                <TaskListRow
                  key={task.id}
                  task={task}
                  subtasks={subtasks[task.id]}
                  onComplete={handleToggleComplete}
                  onSubtaskComplete={handleToggleSubtaskComplete}
                  onNavigate={(id) => navigate(`/tasks?id=${id}`)}
                  onUpdateTitle={handleUpdateTitle}
                  onReminder={handleReminder}
                  onAssign={handleAssign}
                  onComment={handleComment}
                  onDecision={handleDecision}
                  onDocuments={handleDocuments}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const totalTasks = assignedTasks.length + createdTasks.length;

  return (
    <div className="h-[calc(100vh-20rem)] flex flex-col">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Aufgaben</span>
          <Badge variant="outline">{totalTasks}</Badge>
        </div>
        <ToggleGroup 
          type="single" 
          value={viewType} 
          onValueChange={(value) => value && setViewType(value as ViewType)}
          className="bg-muted rounded-md p-0.5"
        >
          <ToggleGroupItem value="card" aria-label="Kartenansicht" className="h-7 w-7 p-0">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Listenansicht" className="h-7 w-7 p-0">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Main content - 50/50 split */}
      {totalTasks === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Keine offenen Aufgaben</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-0">
          {renderTaskList(assignedTasks, "Mir zugewiesen", "Keine Aufgaben zugewiesen")}
          {renderTaskList(createdTasks, "Von mir erstellt", "Keine eigenen Aufgaben")}
        </div>
      )}
    </div>
  );
}
