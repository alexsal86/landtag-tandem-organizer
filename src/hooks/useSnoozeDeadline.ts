import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import type { DeadlineItem } from '@/types/dashboardDeadlines';
import { notify } from "@/lib/notify";

interface SnoozePayload {
  item: DeadlineItem;
  newDate: Date;
}

export const performSnooze = async ({ item, newDate }: SnoozePayload): Promise<void> => {
  if (!item.canSnooze) throw new Error('Keine Berechtigung zum Ändern dieser Frist.');
  // Never schedule into the past — clamp to today at minimum.
  const today = startOfDay(new Date());
  const safeDate = newDate < today ? today : newDate;

  switch (item.type) {
    case 'task': {
      // tasks.due_date is a `date` column → YYYY-MM-DD
      const dateStr = format(safeDate, 'yyyy-MM-dd');
      const { error } = await supabase
        .from('tasks')
        .update({ due_date: dateStr })
        .eq('id', item.id).eq('due_date', item.dueDate).select('id').single();
      if (error) throw error;
      return;
    }
    case 'note': {
      // quick_notes.follow_up_date is timestamptz
      const { error } = await supabase
        .from('quick_notes')
        .update({ follow_up_date: safeDate.toISOString() })
        .eq('id', item.id).eq('follow_up_date', item.dueDate).select('id').single();
      if (error) throw error;
      return;
    }
    case 'decision': {
      // task_decisions.response_deadline is timestamptz
      const { error } = await supabase
        .from('task_decisions')
        .update({ response_deadline: safeDate.toISOString() })
        .eq('id', item.id).eq('response_deadline', item.dueDate).select('id').single();
      if (error) throw error;
      return;
    }
    case 'case': {
      const { error, data } = await supabase.from('case_items').update({ due_at: safeDate.toISOString() }).eq('id', item.id).eq('due_at', item.dueDate).select('id').single();
      if (error || !data) throw error ?? new Error('Frist wurde zwischenzeitlich geändert.');
      return;
    }
    case 'caseAction': {
      const { error, data } = await supabase.from('case_items').update({ next_action_due_at: safeDate.toISOString() }).eq('id', item.id).eq('next_action_due_at', item.dueDate).select('id').single();
      if (error || !data) throw error ?? new Error('Frist wurde zwischenzeitlich geändert.');
      return;
    }
    case 'eventPlanning': {
      const { error, data } = await supabase.from('event_planning_timeline_assignments').update({ due_date: format(safeDate, 'yyyy-MM-dd') }).eq('id', item.id).eq('due_date', item.dueDate).select('id').single();
      if (error || !data) throw error ?? new Error('Frist wurde zwischenzeitlich geändert.');
      return;
    }
    default:
      throw new Error(`Wiedervorlage für Typ "${item.type}" wird nicht unterstützt.`);
  }
};

export const useSnoozeDeadline = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: performSnooze,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries();
      const today = startOfDay(new Date());
      const safe = variables.newDate < today ? today : variables.newDate;
      notify.success(`Frist verschoben auf ${format(safe, 'EEEE, dd.MM.yyyy', { locale: de })}`);
    },
    onError: (error: Error) => {
      notify.error(`Verschieben fehlgeschlagen: ${error.message}`);
    },
  });
};
