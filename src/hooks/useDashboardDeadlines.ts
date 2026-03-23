import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, isAfter, isBefore, isToday, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

export interface DeadlineItem {
  id: string;
  title: string;
  dueDate: string;
  type: 'task' | 'note' | 'case' | 'decision' | 'eventPlanning';
  planningId?: string;
}

export interface GroupedDeadlineItems {
  overdue: DeadlineItem[];
  today: DeadlineItem[];
  thisWeek: DeadlineItem[];
  later: DeadlineItem[];
}

const fetchDeadlineItems = async (userId: string, tenantId?: string): Promise<DeadlineItem[]> => {
  const [tasksRes, notesRes, casesRes, decisionsRes, planningDeadlinesRes] = await Promise.all([
    supabase.from('tasks').select('id, title, due_date')
      .or(`assigned_to.eq.${userId},assigned_to.ilike.%${userId}%,user_id.eq.${userId}`)
      .neq('status', 'completed')
      .not('due_date', 'is', null),
    supabase.from('quick_notes').select('id, title, content, follow_up_date')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .or('is_archived.is.null,is_archived.eq.false')
      .not('follow_up_date', 'is', null),
    tenantId
      ? supabase.from('case_items').select('id, subject, due_at')
          .eq('tenant_id', tenantId)
          .not('due_at', 'is', null)
          .neq('status', 'erledigt')
      : Promise.resolve({ data: [] }),
    supabase.from('task_decisions').select('id, title, response_deadline')
      .neq('status', 'resolved')
      .is('archived_at', null)
      .not('response_deadline', 'is', null),
    supabase
      .from('event_planning_timeline_assignments')
      .select(`
        id,
        due_date,
        event_planning_id,
        event_plannings (id, title, user_id, is_archived, is_completed),
        event_planning_checklist_items (id, title, is_completed)
      `),
  ]);

  const all: DeadlineItem[] = [
    ...(tasksRes.data || []).filter((t: any) => t.due_date && t.title?.trim()).map((t: any) => ({
      id: t.id, title: t.title.trim(), dueDate: t.due_date, type: 'task' as const,
    })),
    ...(notesRes.data || []).filter((n: any) => n.follow_up_date).map((n: any) => ({
      id: n.id, title: (n.title || n.content || '').trim().substring(0, 80), dueDate: n.follow_up_date, type: 'note' as const,
    })),
    ...(casesRes.data || []).filter((c: any) => c.due_at).map((c: any) => ({
      id: c.id, title: (c.subject || 'Vorgang').trim(), dueDate: c.due_at, type: 'case' as const,
    })),
    ...(decisionsRes.data || []).filter((d: any) => d.response_deadline && d.title?.trim()).map((d: any) => ({
      id: d.id, title: d.title.trim(), dueDate: d.response_deadline, type: 'decision' as const,
    })),
    ...((planningDeadlinesRes.data || [])
      .filter((assignment: any) => {
        const planning = Array.isArray(assignment.event_plannings) ? assignment.event_plannings[0] : assignment.event_plannings;
        const checklistItem = Array.isArray(assignment.event_planning_checklist_items) ? assignment.event_planning_checklist_items[0] : assignment.event_planning_checklist_items;
        return Boolean(
          assignment.due_date &&
          planning?.id &&
          !planning.is_archived &&
          !planning.is_completed &&
          checklistItem?.title?.trim() &&
          !checklistItem.is_completed
        );
      })
      .map((assignment: any) => {
        const planning = Array.isArray(assignment.event_plannings) ? assignment.event_plannings[0] : assignment.event_plannings;
        const checklistItem = Array.isArray(assignment.event_planning_checklist_items) ? assignment.event_planning_checklist_items[0] : assignment.event_planning_checklist_items;
        const checklistTitle = checklistItem?.title?.trim();
        const planningTitle = planning?.title?.trim();
        return {
          id: assignment.id,
          title: planningTitle ? `${checklistTitle} · ${planningTitle}` : checklistTitle,
          dueDate: assignment.due_date,
          type: 'eventPlanning' as const,
          planningId: planning?.id ?? assignment.event_planning_id,
        };
      })),
  ];

  return all.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
};

export const useDashboardDeadlines = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const userId = user?.id;
  const tenantId = currentTenant?.id;

  const query = useQuery({
    queryKey: ['dashboard-deadlines', userId, tenantId],
    queryFn: () => fetchDeadlineItems(userId!, tenantId),
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const grouped = useMemo<GroupedDeadlineItems>(() => {
    const overdue: DeadlineItem[] = [];
    const today: DeadlineItem[] = [];
    const thisWeek: DeadlineItem[] = [];
    const later: DeadlineItem[] = [];
    const now = new Date();
    const todayStart = startOfDay(now);
    const sevenDaysOut = addDays(todayStart, 7);

    for (const item of query.data ?? []) {
      const date = new Date(item.dueDate);
      if (isBefore(date, todayStart)) overdue.push(item);
      else if (isToday(date)) today.push(item);
      else if (!isAfter(date, sevenDaysOut)) thisWeek.push(item);
      else later.push(item);
    }

    return { overdue, today, thisWeek, later };
  }, [query.data]);

  return {
    items: query.data ?? [],
    grouped,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
