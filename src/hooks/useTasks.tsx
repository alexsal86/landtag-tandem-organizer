import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Task, RecentActivity } from "@/types/taskTypes";

export const useTasks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  const loadTasks = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedTasks = (data || []).map(task => ({
        ...task,
        dueDate: task.due_date || '',
        assignedTo: Array.isArray(task.assigned_to) 
          ? task.assigned_to.join(',') 
          : (task.assigned_to || ''),
        priority: task.priority as "low" | "medium" | "high",
        status: task.status as "todo" | "in-progress" | "completed",
        category: task.category as "legislation" | "constituency" | "committee" | "personal" | "call_followup" | "call_follow_up",
        description: task.description || '',
      }));

      setTasks(formattedTasks);
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

  const loadRecentActivities = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, updated_at, status')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const activities = (data || []).map(task => ({
        id: task.id,
        type: task.status === 'completed' ? 'completed' as const : 'updated' as const,
        taskTitle: task.title,
        timestamp: task.updated_at || ''
      }));

      setRecentActivities(activities);
    } catch (error) {
      console.error('Error loading recent activities:', error);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const dbUpdates: any = { ...updates };
      
      // Convert frontend field names to database field names
      if (updates.dueDate !== undefined) {
        dbUpdates.due_date = updates.dueDate;
        delete dbUpdates.dueDate;
      }
      
      if (updates.assignedTo !== undefined) {
        dbUpdates.assigned_to = updates.assignedTo.split(',').map(user => user.trim()).filter(Boolean);
        delete dbUpdates.assignedTo;
      }

      const { error } = await supabase
        .from('tasks')
        .update(dbUpdates)
        .eq('id', taskId);

      if (error) throw error;

      await loadTasks();
      await loadRecentActivities();
      
      toast({
        title: "Erfolgreich",
        description: "Aufgabe wurde aktualisiert.",
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

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      await loadTasks();
      
      toast({
        title: "Erfolgreich",
        description: "Aufgabe wurde gelöscht.",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const completeTask = async (taskId: string) => {
    await updateTask(taskId, { status: 'completed' });
  };

  useEffect(() => {
    loadTasks();
    loadRecentActivities();
  }, []);

  return {
    tasks,
    loading,
    recentActivities,
    loadTasks,
    updateTask,
    deleteTask,
    completeTask,
    loadRecentActivities
  };
};