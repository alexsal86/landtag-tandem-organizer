import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { DeadlineItem } from '@/types/dashboardDeadlines';

interface SnoozePayload {
  item: DeadlineItem;
  newDate: Date;
}

const performSnooze = async ({ item, newDate }: SnoozePayload): Promise<void> => {
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
        .eq('id', item.id);
      if (error) throw error;
      return;
    }
    case 'note': {
      // quick_notes.follow_up_date is timestamptz
      const { error } = await supabase
        .from('quick_notes')
        .update({ follow_up_date: safeDate.toISOString() })
        .eq('id', item.id);
      if (error) throw error;
      return;
    }
    case 'decision': {
      // task_decisions.response_deadline is timestamptz
      const { error } = await supabase
        .from('task_decisions')
        .update({ response_deadline: safeDate.toISOString() })
        .eq('id', item.id);
      if (error) throw error;
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
      queryClient.invalidateQueries({ queryKey: ['dashboard-deadlines'] });
      const today = startOfDay(new Date());
      const safe = variables.newDate < today ? today : variables.newDate;
      toast.success(`Frist verschoben auf ${format(safe, 'EEEE, dd.MM.yyyy', { locale: de })}`);
    },
    onError: (error: Error) => {
      toast.error(`Verschieben fehlgeschlagen: ${error.message}`);
    },
  });
};
