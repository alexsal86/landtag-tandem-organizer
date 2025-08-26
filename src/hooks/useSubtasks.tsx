import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Subtask, AssignedSubtask } from "@/types/taskTypes";

export const useSubtasks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subtasks, setSubtasks] = useState<{ [taskId: string]: Subtask[] }>({});
  const [subtaskCounts, setSubtaskCounts] = useState<{ [taskId: string]: number }>({});
  const [assignedSubtasks, setAssignedSubtasks] = useState<AssignedSubtask[]>([]);
  const [completingSubtask, setCompletingSubtask] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState<string>('');

  const loadSubtaskCounts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('task_id, id')
        .not('task_id', 'is', null);

      if (error) throw error;

      const counts: { [taskId: string]: number } = {};
      (data || []).forEach(subtask => {
        counts[subtask.task_id] = (counts[subtask.task_id] || 0) + 1;
      });

      setSubtaskCounts(counts);
    } catch (error) {
      console.error('Error loading subtask counts:', error);
    }
  };

  const loadSubtasks = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      setSubtasks(prev => ({
        ...prev,
        [taskId]: (data || []).map(item => ({
          ...item,
          title: item.description || 'Unbenannte Unteraufgabe',
          assigned_to: item.assigned_to 
            ? (typeof item.assigned_to === 'string' ? [item.assigned_to] : item.assigned_to)
            : [],
        }))
      }));
    } catch (error) {
      console.error('Error loading subtasks:', error);
    }
  };

  const loadAssignedSubtasks = async () => {
    if (!user) return;
    
    try {
      // Get regular subtasks assigned to this user
      const { data: subtasksData, error } = await supabase
        .from('subtasks')
        .select('*, result_text, completed_at')
        .contains('assigned_to', [user.id])
        .eq('is_completed', false);

      if (error) throw error;

      // Get planning subtasks assigned to this user
      const { data: planningSubtasksData, error: planningError } = await supabase
        .from('planning_item_subtasks')
        .select('*, result_text, completed_at')
        .eq('assigned_to', user.id)
        .eq('is_completed', false);

      if (planningError) throw planningError;

      // Get call follow-up tasks assigned to this user
      const { data: callFollowupData, error: callFollowupError } = await supabase
        .from('tasks')
        .select('*, call_log_id')
        .eq('category', 'call_follow_up')
        .neq('status', 'completed');
      
      // Filter those assigned to current user
      const userCallFollowups = (callFollowupData || []).filter(task => 
        (Array.isArray(task.assigned_to) && (task.assigned_to.includes(user.email) || task.assigned_to.includes(user.id))) ||
        task.user_id === user.id
      );

      // Combine subtasks with task titles
      const allSubtasks = [];

      // Process regular subtasks
      if (subtasksData) {
        for (const subtask of subtasksData) {
          // Skip subtasks not assigned to current user
          if (!Array.isArray(subtask.assigned_to) || !subtask.assigned_to.includes(user.id)) {
            continue;
          }

          const { data: taskData } = await supabase
            .from('tasks')
            .select('title')
            .eq('id', subtask.task_id)
            .single();

          allSubtasks.push({
            ...subtask,
            task_title: taskData?.title || 'Unbekannte Aufgabe',
            source_type: 'task' as const
          });
        }
      }

      // Process planning subtasks
      if (planningSubtasksData) {
        for (const subtask of planningSubtasksData) {
          // Skip subtasks not assigned to current user
          if (subtask.assigned_to !== user.id) {
            continue;
          }

          const { data: checklistItemData } = await supabase
            .from('event_planning_checklist_items')
            .select('title, event_planning_id')
            .eq('id', subtask.planning_item_id)
            .single();

          let planningTitle = 'Unbekannte Planung';
          if (checklistItemData) {
            const { data: planningData } = await supabase
              .from('event_plannings')
              .select('title')
              .eq('id', checklistItemData.event_planning_id)
              .single();
            
            planningTitle = planningData?.title || 'Unbekannte Planung';
          }

          allSubtasks.push({
            ...subtask,
            task_title: planningTitle,
            source_type: 'planning' as const,
            checklist_item_title: checklistItemData?.title,
            planning_item_id: subtask.planning_item_id
          });
        }
      }

      // Process call follow-up tasks as pseudo-subtasks
      if (userCallFollowups && userCallFollowups.length > 0) {
        for (const followupTask of userCallFollowups) {
          // Skip if not assigned to current user
          const assignees = Array.isArray(followupTask.assigned_to) 
            ? followupTask.assigned_to 
            : (followupTask.assigned_to || '').split(',').map(a => a.trim());
          
          if (!assignees.includes(user.id) && !assignees.includes(user.email)) {
            continue;
          }

          // Get contact name from call log
          let contactName = 'Unbekannter Kontakt';
          if (followupTask.call_log_id) {
            const { data: callLogData } = await supabase
              .from('call_logs')
              .select('contact_id')
              .eq('id', followupTask.call_log_id)
              .single();

            if (callLogData?.contact_id) {
              const { data: contactData } = await supabase
                .from('contacts')
                .select('name')
                .eq('id', callLogData.contact_id)
                .single();
              
              contactName = contactData?.name || contactName;
            }
          }

          allSubtasks.push({
            id: followupTask.id,
            task_id: followupTask.id,
            title: followupTask.title,
            description: followupTask.description || '',
            is_completed: followupTask.status === 'completed',
            assigned_to: assignees,
            due_date: followupTask.due_date,
            order_index: 0,
            completed_at: null,
            result_text: null,
            planning_item_id: null,
            source_type: 'call_followup' as const,
            checklist_item_title: null,
            call_log_id: followupTask.call_log_id,
            contact_name: contactName,
            priority: followupTask.priority,
            created_at: followupTask.created_at,
            updated_at: followupTask.updated_at,
            task_title: `Anruf-Nachbereitung: ${contactName}`
          });
        }
      }

      setAssignedSubtasks(allSubtasks);
    } catch (error) {
      console.error('Error loading assigned subtasks:', error);
    }
  };

  const completeSubtask = async (subtaskId: string, resultText: string, sourceType: string = 'task') => {
    try {
      let error;
      
      if (sourceType === 'planning') {
        const { error: planningError } = await supabase
          .from('planning_item_subtasks')
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
            result_text: resultText
          })
          .eq('id', subtaskId);
        error = planningError;
      } else if (sourceType === 'call_followup') {
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', subtaskId);
        error = taskError;
      } else {
        const { error: subtaskError } = await supabase
          .from('subtasks')
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
            result_text: resultText
          })
          .eq('id', subtaskId);
        error = subtaskError;
      }

      if (error) throw error;

      await loadAssignedSubtasks();
      setCompletingSubtask(null);
      setCompletionResult('');
      
      toast({
        title: "Erfolgreich",
        description: "Unteraufgabe wurde abgeschlossen.",
      });
    } catch (error) {
      console.error('Error completing subtask:', error);
      toast({
        title: "Fehler",
        description: "Unteraufgabe konnte nicht abgeschlossen werden.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadSubtaskCounts();
    loadAssignedSubtasks();
  }, []);

  return {
    subtasks,
    subtaskCounts,
    assignedSubtasks,
    completingSubtask,
    completionResult,
    setCompletingSubtask,
    setCompletionResult,
    loadSubtasks,
    loadSubtaskCounts,
    loadAssignedSubtasks,
    completeSubtask
  };
};