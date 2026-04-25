import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, isAfter, isBefore, isToday, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import type {
  ChecklistRelation,
  DeadlineItem,
  EventPlanningRelation,
  GroupedDeadlineItems,
  PlanningTimelineAssignment,
} from '@/types/dashboardDeadlines';

const pickFirst = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const isAssignedToUser = (assignedTo: string | null | undefined, userId: string): boolean => {
  if (!assignedTo) return false;
  if (assignedTo === userId) return true;
  // CSV / contains check
  return assignedTo.toLowerCase().includes(userId.toLowerCase());
};

const fetchDeadlineItems = async (userId: string, tenantId?: string): Promise<DeadlineItem[]> => {
  const [tasksRes, notesRes, casesRes, decisionsRes, planningDeadlinesRes] = await Promise.all([
    supabase.from('tasks').select('id, title, due_date, assigned_to, user_id')
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
    supabase.from('task_decisions').select('id, title, response_deadline, created_by')
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
    ...(tasksRes.data || []).filter((t) => t.due_date && t.title?.trim()).map((t) => ({
      id: t.id,
      title: t.title.trim(),
      dueDate: t.due_date,
      type: 'task' as const,
      canSnooze: isAssignedToUser(t.assigned_to, userId) || t.user_id === userId,
    })),
    ...(notesRes.data || []).filter((n) => n.follow_up_date).map((n) => ({
      id: n.id,
      title: (n.title || n.content || '').trim().substring(0, 80),
      dueDate: n.follow_up_date,
      type: 'note' as const,
      canSnooze: true, // already filtered by user_id
    })),
    ...(casesRes.data || []).filter((c) => c.due_at).map((c) => ({
      id: c.id,
      title: (c.subject || 'Vorgang').trim(),
      dueDate: c.due_at,
      type: 'case' as const,
      canSnooze: false,
    })),
    ...(decisionsRes.data || []).filter((d) => d.response_deadline && d.title?.trim()).map((d) => ({
      id: d.id,
      title: d.title.trim(),
      dueDate: d.response_deadline,
      type: 'decision' as const,
      canSnooze: d.created_by === userId,
    })),
    ...(((planningDeadlinesRes.data || []) as PlanningTimelineAssignment[])
      .filter((assignment) => {
        const planning = pickFirst<EventPlanningRelation>(assignment.event_plannings);
        const checklistItem = pickFirst<ChecklistRelation>(assignment.event_planning_checklist_items);
        return Boolean(
          assignment.due_date &&
          planning?.id &&
          !planning.is_archived &&
          !planning.is_completed &&
          checklistItem?.title?.trim() &&
          !checklistItem.is_completed
        );
      })
      .map((assignment) => {
        const planning = pickFirst<EventPlanningRelation>(assignment.event_plannings);
        const checklistItem = pickFirst<ChecklistRelation>(assignment.event_planning_checklist_items);
        const checklistTitle = checklistItem?.title?.trim();
        const planningTitle = planning?.title?.trim();
        return {
          id: assignment.id,
          title: planningTitle ? `${checklistTitle} · ${planningTitle}` : checklistTitle,
          dueDate: assignment.due_date,
          type: 'eventPlanning' as const,
          planningId: planning?.id ?? assignment.event_planning_id,
          canSnooze: false,
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
