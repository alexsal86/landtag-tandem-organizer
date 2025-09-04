import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Filter, Grid3X3, List, CheckSquare, Calendar, Clock, Flag, Tag, Archive, Edit, Trash2, ArrowUpWideNarrow, ArrowDownWideNarrow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { TaskDetailSidebar } from "./TaskDetailSidebar";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "completed";
  dueDate: string;
  category: "legislation" | "constituency" | "committee" | "personal" | "call_followup" | "call_follow_up";
  assignedTo?: string;
  progress?: number;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export function TasksView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return localStorage.getItem('tasks-view-mode') as "grid" | "list" || "grid";
  });
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "archive">("active");
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [taskCategories, setTaskCategories] = useState<Array<{ name: string; label: string }>>([]);
  const [taskStatuses, setTaskStatuses] = useState<Array<{ name: string; label: string }>>([]);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  useEffect(() => {
    if (user && currentTenant) {
      fetchTasks();
      loadTaskCategories();
      loadTaskStatuses();
    }
  }, [user, currentTenant, activeTab]);

  const loadTaskCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('task_categories')
        .select('name, label')
        .eq('is_active', true)
        .order('order_index');
      
      if (error) throw error;
      setTaskCategories(data || []);
    } catch (error) {
      console.error('Error loading task categories:', error);
    }
  };

  const loadTaskStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('task_statuses')
        .select('name, label')
        .eq('is_active', true)
        .order('order_index');
      
      if (error) throw error;
      setTaskStatuses(data || []);
    } catch (error) {
      console.error('Error loading task statuses:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('tenant_id', currentTenant?.id || '');

      // Filter by tab
      if (activeTab === "active") {
        query = query.in('status', ['todo', 'in-progress']);
      } else if (activeTab === "completed") {
        query = query.eq('status', 'completed');
      } else if (activeTab === "archive") {
        query = query.eq('status', 'archived');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const formattedTasks: Task[] = (data || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority as "low" | "medium" | "high",
        status: task.status as "todo" | "in-progress" | "completed",
        dueDate: task.due_date ? new Date(task.due_date).toLocaleDateString() : '',
        category: task.category as "legislation" | "constituency" | "committee" | "personal" | "call_followup" | "call_follow_up",
        assignedTo: task.assigned_to || '',
        progress: task.progress || 0,
        created_at: task.created_at,
        updated_at: task.updated_at,
        user_id: task.user_id
      }));

      setTasks(formattedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Fehler",
        description: "Aufgaben konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsSidebarOpen(true);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
  };

  const handleTaskRestored = (restoredTask: Task) => {
    setTasks(prev => [...prev, restoredTask]);
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || task.category === selectedCategory;
    const matchesStatus = selectedStatus === "all" || task.status === selectedStatus;
    const matchesPriority = selectedPriority === "all" || task.priority === selectedPriority;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-government-gold text-white";
      case "low":
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "todo":
        return "bg-muted text-muted-foreground";
      case "in-progress":
        return "bg-government-blue text-white";
      case "completed":
        return "bg-primary text-primary-foreground";
    }
  };

  const getCategoryColor = (category: Task["category"]) => {
    switch (category) {
      case "legislation":
        return "bg-primary text-primary-foreground";
      case "committee":
        return "bg-government-blue text-white";
      case "constituency":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "personal":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const selectedTask = selectedTaskId ? tasks.find(task => task.id === selectedTaskId) || null : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Aufgaben</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Aufgaben und Projekte
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/tasks/new">
            <Plus className="h-4 w-4" />
            Neue Aufgabe
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "active" 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Aktiv ({tasks.filter(t => ['todo', 'in-progress'].includes(t.status)).length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "completed" 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Abgeschlossen ({tasks.filter(t => t.status === 'completed').length})
        </button>
      </div>

      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Aufgaben durchsuchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newMode = viewMode === "grid" ? "list" : "grid";
              setViewMode(newMode);
              localStorage.setItem('tasks-view-mode', newMode);
            }}
            className="gap-2"
          >
            {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
            {viewMode === "grid" ? "Liste" : "Karten"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Kategorie</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {taskCategories.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="todo">Zu erledigen</SelectItem>
                  <SelectItem value="in-progress">In Bearbeitung</SelectItem>
                  <SelectItem value="completed">Abgeschlossen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Priorität</label>
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Prioritäten</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="low">Niedrig</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Content */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className="cursor-pointer hover:shadow-lg transition-shadow bg-card shadow-card border-border"
              onClick={() => handleTaskClick(task.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-semibold line-clamp-2">
                    {task.title}
                  </CardTitle>
                  <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                    {task.priority === "high" ? "Hoch" : task.priority === "medium" ? "Mittel" : "Niedrig"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {task.description || "Keine Beschreibung verfügbar"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className={getStatusColor(task.status)}>
                    {task.status === "todo" ? "Zu erledigen" : 
                     task.status === "in-progress" ? "In Bearbeitung" : "Abgeschlossen"}
                  </Badge>
                  <Badge variant="outline" className={getCategoryColor(task.category)}>
                    {taskCategories.find(c => c.name === task.category)?.label || task.category}
                  </Badge>
                </div>
                {task.dueDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Fällig: {task.dueDate}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-2">
                    Titel
                    {sortColumn === 'title' && (
                      sortDirection === 'asc' ? 
                      <ArrowUpWideNarrow className="h-4 w-4" /> : 
                      <ArrowDownWideNarrow className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Fälligkeitsdatum</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id} className="cursor-pointer" onClick={() => handleTaskClick(task.id)}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {task.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                      {task.priority === "high" ? "Hoch" : task.priority === "medium" ? "Mittel" : "Niedrig"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status === "todo" ? "Zu erledigen" : 
                       task.status === "in-progress" ? "In Bearbeitung" : "Abgeschlossen"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getCategoryColor(task.category)}>
                      {taskCategories.find(c => c.name === task.category)?.label || task.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.dueDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        {task.dueDate}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTaskClick(task.id);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Empty State */}
      {filteredTasks.length === 0 && !loading && (
        <Card className="p-12 text-center">
          <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {activeTab === "active" ? "Keine aktiven Aufgaben" :
             activeTab === "completed" ? "Keine abgeschlossenen Aufgaben" : "Keine archivierten Aufgaben"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {activeTab === "active" ? "Sie haben keine offenen Aufgaben. Erstellen Sie eine neue Aufgabe, um zu beginnen." :
             "Keine Aufgaben in dieser Kategorie gefunden."}
          </p>
          {activeTab === "active" && (
            <Button asChild>
              <Link to="/tasks/new" className="gap-2">
                <Plus className="h-4 w-4" />
                Erste Aufgabe erstellen
              </Link>
            </Button>
          )}
        </Card>
      )}

      {/* Task Detail Sidebar */}
      <TaskDetailSidebar
        task={selectedTask}
        isOpen={isSidebarOpen}
        onClose={() => {
          setIsSidebarOpen(false);
          setSelectedTaskId(null);
        }}
        onTaskUpdate={handleTaskUpdate}
        onTaskRestored={handleTaskRestored}
        taskCategories={taskCategories}
        taskStatuses={taskStatuses}
      />
    </div>
  );
}