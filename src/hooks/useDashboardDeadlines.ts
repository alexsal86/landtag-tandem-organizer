import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { groupDeadlineItems } from '@/utils/deadlineFormatting';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime';
import { STALE_TIME } from '@/lib/query-cache';
import { berlinDateTimeToInstant, berlinDayKey, shiftBerlinDay } from '@/utils/berlinDate';
import type { Tables } from '@/integrations/supabase/types';
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

const formatCaseStepTitle = (subject: string | null | undefined, step: string | null | undefined) =>
  `${subject?.trim() || 'Vorgang'} - ${step?.trim() || 'Nächster Schritt'}`;

/** Zeilentypen der sechs Fristen-Quellen, direkt aus den generierten DB-Typen. */
type TaskDeadlineRow = Pick<
  Tables<'tasks'>,
  'id' | 'title' | 'due_date' | 'assigned_to' | 'user_id' | 'priority' | 'source_type' | 'source_id'
>;
type NoteDeadlineRow = Pick<Tables<'quick_notes'>, 'id' | 'title' | 'content' | 'follow_up_date'>;
type CaseDeadlineRow = Pick<
  Tables<'case_items'>,
  'id' | 'subject' | 'due_at' | 'priority' | 'owner_user_id' | 'user_id'
>;
type DecisionDeadlineRow = Pick<
  Tables<'task_decisions'>,
  'id' | 'title' | 'response_deadline' | 'created_by' | 'priority'
>;
type CaseActionDeadlineRow = Pick<
  Tables<'case_items'>,
  'id' | 'subject' | 'next_action_label' | 'next_action_due_at' | 'next_action_assignee_id' | 'owner_user_id' | 'user_id'
>;

interface DeadlineFetchResult {
  items: DeadlineItem[];
  failedSources: string[];
  allSourcesFailed: boolean;
}

/** Antwortform einer Fristen-Quelle: Datenzeilen plus ein Fehler, falls sie scheiterte. */
interface DeadlineSourceResponse<T> {
  data: T[] | null;
  error: unknown;
}

const DEADLINE_SOURCE_COUNT = 6;

/**
 * Führt eine Quelle aus und vereinheitlicht ihre Antwort; `null` steht für
 * "ohne Mandant übersprungen" und verhält sich wie eine leere, erfolgreiche Abfrage.
 */
const loadDeadlineSource = async <T,>(
  query: PromiseLike<DeadlineSourceResponse<T>> | null,
): Promise<DeadlineSourceResponse<T>> => {
  if (!query) return { data: [], error: null };
  const { data, error } = await query;
  return { data: data ?? [], error };
};

const fetchDeadlineItems = async (userId: string, tenantId?: string): Promise<DeadlineFetchResult> => {
  // Jede Quelle liefert dieselbe Hülle, damit "kein Mandant" und "Abfrage
  // gelaufen" unten gleich behandelt werden können; die Zeilentypen kommen aus
  // den generierten Supabase-Typen (select-Liste).
  const [tasksRes, notesRes, casesRes, decisionsRes, planningDeadlinesRes, caseActionsRes] = await Promise.all([
    loadDeadlineSource<TaskDeadlineRow>(
      tenantId
        ? supabase.from('tasks').select('id, title, due_date, assigned_to, user_id, priority, source_type, source_id')
            .eq('tenant_id', tenantId)
            .or(`assigned_to.eq.${userId},assigned_to.ilike.%${userId}%,user_id.eq.${userId}`)
            .not('status', 'in', '(completed,cancelled)')
            .not('due_date', 'is', null)
        : null,
    ),
    loadDeadlineSource<NoteDeadlineRow>(
      tenantId
        ? supabase.from('quick_notes').select('id, title, content, follow_up_date')
            .eq('tenant_id', tenantId)
            .eq('user_id', userId)
            .is('deleted_at', null)
            .or('is_archived.is.null,is_archived.eq.false')
            .not('follow_up_date', 'is', null)
        : null,
    ),
    loadDeadlineSource<CaseDeadlineRow>(
      tenantId
        ? supabase.from('case_items').select('id, subject, due_at, priority, owner_user_id, user_id')
            .eq('tenant_id', tenantId)
            .not('due_at', 'is', null)
            .neq('status', 'erledigt')
        : null,
    ),
    loadDeadlineSource<DecisionDeadlineRow>(
      tenantId
        ? supabase.from('task_decisions').select('id, title, response_deadline, created_by, priority')
            .eq('tenant_id', tenantId)
            // Offene Entscheidungen tragen 'active' oder 'open'; 'resolved' existiert im Schema nicht.
            .in('status', ['active', 'open'])
            .is('archived_at', null)
            .not('response_deadline', 'is', null)
        : null,
    ),
    // event_plannings.tenant_id ist nullable: Planungen ohne Büro werden bewusst
    // nicht gezeigt, weil sie sich keinem Büro zuordnen lassen (eq schließt NULL aus).
    loadDeadlineSource<PlanningTimelineAssignment>(
      tenantId
        ? supabase
            .from('event_planning_timeline_assignments')
            .select(`
              id,
              due_date,
              event_planning_id,
              event_plannings!inner (id, title, user_id, is_archived, is_completed),
              event_planning_checklist_items (id, title, is_completed)
            `)
            .eq('event_plannings.tenant_id', tenantId)
        : null,
    ),
    loadDeadlineSource<CaseActionDeadlineRow>(
      tenantId
        ? supabase.from('case_items').select('id, subject, next_action_label, next_action_due_at, next_action_assignee_id, owner_user_id, user_id')
            .eq('tenant_id', tenantId)
            .not('next_action_due_at', 'is', null)
            .not('status', 'in', '(erledigt,archiviert)')
            .or(`next_action_assignee_id.eq.${userId},and(next_action_assignee_id.is.null,owner_user_id.eq.${userId})`)
        : null,
    ),
  ]);

  // Eine fehlerhafte Quelle darf die übrigen nicht verdecken: Fehler werden je
  // Quelle gesammelt, die Daten der erfolgreichen Quellen bleiben sichtbar.
  const failedSources: string[] = [];
  const collect = <T,>(source: DeadlineSourceResponse<T>, label: string): T[] => {
    if (source.error) {
      failedSources.push(label);
      return [];
    }
    return source.data ?? [];
  };

  const failedSourceCount = [tasksRes, notesRes, casesRes, decisionsRes, planningDeadlinesRes, caseActionsRes]
    .filter((source) => Boolean(source.error)).length;

  const tasks = collect(tasksRes, 'Aufgaben');
  const notes = collect(notesRes, 'Notizen');
  const cases = collect(casesRes, 'Vorgänge');
  const decisions = collect(decisionsRes, 'Entscheidungen');
  const planningDeadlines = collect(planningDeadlinesRes, 'Veranstaltungen');
  const caseActions = collect(caseActionsRes, 'Nächste Schritte');

  const caseStepIds = [...new Set(tasks
    .filter(task => task.source_type === 'case_step' && task.source_id)
    .map(task => task.source_id!))];
  const caseSubjects = new Map<string, string | null>();
  if (caseStepIds.length > 0) {
    const { data, error } = await supabase.from('case_items')
      .select('id, subject').in('id', caseStepIds);
    if (error) {
      // Nur die Fallbezeichnungen fehlen; die Aufgaben selbst bleiben sichtbar.
      failedSources.push('Fallbezeichnungen');
    } else {
      for (const item of data ?? []) caseSubjects.set(item.id, item.subject);
    }
  }

  const all: DeadlineItem[] = [
    ...tasks.filter((t) => t.due_date && t.title?.trim()).map((t) => ({
      id: t.id,
      title: t.source_type === 'case_step'
        ? formatCaseStepTitle(caseSubjects.get(t.source_id ?? ''), t.title)
        : t.title.trim(),
      dueDate: t.due_date!,
      type: 'task' as const,
      priority: ({ urgent: 3, high: 2, medium: 1 } as Record<string, number>)[t.priority] ?? 0,
      canSnooze: isAssignedToUser(t.assigned_to, userId) || t.user_id === userId,
    })),
    ...notes.filter((n) => n.follow_up_date).map((n) => ({
      id: n.id,
      title: (n.title || n.content || '').trim().substring(0, 80),
      dueDate: n.follow_up_date!,
      type: 'note' as const,
      canSnooze: true, // already filtered by user_id
    })),
    ...cases.filter((c) => c.due_at).map((c) => ({
      id: c.id,
      title: (c.subject || 'Vorgang').trim(),
      dueDate: c.due_at!,
      type: 'case' as const,
      canSnooze: c.owner_user_id === userId || c.user_id === userId,
      priority: ({ urgent: 3, high: 2, medium: 1 } as Record<string, number>)[c.priority] ?? 0,
    })),
    ...caseActions.filter((c) => c.next_action_due_at && !caseStepIds.includes(c.id)).map((c) => ({
      id: c.id,
      title: formatCaseStepTitle(c.subject, c.next_action_label),
      dueDate: c.next_action_due_at!,
      type: 'caseAction' as const,
      canSnooze: true,
    })),
    ...decisions.filter((d) => d.response_deadline && d.title?.trim()).map((d) => ({
      id: d.id,
      title: d.title.trim(),
      dueDate: d.response_deadline!,
      type: 'decision' as const,
      priority: d.priority ?? 0,
      canSnooze: d.created_by === userId,
    })),
    ...(planningDeadlines
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
        const checklistTitle = checklistItem?.title?.trim() ?? 'Veranstaltung';
        const planningTitle = planning?.title?.trim();
        return {
          id: assignment.id,
          title: planningTitle ? `${checklistTitle} · ${planningTitle}` : checklistTitle,
          dueDate: assignment.due_date!,
          type: 'eventPlanning' as const,
          planningId: planning?.id ?? assignment.event_planning_id ?? undefined,
          checklistItemId: checklistItem?.id,
          canSnooze: planning?.user_id === userId,
        };
      })),
  ];

  return {
    items: all.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    failedSources,
    allSourcesFailed: failedSourceCount === DEADLINE_SOURCE_COUNT,
  };
};

/**
 * Berliner Kalendertag, der beim Tageswechsel neu rendert. Ein Timer zielt auf die
 * nächste Berliner Mitternacht; `focus` und `visibilitychange` holen den Wechsel
 * nach, wenn ein gedrosselter Tab den Timer verschlafen hat. Kein Netzzugriff.
 */
const useBerlinDayKey = (): string => {
  const [dayKey, setDayKey] = useState(() => berlinDayKey(new Date()));

  useEffect(() => {
    const sync = () => setDayKey(berlinDayKey(new Date()));
    const nextMidnight = berlinDateTimeToInstant(`${shiftBerlinDay(berlinDayKey(new Date()), 1)}T00:00`);
    // Ein Sekundenpuffer hält den Wechsel sicher hinter der Tagesgrenze.
    const timer = window.setTimeout(sync, Math.max(1_000, nextMidnight.getTime() - Date.now() + 1_000));
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [dayKey]);

  return dayKey;
};

export const useDashboardDeadlines = (enabled = true) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const userId = user?.id;
  const tenantId = currentTenant?.id;

  useDashboardRealtime(enabled ? userId : undefined, tenantId);

  const query = useQuery({
    queryKey: ['dashboard-deadlines', userId, tenantId],
    queryFn: () => fetchDeadlineItems(userId!, tenantId),
    enabled: enabled && !!userId,
    staleTime: STALE_TIME.LIST_WITH_REALTIME,
    // Kein Polling: alle Quellen (tasks, quick_notes, case_items, task_decisions, event_plannings
    // samt Timeline- und Checklisten-Zuweisungen) invalidieren diesen Key über useDashboardRealtime,
    // und die Abfrage filtert nicht relativ zum aktuellen Datum. Die Einordnung nach
    // heute/morgen hängt dagegen am Kalendertag und wird über useBerlinDayKey neu berechnet.
    refetchOnWindowFocus: false,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const dayKey = useBerlinDayKey();
  // Mittag des Berliner Bezugstags: stabil innerhalb des Tages, einheitlich für alle Gruppen.
  const dayAnchor = useMemo(() => berlinDateTimeToInstant(`${dayKey}T12:00`), [dayKey]);
  const grouped = useMemo<GroupedDeadlineItems>(
    () => groupDeadlineItems(items, dayAnchor),
    [items, dayAnchor],
  );
  const allSourcesFailed = query.data?.allSourcesFailed ?? false;

  return {
    items,
    grouped,
    isLoading: query.isLoading,
    // Totalausfall nur, wenn keine einzige Quelle geladen wurde; sonst bleibt die
    // Kachel nutzbar und meldet den Teilausfall über `failedSources`.
    isError: query.isError || allSourcesFailed,
    failedSources: allSourcesFailed ? [] : (query.data?.failedSources ?? []),
    refetch: () => { void query.refetch(); },
  };
};
