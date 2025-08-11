import { useState, useEffect } from "react";
import { Plus, CheckSquare, Square, Clock, Flag, Calendar, User, Edit2, Archive, MessageCircle, Send, Filter, Trash2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { TaskArchiveModal } from "./TaskArchiveModal";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "completed";
  dueDate: string;
  category: "legislation" | "constituency" | "committee" | "personal";
  assignedTo?: string;
  progress?: number;
}

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
  };
}

export function TasksView() {
  const [filter, setFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Task>>({});
  const [taskComments, setTaskComments] = useState<{ [taskId: string]: TaskComment[] }>({});
  const [newComment, setNewComment] = useState<{ [taskId: string]: string }>({});
  const [editingComment, setEditingComment] = useState<{ [commentId: string]: string }>({});
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<Array<{
    id: string;
    type: 'completed' | 'updated' | 'created';
    taskTitle: string;
    timestamp: string;
  }>>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load tasks from database
  useEffect(() => {
    loadTasks();
    loadRecentActivities();
  }, []);

  const loadRecentActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, updated_at, created_at')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const activities = (data || []).slice(0, 3).map(task => {
        const isRecent = new Date(task.updated_at) > new Date(task.created_at);
        const timeDiff = Date.now() - new Date(task.updated_at).getTime();
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const timeString = hoursAgo < 1 ? 'vor wenigen Minuten' : 
                          hoursAgo === 1 ? 'vor 1 Stunde' : 
                          hoursAgo < 24 ? `vor ${hoursAgo} Stunden` : 
                          `vor ${Math.floor(hoursAgo / 24)} Tagen`;

        return {
          id: task.id,
          type: task.status === 'completed' ? 'completed' as const : 
                isRecent ? 'updated' as const : 'created' as const,
          taskTitle: task.title,
          timestamp: timeString,
        };
      });

      setRecentActivities(activities);
    } catch (error) {
      console.error('Error loading recent activities:', error);
    }
  };

  const loadTasks = async () => {
    try {
      // Get completed task IDs from archive to filter them out
      const { data: archivedTasks, error: archiveError } = await supabase
        .from('archived_tasks')
        .select('task_id');

      if (archiveError) throw archiveError;

      const archivedTaskIds = (archivedTasks || []).map(at => at.task_id);

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .not('id', 'in', `(${archivedTaskIds.length > 0 ? archivedTaskIds.join(',') : 'null'})`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert database format to component format
      const formattedTasks: Task[] = (data || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority as Task['priority'],
        status: task.status as Task['status'],
        dueDate: task.due_date,
        category: task.category as Task['category'],
        assignedTo: task.assigned_to || undefined,
        progress: task.progress || undefined,
      }));

      setTasks(formattedTasks);
      
      // Load comments for all tasks automatically
      formattedTasks.forEach(task => {
        loadTaskComments(task.id);
      });
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast({
        title: "Fehler",
        description: "Aufgaben konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Migrate sample data to database (run once)
  useEffect(() => {
    const migrateSampleData = async () => {
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('id')
        .limit(1);

      // Only migrate if no tasks exist
      if (!existingTasks || existingTasks.length === 0) {
        const sampleTasks = [
          {
            title: "Stellungnahme Verkehrsgesetz",
            description: "Überarbeitung der Stellungnahme zum neuen Verkehrsgesetz bis Freitag",
            priority: "high",
            status: "in-progress",
            due_date: new Date("2024-01-15").toISOString(),
            category: "legislation",
            assigned_to: "Max Kellner",
            progress: 65,
          },
          {
            title: "Vorbereitung Ausschusssitzung",
            description: "Unterlagen für die Bildungsausschuss-Sitzung vorbereiten",
            priority: "medium",
            status: "todo",
            due_date: new Date("2024-01-12").toISOString(),
            category: "committee",
            assigned_to: "Max Kellner",
          },
          {
            title: "Bürgersprechstunde auswerten",
            description: "Anliegen aus der gestrigen Bürgersprechstunde dokumentieren",
            priority: "low",
            status: "completed",
            due_date: new Date("2024-01-10").toISOString(),
            category: "constituency",
            assigned_to: "Max Kellner",
          },
          {
            title: "Pressemitteilung Umweltpolitik",
            description: "Entwurf für Pressemitteilung zur neuen Umweltinitiative",
            priority: "medium",
            status: "todo",
            due_date: new Date("2024-01-18").toISOString(),
            category: "personal",
            assigned_to: "Max Kellner",
          },
        ];

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const tasksWithUserId = sampleTasks.map(task => ({
            ...task,
            user_id: user.id,
          }));

          await supabase.from('tasks').insert(tasksWithUserId);
          loadTasks(); // Reload tasks after migration
        }
      }
    };

    migrateSampleData();
  }, []);

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
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "in-progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "todo":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
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
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && tasks.find(t => t.dueDate === dueDate)?.status !== "completed";
  };

  const filteredTasks = tasks.filter(task => {
    // Status filter
    let statusMatch = false;
    if (filter === "all") statusMatch = true;
    else if (filter === "pending") statusMatch = task.status !== "completed";
    else if (filter === "overdue") statusMatch = isOverdue(task.dueDate);
    else statusMatch = task.status === filter;

    // Category filter
    const categoryMatch = categoryFilter === "all" || task.category === categoryFilter;
    
    // Priority filter
    const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter;

    return statusMatch && categoryMatch && priorityMatch;
  });

  const toggleTaskStatus = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const newStatus = task.status === "completed" ? "todo" : "completed";
      
      // If marking as completed, archive the task
      if (newStatus === "completed") {
        await archiveTask(task);
      } else {
        // If unmarking as completed, just update the status
        const { error } = await supabase
          .from('tasks')
          .update({ status: newStatus })
          .eq('id', taskId);

        if (error) throw error;

        // Update local state
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, status: newStatus } : t
        ));
      }

      // Refresh recent activities
      loadRecentActivities();

      toast({
        title: "Aufgabe aktualisiert",
        description: `Status auf "${newStatus === "completed" ? "Erledigt und archiviert" : "Zu erledigen"}" geändert.`,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const archiveTask = async (task: Task) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get archive settings for auto-delete duration
      const { data: archiveSettings } = await supabase
        .from('task_archive_settings')
        .select('auto_delete_after_days')
        .eq('user_id', user.id)
        .single();

      // Insert into archived_tasks
      const { error: archiveError } = await supabase
        .from('archived_tasks')
        .insert({
          task_id: task.id,
          user_id: user.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          category: task.category,
          assigned_to: task.assignedTo,
          progress: task.progress,
          due_date: task.dueDate,
          auto_delete_after_days: archiveSettings?.auto_delete_after_days,
        });

      if (archiveError) throw archiveError;

      // Update task status to completed
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', task.id);

      if (updateError) throw updateError;

      // Remove from local tasks (since it's now archived)
      setTasks(prev => prev.filter(t => t.id !== task.id));

    } catch (error) {
      console.error('Error archiving task:', error);
      throw error;
    }
  };

  const loadTaskComments = async (taskId: string) => {
    try {
      // Load comments and user profiles separately due to missing foreign key
      const { data: comments, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Load user profiles for comment authors
      const userIds = [...new Set(comments?.map(c => c.user_id) || [])];
      let profiles: any[] = [];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        
        profiles = profilesData || [];
      }

      // Combine comments with user data
      const formattedComments: TaskComment[] = (comments || []).map(comment => ({
        id: comment.id,
        task_id: comment.task_id,
        user_id: comment.user_id,
        content: comment.content,
        created_at: comment.created_at,
        profile: profiles.find(p => p.user_id === comment.user_id) || null,
      }));

      setTaskComments(prev => ({
        ...prev,
        [taskId]: formattedComments,
      }));
    } catch (error) {
      console.error('Error loading task comments:', error);
    }
  };

  const addComment = async (taskId: string) => {
    const content = newComment[taskId]?.trim();
    if (!content) return;

    try {
      if (!user) {
        toast({
          title: "Fehler",
          description: "Sie müssen angemeldet sein, um Kommentare zu schreiben.",
          variant: "destructive",
        });
        return;
      }


      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content,
        });

      if (error) {
        console.error('Supabase error:', error);
        toast({
          title: "Fehler",
          description: `Kommentar konnte nicht hinzugefügt werden: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Clear the comment input
      setNewComment(prev => ({ ...prev, [taskId]: '' }));

      // Reload comments
      loadTaskComments(taskId);

      toast({
        title: "Kommentar hinzugefügt",
        description: "Ihr Kommentar wurde erfolgreich hinzugefügt.",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const updateComment = async (commentId: string, newContent: string) => {
    if (!newContent.trim()) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .update({ content: newContent.trim() })
        .eq('id', commentId);

      if (error) throw error;

      // Update local state
      setTaskComments(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(taskId => {
          updated[taskId] = updated[taskId].map(comment =>
            comment.id === commentId ? { ...comment, content: newContent.trim() } : comment
          );
        });
        return updated;
      });

      setEditingComment(prev => {
        const updated = { ...prev };
        delete updated[commentId];
        return updated;
      });

      toast({
        title: "Kommentar aktualisiert",
        description: "Ihr Kommentar wurde erfolgreich bearbeitet.",
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht bearbeitet werden.",
        variant: "destructive",
      });
    }
  };

  const deleteComment = async (commentId: string, taskId: string) => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Update local state
      setTaskComments(prev => ({
        ...prev,
        [taskId]: prev[taskId]?.filter(comment => comment.id !== commentId) || []
      }));

      toast({
        title: "Kommentar gelöscht",
        description: "Der Kommentar wurde erfolgreich entfernt.",
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const toggleComments = (taskId: string) => {
    if (showCommentsFor === taskId) {
      setShowCommentsFor(null);
    } else {
      setShowCommentsFor(taskId);
      if (!taskComments[taskId]) {
        loadTaskComments(taskId);
      }
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      category: task.category,
      assignedTo: task.assignedTo,
      progress: task.progress,
    });
  };

  const handleSaveTask = async () => {
    if (!editingTask || !editFormData.title) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editFormData.title,
          description: editFormData.description,
          priority: editFormData.priority,
          status: editFormData.status,
          due_date: editFormData.dueDate,
          category: editFormData.category,
          assigned_to: editFormData.assignedTo,
          progress: editFormData.progress,
        })
        .eq('id', editingTask.id);

      if (error) throw error;

      // Update local state
      setTasks(prev => prev.map(t => 
        t.id === editingTask.id ? { ...t, ...editFormData } : t
      ));

      setEditingTask(null);
      setEditFormData({});

      // Refresh recent activities
      loadRecentActivities();

      toast({
        title: "Aufgabe gespeichert",
        description: "Die Aufgabe wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const taskCounts = {
    all: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    inProgress: tasks.filter(t => t.status === "in-progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
    overdue: tasks.filter(t => isOverdue(t.dueDate)).length,
  };

  const filters = [
    { value: "all", label: "Alle Aufgaben", count: taskCounts.all },
    { value: "pending", label: "Offen", count: taskCounts.todo + taskCounts.inProgress },
    { value: "todo", label: "Zu erledigen", count: taskCounts.todo },
    { value: "in-progress", label: "In Bearbeitung", count: taskCounts.inProgress },
    { value: "completed", label: "Erledigt", count: taskCounts.completed },
    { value: "overdue", label: "Überfällig", count: taskCounts.overdue },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Aufgaben</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre Aufgaben und To-Dos effizient
            </p>
          </div>
          <Button className="gap-2" onClick={() => window.location.href = '/tasks/new'}>
            <Plus className="h-4 w-4" />
            Neue Aufgabe
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto mb-4">
          {filters.map((filterOption) => (
            <Button
              key={filterOption.value}
              variant={filter === filterOption.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(filterOption.value)}
              className="whitespace-nowrap"
            >
              {filterOption.label} ({filterOption.count})
            </Button>
          ))}
        </div>

        {/* Advanced Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Zusätzliche Filter:</span>
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kategorien</SelectItem>
              <SelectItem value="legislation">Gesetzgebung</SelectItem>
              <SelectItem value="committee">Ausschuss</SelectItem>
              <SelectItem value="constituency">Wahlkreis</SelectItem>
              <SelectItem value="personal">Persönlich</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Priorität" />
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Task List */}
        <div className="lg:col-span-3 space-y-4">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={() => toggleTaskStatus(task.id)}
                    />
                  </div>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className={`font-semibold text-lg ${
                        task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
                      }`}>
                        {task.title}
                      </h3>
                      <div className="flex gap-2 ml-4">
                        <Dialog open={editingTask?.id === task.id} onOpenChange={(open) => !open && setEditingTask(null)}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditTask(task)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Aufgabe bearbeiten</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="title">Titel</Label>
                                <Input
                                  id="title"
                                  value={editFormData.title || ''}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                                />
                              </div>
                              <div>
                                <Label htmlFor="description">Beschreibung</Label>
                                <Textarea
                                  id="description"
                                  value={editFormData.description || ''}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="priority">Priorität</Label>
                                  <Select value={editFormData.priority} onValueChange={(value) => setEditFormData(prev => ({ ...prev, priority: value as Task['priority'] }))}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="low">Niedrig</SelectItem>
                                      <SelectItem value="medium">Mittel</SelectItem>
                                      <SelectItem value="high">Hoch</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="status">Status</Label>
                                  <Select value={editFormData.status} onValueChange={(value) => setEditFormData(prev => ({ ...prev, status: value as Task['status'] }))}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="todo">Zu erledigen</SelectItem>
                                      <SelectItem value="in-progress">In Bearbeitung</SelectItem>
                                      <SelectItem value="completed">Erledigt</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="category">Kategorie</Label>
                                  <Select value={editFormData.category} onValueChange={(value) => setEditFormData(prev => ({ ...prev, category: value as Task['category'] }))}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="legislation">Gesetzgebung</SelectItem>
                                      <SelectItem value="committee">Ausschuss</SelectItem>
                                      <SelectItem value="constituency">Wahlkreis</SelectItem>
                                      <SelectItem value="personal">Persönlich</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="dueDate">Fälligkeitsdatum</Label>
                                  <Input
                                    id="dueDate"
                                    type="datetime-local"
                                    value={editFormData.dueDate ? new Date(editFormData.dueDate).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, dueDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="assignedTo">Zugewiesen an</Label>
                                  <Input
                                    id="assignedTo"
                                    value={editFormData.assignedTo || ''}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="progress">Fortschritt (%)</Label>
                                  <Input
                                    id="progress"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={editFormData.progress || 0}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, progress: parseInt(e.target.value) || 0 }))}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setEditingTask(null)}>
                                  Abbrechen
                                </Button>
                                <Button onClick={handleSaveTask}>
                                  Speichern
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Badge className={getPriorityColor(task.priority)}>
                          <Flag className="h-3 w-3 mr-1" />
                          {task.priority === "high" && "Hoch"}
                          {task.priority === "medium" && "Mittel"}
                          {task.priority === "low" && "Niedrig"}
                        </Badge>
                      </div>
                    </div>

                    <p className={`mb-4 ${
                      task.status === "completed" ? "text-muted-foreground" : "text-muted-foreground"
                    }`}>
                      {task.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span className={isOverdue(task.dueDate) ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {formatDate(task.dueDate)}
                          {isOverdue(task.dueDate) && " (Überfällig)"}
                        </span>
                      </div>

                      <Badge className={getCategoryColor(task.category)}>
                        {task.category === "legislation" && "Gesetzgebung"}
                        {task.category === "committee" && "Ausschuss"}
                        {task.category === "constituency" && "Wahlkreis"}
                        {task.category === "personal" && "Persönlich"}
                      </Badge>

                      <Badge className={getStatusColor(task.status)}>
                        {task.status === "todo" && "Zu erledigen"}
                        {task.status === "in-progress" && "In Bearbeitung"}
                        {task.status === "completed" && "Erledigt"}
                      </Badge>

                      {task.assignedTo && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span className="text-muted-foreground">{task.assignedTo}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {task.progress !== undefined && task.status !== "completed" && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Fortschritt</span>
                          <span className="text-muted-foreground">{task.progress}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          ></div>
                        </div>
                       </div>
                     )}

                     {/* Comments Section */}
                     <div className="mt-4 pt-4 border-t">
                       <div className="flex items-center gap-2 mb-3">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => toggleComments(task.id)}
                           className="gap-2"
                         >
                           <MessageCircle className="h-4 w-4" />
                           Kommentare ({taskComments[task.id]?.length || 0})
                         </Button>
                       </div>

                       {showCommentsFor === task.id && (
                         <div className="space-y-3">
                           {/* Existing Comments */}
                           {taskComments[task.id]?.map((comment) => (
                             <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
                               <div className="flex items-start gap-3">
                                 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                   <User className="h-4 w-4" />
                                 </div>
                                 <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                          {comment.profile?.display_name || 'Unbekannter Nutzer'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(comment.created_at).toLocaleDateString('de-DE', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      </div>
                                      {/* Edit/Delete buttons for own comments */}
                                      {comment.user_id === user?.id && (
                                        <div className="flex gap-1">
                                          {editingComment[comment.id] !== undefined ? (
                                            <>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0"
                                                onClick={() => updateComment(comment.id, editingComment[comment.id])}
                                              >
                                                <Check className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0"
                                                onClick={() => setEditingComment(prev => {
                                                  const updated = { ...prev };
                                                  delete updated[comment.id];
                                                  return updated;
                                                })}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </>
                                          ) : (
                                            <>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0"
                                                onClick={() => setEditingComment(prev => ({
                                                  ...prev,
                                                  [comment.id]: comment.content
                                                }))}
                                              >
                                                <Edit2 className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                                onClick={() => deleteComment(comment.id, task.id)}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {editingComment[comment.id] !== undefined ? (
                                      <Input
                                        value={editingComment[comment.id]}
                                        onChange={(e) => setEditingComment(prev => ({
                                          ...prev,
                                          [comment.id]: e.target.value
                                        }))}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            updateComment(comment.id, editingComment[comment.id]);
                                          }
                                        }}
                                        className="text-sm"
                                      />
                                    ) : (
                                      <p className="text-sm">{comment.content}</p>
                                    )}
                                 </div>
                               </div>
                             </div>
                           ))}

                           {/* Add Comment */}
                           <div className="flex gap-2">
                             <Input
                               placeholder="Kommentar hinzufügen..."
                               value={newComment[task.id] || ''}
                               onChange={(e) => setNewComment(prev => ({ ...prev, [task.id]: e.target.value }))}
                               onKeyPress={(e) => {
                                 if (e.key === 'Enter' && !e.shiftKey) {
                                   e.preventDefault();
                                   addComment(task.id);
                                 }
                               }}
                             />
                             <Button
                               size="sm"
                               onClick={() => addComment(task.id)}
                               disabled={!newComment[task.id]?.trim()}
                             >
                               <Send className="h-4 w-4" />
                             </Button>
                           </div>
                         </div>
                       )}
                     </div>
                   </div>
                 </div>
               </CardContent>
             </Card>
          ))}

          {filteredTasks.length === 0 && (
            <Card className="bg-card shadow-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Aufgaben gefunden</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Es wurden keine Aufgaben gefunden, die Ihren Filterkriterien entsprechen.
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Aufgabe hinzufügen
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Archive Link */}
          <Card className="bg-card shadow-card border-border">
            <CardContent className="p-4">
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => setArchiveModalOpen(true)}
              >
                <Archive className="h-4 w-4" />
                Aufgaben-Archiv
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Übersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gesamt</span>
                  <span className="font-semibold">{taskCounts.all}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Offen</span>
                  <span className="font-semibold">{taskCounts.todo + taskCounts.inProgress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Erledigt</span>
                  <span className="font-semibold text-green-600">{taskCounts.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Überfällig</span>
                  <span className="font-semibold text-destructive">{taskCounts.overdue}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Letzte Aktivitäten</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity) => (
                    <div key={activity.id}>
                      <div className="font-medium">
                        {activity.type === 'completed' && 'Aufgabe erledigt'}
                        {activity.type === 'updated' && 'Aufgabe aktualisiert'}
                        {activity.type === 'created' && 'Aufgabe erstellt'}
                      </div>
                      <div className="text-muted-foreground">{activity.taskTitle}</div>
                      <div className="text-xs text-muted-foreground">{activity.timestamp}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">Keine Aktivitäten vorhanden</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskArchiveModal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
      />
    </div>
  );
}