import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';

export interface TeamFeedbackEntry {
  id: string;
  notes: string;
  completed_at: string | null;
  has_documents: boolean;
  has_tasks: boolean;
  feedback_status: string;
  appointment_title: string | null;
  appointment_start_time: string | null;
  event_type: string;
}

export const useTeamFeedbackFeed = () => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['team-feedback-feed', currentTenant?.id],
    queryFn: async (): Promise<TeamFeedbackEntry[]> => {
      if (!currentTenant?.id || !user?.id) return [];

      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      // Load feedback entries with appointment data
      const { data: feedbackData, error } = await supabase
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
          external_event_id
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('feedback_status', 'completed')
        .not('notes', 'is', null)
        .gte('completed_at', sevenDaysAgo)
        .order('completed_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      if (!feedbackData || feedbackData.length === 0) return [];

      // Collect IDs for batch fetching
      const appointmentIds = feedbackData
        .filter(f => f.appointment_id)
        .map(f => f.appointment_id as string);

      const externalEventIds = feedbackData
        .filter(f => f.external_event_id)
        .map(f => f.external_event_id as string);

      // Parallel fetch title/start_time for appointments and external events
      const [appointmentsResult, externalEventsResult] = await Promise.all([
        appointmentIds.length > 0
          ? supabase.from('appointments').select('id, title, start_time').in('id', appointmentIds)
          : Promise.resolve({ data: [] }),
        externalEventIds.length > 0
          ? supabase.from('external_events').select('id, title, start_time').in('id', externalEventIds)
          : Promise.resolve({ data: [] }),
      ]);

      const appointmentMap = new Map((appointmentsResult.data || []).map(a => [a.id, a]));
      const externalEventMap = new Map((externalEventsResult.data || []).map(e => [e.id, e]));

      return feedbackData.map(f => {
        const appointment = f.appointment_id ? appointmentMap.get(f.appointment_id) : null;
        const externalEvent = f.external_event_id ? externalEventMap.get(f.external_event_id) : null;
        const source = appointment || externalEvent;

        return {
          id: f.id,
          notes: f.notes || '',
          completed_at: f.completed_at,
          has_documents: f.has_documents || false,
          has_tasks: f.has_tasks || false,
          feedback_status: f.feedback_status,
          event_type: f.event_type,
          appointment_title: source?.title || null,
          appointment_start_time: source?.start_time || null,
        };
      });
    },
    enabled: !!currentTenant?.id && !!user?.id,
  });
};
