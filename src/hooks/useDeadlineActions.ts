import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import type { DeadlineItem } from '@/types/dashboardDeadlines';

export type DeadlineAction = 'complete' | 'discard';
type Undo = () => Promise<void>;

async function checked(result: { error: { message: string } | null; data: unknown }) {
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error('Eintrag wurde geändert oder darf nicht bearbeitet werden. Bitte neu laden.');
}

// Discard removes only the deadline, preserving the underlying record.
export async function changeDeadline(item: DeadlineItem, action: DeadlineAction): Promise<Undo | undefined> {
  if (!item.canSnooze) throw new Error('Keine Berechtigung zum Bearbeiten dieser Frist.');
  const discard = action === 'discard';
  switch (item.type) {
    case 'task':
      if (!discard) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw new Error('Nicht angemeldet.');
        await checked(await supabase.rpc('archive_completed_task', { p_task_id: item.id, p_user_id: user.id }));
        return undefined;
      }
      await checked(await supabase.from('tasks').update({ due_date: null }).eq('id', item.id).eq('due_date', item.dueDate).select('id').single());
      return async () => { await checked(await supabase.from('tasks').update({ due_date: item.dueDate }).eq('id', item.id).is('due_date', null).select('id').single()); };
    case 'note':
      // A note's follow-up is completed by clearing its date; the note stays intact.
      await checked(await supabase.from('quick_notes').update({ follow_up_date: null }).eq('id', item.id).eq('follow_up_date', item.dueDate).select('id').single());
      return async () => { await checked(await supabase.from('quick_notes').update({ follow_up_date: item.dueDate }).eq('id', item.id).is('follow_up_date', null).select('id').single()); };
    case 'case':
      await checked(await supabase.from('case_items').update(discard ? { due_at: null } : { status: 'erledigt', completed_at: new Date().toISOString() }).eq('id', item.id).eq('due_at', item.dueDate).select('id').single());
      return discard ? async () => { await checked(await supabase.from('case_items').update({ due_at: item.dueDate }).eq('id', item.id).is('due_at', null).select('id').single()); } : undefined;
    case 'caseAction':
      // Completing a next step clears it; the case itself stays open.
      await checked(await supabase.from('case_items').update(discard ? { next_action_due_at: null } : { next_action_label: null, next_action_due_at: null }).eq('id', item.id).eq('next_action_due_at', item.dueDate).select('id').single());
      return discard ? async () => { await checked(await supabase.from('case_items').update({ next_action_due_at: item.dueDate }).eq('id', item.id).is('next_action_due_at', null).select('id').single()); } : undefined;
    case 'decision': {
      let completion: { status: string; archived_at: string; archived_by: string } | undefined;
      if (!discard) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw new Error('Nicht angemeldet.');
        completion = { status: 'archived', archived_at: new Date().toISOString(), archived_by: user.id };
      }
      await checked(await supabase.from('task_decisions').update(discard ? { response_deadline: null } : completion!).eq('id', item.id).eq('response_deadline', item.dueDate).select('id').single());
      return discard ? async () => { await checked(await supabase.from('task_decisions').update({ response_deadline: item.dueDate }).eq('id', item.id).is('response_deadline', null).select('id').single()); } : undefined;
    }
    case 'eventPlanning': {
      if (discard) {
        // due_date is non-nullable: remove only the timeline assignment, not the checklist item or event.
        const result = await supabase.from('event_planning_timeline_assignments').delete().eq('id', item.id).eq('due_date', item.dueDate).select('id, checklist_item_id, event_planning_id, due_date, notes, created_at, updated_at').single();
        await checked(result);
        const original = result.data!;
        return async () => { await checked(await supabase.from('event_planning_timeline_assignments').insert(original).select('id').single()); };
      }
      if (!item.checklistItemId) throw new Error('Checklistenpunkt fehlt.');
      await checked(await supabase.from('event_planning_checklist_items').update({ is_completed: true }).eq('id', item.checklistItemId).select('id').single());
      return undefined;
    }
  }
}

export function useDeadlineActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries();
  return useMutation({
    mutationFn: async ({ items, action }: { items: DeadlineItem[]; action: DeadlineAction }) => {
      const undo: Undo[] = [];
      const failed: string[] = [];
      let completed = 0;
      // Keep partial successes and report failures separately; never claim the whole batch succeeded.
      for (const item of items) {
        try {
          const restore = await changeDeadline(item, action);
          if (restore) undo.push(restore);
          completed++;
        } catch (error) {
          failed.push(`${item.title}: ${error instanceof Error ? error.message : 'Speichern fehlgeschlagen'}`);
        }
      }
      return { completed, failed, undo };
    },
    onSuccess: ({ completed, failed, undo }) => {
      void refresh();
      if (completed) notify.success(`${completed} ${completed === 1 ? 'Frist bearbeitet' : 'Fristen bearbeitet'}`, {
        duration: undo.length ? 15000 : 5000,
        action: undo.length ? {
          label: 'Rückgängig',
          onClick: async () => {
            const results = await Promise.allSettled(undo.map(restore => restore()));
            void refresh();
            if (results.some(result => result.status === 'rejected')) notify.error('Nicht alle Fristen konnten wiederhergestellt werden. Bitte neu laden und prüfen.');
            else notify.success('Fristen wiederhergestellt');
          },
        } : undefined,
      });
      if (failed.length) notify.error(`${failed.length} Fristen konnten nicht bearbeitet werden`, { description: failed.join('\n'), duration: 15000 });
    },
  });
}
