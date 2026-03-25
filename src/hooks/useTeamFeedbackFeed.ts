import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { createFeedbackContext, type FeedbackContext } from '@/types/feedbackContext';
import { normalizeSupabaseResult } from '@/utils/typeSafety';

export type FeedbackFeedScope = 'team' | 'mine' | 'team-plus-relevant';

export interface TeamFeedbackFeedFilters {
  scope?: FeedbackFeedScope;
  onlyWithAttachments?: boolean;
  onlyWithTasks?: boolean;
  completedFrom?: string;
  completedTo?: string;
}

export interface TeamFeedbackEntry {
  id: string;
  appointment_id: string | null;
  external_event_id: string | null;
  target_type: 'appointment' | 'external_event' | 'feedback';
  target_id: string;
  notes: string;
  completed_at: string | null;
  has_documents: boolean;
  has_tasks: boolean;
  feedback_status: string;
  appointment_title: string | null;
  appointment_start_time: string | null;
  event_type: string;
  author_id: string;
  author_name: string | null;
  is_relevant_to_me: boolean;
  linked_task_id: string | null;
  feedback_context: FeedbackContext;
}

interface AppointmentSummary {
  id: string;
  title: string | null;
  start_time: string | null;
  user_id: string;
  meeting_id: string | null;
}

interface ExternalCalendarRef {
  user_id?: string;
}

interface ExternalEventSummary {
  id: string;
  title: string | null;
  start_time: string | null;
  external_calendar_id: string | null;
  external_calendars?: ExternalCalendarRef | null;
}

interface ProfileSummary {
  user_id: string;
  display_name: string | null;
}

interface DecisionParticipant {
  meeting_id: string;
  user_id: string;
}

interface FeedbackRow {
  id: string;
  notes: string | null;
  completed_at: string | null;
  has_documents: boolean | null;
  has_tasks: boolean | null;
  feedback_status: string;
  event_type: string;
  appointment_id: string | null;
  external_event_id: string | null;
  user_id: string;
}

const DEFAULT_FILTERS: Required<TeamFeedbackFeedFilters> = {
  scope: 'team',
  onlyWithAttachments: false,
  onlyWithTasks: false,
  completedFrom: subDays(new Date(), 7).toISOString(),
  completedTo: new Date().toISOString(),
};

export const useTeamFeedbackFeed = (filters?: TeamFeedbackFeedFilters) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const resolvedFilters = useMemo(
    () => ({ ...DEFAULT_FILTERS, ...(filters || {}) }),
    [filters],
  );

  useEffect(() => {
    if (!currentTenant?.id || !user?.id) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidation = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        void queryClient.invalidateQueries({
          queryKey: ['team-feedback-feed', currentTenant.id, user.id],
        });
      }, 250);
    };

    const channel = supabase
      .channel(`team-feedback-feed-${currentTenant.id}-${user.id}`)
      // Der Feed basiert nicht nur auf appointment_feedback. Sichtbarkeit und Darstellung hängen auch an
      // appointments, external_events + external_calendars, meeting_participants, tasks und profiles.
      // Ein enger Filter wie appointment_feedback.user_id = current user wäre deshalb zu schmal:
      // Im Team-Feed fehlen sonst Rückmeldungen anderer Nutzer, Teilnehmerwechsel an Meetings sowie
      // nachträgliche Titel-/Zeit-/Aufgaben-/Namensänderungen im bereits geladenen Kontext.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_feedback', filter: `tenant_id=eq.${currentTenant.id}` }, scheduleInvalidation)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `tenant_id=eq.${currentTenant.id}` }, scheduleInvalidation)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `tenant_id=eq.${currentTenant.id}` }, scheduleInvalidation)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `tenant_id=eq.${currentTenant.id}` }, scheduleInvalidation)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_calendars', filter: `tenant_id=eq.${currentTenant.id}` }, scheduleInvalidation)
      // external_events und meeting_participants haben keinen tenant_id-Filter. Wir abonnieren sie daher
      // bewusst breit und kombinieren das mit geplantem Refetching als Backstop, damit Relevanzwechsel
      // (z. B. Meeting-Teilnahme, verschobene externe Termine) nicht dauerhaft stale bleiben.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_events' }, scheduleInvalidation)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_participants' }, scheduleInvalidation)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, queryClient, user?.id]);

  return useQuery({
    queryKey: ['team-feedback-feed', currentTenant?.id, user?.id, resolvedFilters],
    queryFn: async (): Promise<TeamFeedbackEntry[]> => {
      if (!currentTenant?.id || !user?.id) return [];

      const feedbackQuery = supabase
        .from('appointment_feedback')
        .select(`
          id,
          notes,
          completed_at,
          has_documents,
          has_tasks,
          feedback_status,
          event_type,
          appointment_id,
          external_event_id,
          user_id
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('feedback_status', 'completed')
        .gte('completed_at', resolvedFilters.completedFrom)
        .lte('completed_at', resolvedFilters.completedTo)
        .order('completed_at', { ascending: false })
        .limit(60);

      if (resolvedFilters.onlyWithAttachments) feedbackQuery.eq('has_documents', true);
      if (resolvedFilters.onlyWithTasks) feedbackQuery.eq('has_tasks', true);
      if (resolvedFilters.scope === 'mine') feedbackQuery.eq('user_id', user.id);

      const feedbackResult = normalizeSupabaseResult(await feedbackQuery);
      if (feedbackResult.error) throw feedbackResult.error;
      const feedbackData = feedbackResult.data as FeedbackRow[] | null;
      if (!feedbackData || feedbackData.length === 0) return [];

      const appointmentIds = feedbackData.flatMap(f => (f.appointment_id ? [f.appointment_id] : []));
      const externalEventIds = feedbackData.flatMap(f => (f.external_event_id ? [f.external_event_id] : []));
      const authorIds = Array.from(new Set(feedbackData.map(f => f.user_id)));
      const feedbackIds = feedbackData.map((f) => f.id);

      const [appointmentsResult, externalEventsResult, profilesResult] = await Promise.all([
        appointmentIds.length > 0
          ? supabase.from('appointments').select('id, title, start_time, user_id, meeting_id').in('id', appointmentIds)
          : Promise.resolve({ data: [] }),
        externalEventIds.length > 0
          ? supabase
              .from('external_events')
              .select('id, title, start_time, external_calendar_id, external_calendars(user_id)')
              .in('id', externalEventIds)
          : Promise.resolve({ data: [] }),
        authorIds.length > 0
          ? supabase.from('profiles').select('user_id, display_name').in('user_id', authorIds)
          : Promise.resolve({ data: [] }),
      ]);

      const meetingIds = Array.from(
        new Set((appointmentsResult.data || []).flatMap((a) => (a.meeting_id ? [a.meeting_id] : []))),
      );

      const { data: participantRows } = meetingIds.length
        ? await supabase
            .from('meeting_participants')
            .select('meeting_id, user_id')
            .in('meeting_id', meetingIds)
            .eq('user_id', user.id)
        : { data: [] };

      const participantMeetingIds = new Set((participantRows as DecisionParticipant[] | null || []).map((row) => row.meeting_id));
      const { data: taskLinks } = feedbackIds.length
        ? await supabase
            .from('tasks')
            .select('id, source_id, created_at')
            .eq('source_type', 'appointment_feedback')
            .in('source_id', feedbackIds)
            .order('created_at', { ascending: false })
        : { data: [] };

      const taskLinkMap = new Map<string, string>();
      (taskLinks || []).forEach((task) => {
        if (task.source_id && !taskLinkMap.has(task.source_id)) {
          taskLinkMap.set(task.source_id, task.id);
        }
      });

      const appointmentMap = new Map<string, AppointmentSummary>((appointmentsResult.data as AppointmentSummary[] || []).map((a) => [a.id, a]));
      const externalEventMap = new Map<string, ExternalEventSummary>((externalEventsResult.data as ExternalEventSummary[] || []).map((e) => [e.id, e]));
      const profileMap = new Map<string, ProfileSummary>((profilesResult.data as ProfileSummary[] || []).map((p) => [p.user_id, p]));

      const mappedEntries = feedbackData.map(f => {
        const appointment = f.appointment_id ? appointmentMap.get(f.appointment_id) : null;
        const externalEvent = f.external_event_id ? externalEventMap.get(f.external_event_id) : null;
        const source = appointment || externalEvent;

        const isAppointmentRelevant = Boolean(
          appointment && (
            appointment.user_id === user.id ||
            (appointment.meeting_id && participantMeetingIds.has(appointment.meeting_id))
          ),
        );
        const externalOwnerId = externalEvent?.external_calendars?.user_id;
        const isExternalEventRelevant = Boolean(externalEvent && externalOwnerId === user.id);

        return {
          id: f.id,
          appointment_id: f.appointment_id,
          external_event_id: f.external_event_id,
          target_type: f.appointment_id ? 'appointment' : f.external_event_id ? 'external_event' : 'feedback',
          target_id: f.appointment_id || f.external_event_id || f.id,
          notes: f.notes || '',
          completed_at: f.completed_at,
          has_documents: f.has_documents || false,
          has_tasks: f.has_tasks || false,
          feedback_status: f.feedback_status,
          event_type: f.event_type,
          appointment_title: source?.title || null,
          appointment_start_time: source?.start_time || null,
          author_id: f.user_id,
          author_name: profileMap.get(f.user_id)?.display_name || null,
          is_relevant_to_me: f.user_id === user.id || isAppointmentRelevant || isExternalEventRelevant,
          linked_task_id: taskLinkMap.get(f.id) || null,
          feedback_context: createFeedbackContext(
            f.id,
            taskLinkMap.get(f.id)
              ? { type: 'task', id: taskLinkMap.get(f.id)! }
              : {
                  type: appointment ? 'calendar' : 'feedback',
                  id: appointment?.id || f.id,
                },
          ),
        };
      });

      if (resolvedFilters.scope === 'team-plus-relevant') {
        return (mappedEntries as TeamFeedbackEntry[]).filter((entry) => entry.is_relevant_to_me || entry.has_tasks || entry.has_documents);
      }

      return mappedEntries as TeamFeedbackEntry[];
    },
    enabled: !!currentTenant?.id && !!user?.id,
    // Geplantes Refetching als Sicherheitsnetz für Kontextänderungen, die zwischen Subscribe/Unsubscribe
    // oder durch breit abonnierte Fremd-Events sonst kurzzeitig liegen bleiben könnten.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
};
