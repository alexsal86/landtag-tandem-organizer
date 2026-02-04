import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { LayoutGrid, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useViewPreference, ViewType } from "@/hooks/useViewPreference";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskListRow } from "@/components/tasks/TaskListRow";
import { TaskDecisionCreator } from "@/components/task-decisions/TaskDecisionCreator";
import { TaskCommentSidebar } from "@/components/tasks/TaskCommentSidebar";
import { TaskDocumentDialog } from "@/components/tasks/TaskDocumentDialog";
import { TaskMeetingSelector } from "@/components/tasks/TaskMeetingSelector";
import { UnicornAnimation } from "@/components/UnicornAnimation";

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

interface Profile {
  user_id: string;
  display_name: string | null;
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

  // Dialog states
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [snoozeTaskId, setSnoozeTaskId] = useState<string | null>(null);
  
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(false);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  
  const [decisionTaskId, setDecisionTaskId] = useState<string | null>(null);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [documentTaskId, setDocumentTaskId] = useState<string | null>(null);
  
  // Meeting selector states
  const [meetingSelectorOpen, setMeetingSelectorOpen] = useState(false);
  const [meetingTaskId, setMeetingTaskId] = useState<string | null>(null);
  
  // Unicorn animation state
  const [showUnicorn, setShowUnicorn] = useState(false);

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
      loadProfiles();
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

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
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
      
      setShowUnicorn(true);
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
      setShowUnicorn(true);
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

  const handleUpdateDueDate = async (taskId: string, date: Date | null) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: date?.toISOString() || null })
        .eq("id", taskId)
        .select();

      if (error) throw error;
      
      const newDueDate = date?.toISOString() || null;
      setAssignedTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: newDueDate } : t));
      setCreatedTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: newDueDate } : t));
      toast({ title: "Frist aktualisiert" });
    } catch (error) {
      console.error("Error updating due date:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  // Action handlers - open dialogs instead of navigating
  const handleReminder = (taskId: string) => {
    setSnoozeTaskId(taskId);
    setSnoozeDialogOpen(true);
  };

  const handleSetSnooze = async (date: Date) => {
    if (!snoozeTaskId || !user) return;
    
    try {
      // Check if there's already a snooze for this task
      const { data: existingSnooze } = await supabase
        .from('task_snoozes')
        .select('id')
        .eq('task_id', snoozeTaskId)
        .eq('user_id', user.id)
        .single();

      if (existingSnooze) {
        // Update existing snooze
        const { error } = await supabase
          .from('task_snoozes')
          .update({ snoozed_until: date.toISOString() })
          .eq('id', existingSnooze.id);
        if (error) throw error;
      } else {
        // Create new snooze
        const { error } = await supabase
          .from('task_snoozes')
          .insert({
            user_id: user.id,
            task_id: snoozeTaskId,
            snoozed_until: date.toISOString()
          });
        if (error) throw error;
      }
      
      toast({ title: "Wiedervorlage gesetzt" });
      setSnoozeDialogOpen(false);
      setSnoozeTaskId(null);
    } catch (error) {
      console.error("Error setting snooze:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleAssign = (taskId: string) => {
    setAssignTaskId(taskId);
    setAssignDialogOpen(true);
  };

  const handleUpdateAssignee = async (userId: string) => {
    if (!assignTaskId) return;
    
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_to: userId || null })
        .eq("id", assignTaskId)
        .select();

      if (error) throw error;
      
      setAssignedTasks(prev => prev.map(t => 
        t.id === assignTaskId ? { ...t, assigned_to: userId || null } : t
      ));
      setCreatedTasks(prev => prev.map(t => 
        t.id === assignTaskId ? { ...t, assigned_to: userId || null } : t
      ));
      
      toast({ title: "Zuweisung aktualisiert" });
      setAssignDialogOpen(false);
      setAssignTaskId(null);
      loadTasks(); // Reload to update lists
    } catch (error) {
      console.error("Error updating assignee:", error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleComment = (taskId: string) => {
    setCommentTaskId(taskId);
    setCommentSidebarOpen(true);
  };

  const handleDecision = (taskId: string) => {
    setDecisionTaskId(taskId);
    setDecisionDialogOpen(true);
  };

  const handleDocuments = (taskId: string) => {
    setDocumentTaskId(taskId);
    setDocumentDialogOpen(true);
  };

  const handleAddToMeeting = (taskId: string) => {
    setMeetingTaskId(taskId);
    setMeetingSelectorOpen(true);
  };

  const handleSelectMeeting = async (meetingId: string, meetingTitle: string) => {
    if (!meetingTaskId || !user) return;
    
    try {
      console.log('Adding task to meeting:', { taskId: meetingTaskId, meetingId });
      
      const { data, error } = await supabase
        .from('tasks')
        .update({ meeting_id: meetingId, pending_for_jour_fixe: false })
        .eq('id', meetingTaskId)
        .select();

      if (error) {
        console.error('Error adding task to meeting:', error);
        toast({ 
          title: "Fehler", 
          description: error.message || "Aufgabe konnte nicht zugeordnet werden.",
          variant: "destructive" 
        });
        return;
      }
      
      if (!data || data.length === 0) {
        toast({ 
          title: "Warnung", 
          description: "Keine Aufgabe aktualisiert.",
          variant: "destructive" 
        });
        return;
      }
      
      toast({ title: `Aufgabe zu "${meetingTitle}" hinzugefügt` });
      loadTasks();
    } catch (error: any) {
      console.error('Error adding task to meeting:', error);
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setMeetingTaskId(null);
    }
  };

  const handleMarkForNextJourFixe = async () => {
    if (!meetingTaskId || !user) return;
    
    try {
      console.log('Marking task for next jour fixe:', meetingTaskId);
      
      const { data, error } = await supabase
        .from('tasks')
        .update({ pending_for_jour_fixe: true, meeting_id: null })
        .eq('id', meetingTaskId)
        .select();

      if (error) {
        console.error('Error marking task:', error);
        toast({ 
          title: "Fehler", 
          description: error.message || "Aufgabe konnte nicht vorgemerkt werden.",
          variant: "destructive" 
        });
        return;
      }
      
      toast({ title: "Aufgabe für nächsten Jour Fixe vorgemerkt" });
      loadTasks();
    } catch (error: any) {
      console.error('Error marking task for next jour fixe:', error);
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setMeetingTaskId(null);
    }
  };

  const getTaskTitle = (taskId: string | null) => {
    if (!taskId) return undefined;
    const task = [...assignedTasks, ...createdTasks].find(t => t.id === taskId);
    return task?.title;
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
                  onUpdateDueDate={handleUpdateDueDate}
                  onReminder={handleReminder}
                  onAssign={handleAssign}
                  onComment={handleComment}
                  onDecision={handleDecision}
                  onDocuments={handleDocuments}
                  onAddToMeeting={handleAddToMeeting}
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
                  onUpdateDueDate={handleUpdateDueDate}
                  onReminder={handleReminder}
                  onAssign={handleAssign}
                  onComment={handleComment}
                  onDecision={handleDecision}
                  onDocuments={handleDocuments}
                  onAddToMeeting={handleAddToMeeting}
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

      {/* Main content - 50/50 split - SWAPPED: Created left, Assigned right */}
      {totalTasks === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Keine offenen Aufgaben</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-0">
          {renderTaskList(createdTasks, "Von mir erstellt", "Keine eigenen Aufgaben")}
          {renderTaskList(assignedTasks, "Mir zugewiesen", "Keine Aufgaben zugewiesen")}
        </div>
      )}

      {/* Snooze/Wiedervorlage Dialog */}
      <Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Wiedervorlage setzen</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={undefined}
            onSelect={(date) => date && handleSetSnooze(date)}
            disabled={(date) => date < new Date()}
            initialFocus
          />
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Aufgabe zuweisen</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select onValueChange={(value) => handleUpdateAssignee(value === "__none__" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Person auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Keine Zuweisung</SelectItem>
                {profiles.map(profile => (
                  <SelectItem key={profile.user_id} value={profile.user_id}>
                    {profile.display_name || 'Unbekannter Benutzer'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comment Sidebar */}
      <TaskCommentSidebar
        taskId={commentTaskId}
        taskTitle={getTaskTitle(commentTaskId)}
        isOpen={commentSidebarOpen}
        onOpenChange={setCommentSidebarOpen}
      />

      {/* Decision Creator - controlled dialog with pre-filled values */}
      {decisionTaskId && (
        <TaskDecisionCreator 
          taskId={decisionTaskId}
          isOpen={decisionDialogOpen}
          onOpenChange={(open) => {
            setDecisionDialogOpen(open);
            if (!open) setDecisionTaskId(null);
          }}
          initialTitle={(() => {
            const task = [...assignedTasks, ...createdTasks].find(t => t.id === decisionTaskId);
            return task?.title;
          })()}
          initialDescription={(() => {
            const task = [...assignedTasks, ...createdTasks].find(t => t.id === decisionTaskId);
            return task?.description || undefined;
          })()}
          onDecisionCreated={() => {
            setDecisionDialogOpen(false);
            setDecisionTaskId(null);
            toast({ title: "Entscheidungsanfrage erstellt" });
          }}
        />
      )}

      {/* Document Dialog */}
      <TaskDocumentDialog
        taskId={documentTaskId}
        taskTitle={getTaskTitle(documentTaskId)}
        isOpen={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
      />

      {/* Meeting Selector Dialog */}
      <TaskMeetingSelector
        open={meetingSelectorOpen}
        onOpenChange={setMeetingSelectorOpen}
        onSelect={handleSelectMeeting}
        onMarkForNextJourFixe={handleMarkForNextJourFixe}
      />

      {/* Unicorn Animation on task completion */}
      <UnicornAnimation 
        isVisible={showUnicorn} 
        onAnimationComplete={() => setShowUnicorn(false)} 
      />
    </div>
  );
}
