import { useState, useEffect } from "react";
import { Plus, Archive, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useTasks } from "@/hooks/useTasks";
import { useTaskComments } from "@/hooks/useTaskComments";
import { useSubtasks } from "@/hooks/useSubtasks";
import { Task, User, TaskConfiguration, Todo } from "@/types/taskTypes";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TasksTable } from "@/components/tasks/TasksTable";
import { AssignedTasksWidget } from "@/components/tasks/AssignedTasksWidget";
import { TaskArchiveModal } from "./TaskArchiveModal";
import { TaskDetailSidebar } from "./TaskDetailSidebar";
import { SnoozeManagementSidebar } from "./SnoozeManagementSidebar";
import { TodoCreateDialog } from "./TodoCreateDialog";
import { filterTasksByStatus, filterTasksByCategory, filterTasksByPriority } from "@/utils/taskUtils";

export function TasksView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  // Filters
  const [filter, setFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Tasks hook
  const { tasks, loading, recentActivities, loadTasks, updateTask, deleteTask, completeTask } = useTasks();
  
  // Comments hook
  const { taskComments, addComment, loadTaskComments } = useTaskComments();
  
  // Subtasks hook
  const { assignedSubtasks, completeSubtask, completingSubtask, setCompletingSubtask, completionResult, setCompletionResult, subtaskCounts } = useSubtasks();

  // UI state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Task>>({});
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [snoozeManagementOpen, setSnoozeManagementOpen] = useState(false);
  const [todoCreateOpen, setTodoCreateOpen] = useState(false);

  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [taskCategories, setTaskCategories] = useState<TaskConfiguration[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<TaskConfiguration[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [taskDocumentCounts, setTaskDocumentCounts] = useState<{ [taskId: string]: number }>({});
  const [taskSnoozes, setTaskSnoozes] = useState<{ [taskId: string]: string }>({});
  const [subtaskSnoozes, setSubtaskSnoozes] = useState<{ [subtaskId: string]: string }>({});
  const [hideSnoozeSubtasks, setHideSnoozeSubtasks] = useState(false);

  // Load configuration data
  useEffect(() => {
    loadUsers();
    loadTaskConfiguration();
    loadTodos();
    loadTaskSnoozes();
  }, []);

  const loadUsers = async () => {
    if (!currentTenant) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTaskConfiguration = async () => {
    try {
      const [categoriesResponse, statusesResponse] = await Promise.all([
        supabase.from('task_categories').select('name, label'),
        supabase.from('task_statuses').select('name, label')
      ]);

      if (categoriesResponse.data) setTaskCategories(categoriesResponse.data);
      if (statusesResponse.data) setTaskStatuses(statusesResponse.data);
    } catch (error) {
      console.error('Error loading task configuration:', error);
    }
  };

  const loadTodos = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('todos')
        .select(`
          id,
          title,
          assigned_to,
          due_date,
          is_completed,
          todo_categories!inner(label, color)
        `)
        .eq('user_id', user.id)
        .eq('is_completed', false);

      if (error) throw error;

      const todosWithCategory = (data || []).map(todo => ({
        id: todo.id,
        title: todo.title,
        category_label: todo.todo_categories.label,
        category_color: todo.todo_categories.color,
        assigned_to: Array.isArray(todo.assigned_to) ? todo.assigned_to.join(',') : (todo.assigned_to || ''),
        due_date: todo.due_date,
        is_completed: todo.is_completed
      }));

      setTodos(todosWithCategory);
    } catch (error) {
      console.error('Error loading todos:', error);
    }
  };

  const loadTaskSnoozes = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('task_snoozes')
        .select('*')
        .eq('user_id', user.id)
        .gt('snoozed_until', new Date().toISOString());

      if (error) throw error;

      const taskSnoozeMap: { [taskId: string]: string } = {};
      const subtaskSnoozeMap: { [subtaskId: string]: string } = {};
      
      (data || []).forEach(snooze => {
        if (snooze.task_id) {
          taskSnoozeMap[snooze.task_id] = snooze.snoozed_until;
        } else if (snooze.subtask_id) {
          subtaskSnoozeMap[snooze.subtask_id] = snooze.snoozed_until;
        }
      });

      setTaskSnoozes(taskSnoozeMap);
      setSubtaskSnoozes(subtaskSnoozeMap);
    } catch (error) {
      console.error('Error loading task snoozes:', error);
    }
  };

  const toggleTodo = async (todoId: string) => {
    try {
      const todo = todos.find(t => t.id === todoId);
      if (!todo) return;

      const { error } = await supabase
        .from('todos')
        .update({ is_completed: !todo.is_completed })
        .eq('id', todoId);

      if (error) throw error;

      await loadTodos();
      
      toast({
        title: "Erfolgreich",
        description: `TODO wurde ${!todo.is_completed ? 'abgeschlossen' : 'reaktiviert'}.`,
      });
    } catch (error) {
      console.error('Error toggling todo:', error);
      toast({
        title: "Fehler",
        description: "TODO konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const handleCompleteSubtask = async (subtaskId: string, sourceType?: string) => {
    setCompletingSubtask(subtaskId);
    // For now, complete without result text - can be enhanced later
    await completeSubtask(subtaskId, '', sourceType || 'task');
  };

  const handleShowComments = (taskId: string) => {
    loadTaskComments(taskId);
    // Could open a comments modal or sidebar here
  };

  const handleShowDocuments = (taskId: string) => {
    // TODO: Implement document viewing
    console.log('Show documents for task:', taskId);
  };

  const handleShowSubtasks = (taskId: string) => {
    // TODO: Implement subtask viewing
    console.log('Show subtasks for task:', taskId);
  };

  const handleSetSnooze = (taskId: string) => {
    // TODO: Implement snooze functionality
    console.log('Set snooze for task:', taskId);
  };

  const handleQuickNote = (taskId: string) => {
    // TODO: Implement quick note functionality
    console.log('Add quick note for task:', taskId);
  };

  // Filter tasks
  const filteredTasks = filterTasksByPriority(
    filterTasksByCategory(
      filterTasksByStatus(tasks, filter),
      categoryFilter
    ),
    priorityFilter
  );

  const taskCommentCounts = Object.fromEntries(
    Object.entries(taskComments).map(([taskId, comments]) => [taskId, comments.length])
  );

  if (loading) {
    return <div className="p-6">Lade Aufgaben...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Aufgaben</h1>
        <div className="flex gap-2">
          <Button onClick={() => setTodoCreateOpen(true)}>
            <ListTodo className="h-4 w-4 mr-2" />
            TODO erstellen
          </Button>
          <Button onClick={() => setArchiveModalOpen(true)}>
            <Archive className="h-4 w-4 mr-2" />
            Archiv
          </Button>
        </div>
      </div>

      <AssignedTasksWidget
        assignedSubtasks={assignedSubtasks}
        todos={todos}
        subtaskSnoozes={subtaskSnoozes}
        hideSnoozeSubtasks={hideSnoozeSubtasks}
        onCompleteSubtask={handleCompleteSubtask}
        onToggleTodo={toggleTodo}
      />

      <TaskFilters
        filter={filter}
        setFilter={setFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
      />

      <TasksTable
        tasks={filteredTasks}
        taskCategories={taskCategories}
        taskStatuses={taskStatuses}
        users={users}
        taskDocumentCounts={taskDocumentCounts}
        taskCommentCounts={taskCommentCounts}
        subtaskCounts={subtaskCounts}
        taskSnoozes={taskSnoozes}
        onComplete={completeTask}
        onEdit={(task) => {
          setEditingTask(task);
          setEditFormData(task);
        }}
        onShowComments={handleShowComments}
        onShowDocuments={handleShowDocuments}
        onShowSubtasks={handleShowSubtasks}
        onSetSnooze={handleSetSnooze}
        onSelect={setSelectedTask}
      />

      {/* Dialogs and Modals */}
      <TaskArchiveModal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
      />

      <TodoCreateDialog
        open={todoCreateOpen}
        onOpenChange={setTodoCreateOpen}
        onTodoCreated={loadTodos}
      />

      <SnoozeManagementSidebar
        isOpen={snoozeManagementOpen}
        onClose={() => setSnoozeManagementOpen(false)}
        snoozes={[]}
        onUpdateSnooze={async () => {}}
        onDeleteSnooze={async () => {}}
        hideSnoozeSubtasks={hideSnoozeSubtasks}
        onToggleHideSnoozeSubtasks={setHideSnoozeSubtasks}
      />

      {selectedTask && (
        <TaskDetailSidebar
          task={selectedTask}
          isOpen={sidebarOpen}
          onClose={() => {
            setSidebarOpen(false);
            setSelectedTask(null);
          }}
          onTaskUpdate={loadTasks}
          onTaskRestored={loadTasks}
          taskCategories={taskCategories}
          taskStatuses={taskStatuses}
        />
      )}
    </div>
  );
}
