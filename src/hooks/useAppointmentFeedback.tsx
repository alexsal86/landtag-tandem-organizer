import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { format } from 'date-fns';
import { toast } from './use-toast';
import { debugConsole } from '@/utils/debugConsole';
import type { ExternalCalendarSummary } from '@/components/meetings/types';
import type { AppointmentPreparation } from './useAppointmentPreparation';

export interface AppointmentWithFeedback {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  category?: string; // Optional for external events
  location: string | null;
  description: string | null;
  user_id: string;
  tenant_id: string;
  event_type: 'appointment' | 'external_event';
  feedback: {
    id: string;
    feedback_status: 'pending' | 'completed' | 'skipped';
    notes: string | null;
    has_documents: boolean;
    has_tasks: boolean;
    priority_score: number;
    reminder_dismissed: boolean;
    completed_at: string | null;
  } | null;
}

export interface FeedbackSettings {
  id: string;
  user_id: string;
  tenant_id: string;
  reminder_start_time: string;
  priority_categories: string[];
  show_all_appointments: boolean;
  auto_skip_internal: boolean;
}

interface AppointmentFeedbackRow {
  id: string;
  external_event_id: string | null;
  appointment_id: string | null;
  feedback_status: 'pending' | 'completed' | 'skipped';
  notes: string | null;
  has_documents: boolean | null;
  has_tasks: boolean | null;
  completed_at: string | null;
  user_id: string;
  tenant_id: string;
  event_type: 'appointment' | 'external_event';
  priority_score: number;
  reminder_dismissed: boolean | null;
}

interface ExternalEventWithCalendarRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  description: string | null;
  all_day: boolean | null;
  external_calendar_id: string | null;
  external_calendars: ExternalCalendarSummary | ExternalCalendarSummary[];
}

interface AppointmentFeedbackUpdate {
  feedback_status?: 'pending' | 'completed' | 'skipped';
  notes?: string;
  has_documents?: boolean;
  has_tasks?: boolean;
  completed_at?: string;
  reminder_dismissed?: boolean;
}

const extractExternalCalendar = (
  value: ExternalEventWithCalendarRow['external_calendars'],
): ExternalCalendarSummary | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

export const useAppointmentFeedback = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  // Lädt Termine mit Feedback (letzte 7 Tage)
  const { data: appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = useQuery({
    queryKey: ['appointment-feedback-appointments', user?.id, currentTenant?.id],
    queryFn: async () => {
      if (!user?.id || !currentTenant?.id) return [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = format(sevenDaysAgo, 'yyyy-MM-dd');
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          title,
          start_time,
          end_time,
          category,
          location,
          description,
          user_id,
          tenant_id,
          feedback:appointment_feedback(
            id,
            feedback_status,
            notes,
            has_documents,
            has_tasks,
            priority_score,
            reminder_dismissed,
            completed_at
          )
        `)
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .gte('start_time', `${sevenDaysAgoStr}T00:00:00`)
        .lte('end_time', now)
        .order('start_time', { ascending: false });

      if (error) throw error;

      // Transform data to match our interface
      return (data || []).map(apt => ({
        ...apt,
        event_type: 'appointment' as const,
        feedback: Array.isArray(apt.feedback) && apt.feedback.length > 0 
          ? apt.feedback[0] 
          : null
      })) as AppointmentWithFeedback[];
    },
    enabled: !!user?.id && !!currentTenant?.id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Lädt externe Events mit Feedback (letzte 7 Tage)
  const { data: externalEvents, isLoading: externalEventsLoading, refetch: refetchExternalEvents } = useQuery({
    queryKey: ['appointment-feedback-external', user?.id, currentTenant?.id],
    queryFn: async () => {
      if (!user?.id || !currentTenant?.id) return [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = format(sevenDaysAgo, 'yyyy-MM-dd');
      const now = new Date().toISOString();

      // 1. Lade ALLE externen Events der letzten 7 Tage
      const { data: externalEventsRaw, error: eventsError } = await supabase
        .from('external_events')
        .select(`
          id,
          title,
          start_time,
          end_time,
          location,
          description,
          all_day,
          external_calendar_id,
          external_calendars!inner(user_id, tenant_id)
        `)
        .eq('external_calendars.user_id', user.id)
        .eq('external_calendars.tenant_id', currentTenant.id)
        .gte('start_time', `${sevenDaysAgoStr}T00:00:00`)
        .lte('end_time', now)
        .order('start_time', { ascending: false });

      if (eventsError) {
        debugConsole.error('Error fetching external events:', eventsError);
        return [];
      }

      if (!externalEventsRaw || externalEventsRaw.length === 0) return [];

      // 2. Lade existierende Feedback-Einträge für diese Events
      const eventIds = externalEventsRaw.map(e => e.id);
      const { data: feedbackData } = await supabase
        .from('appointment_feedback')
        .select('id, external_event_id, appointment_id, feedback_status, notes, has_documents, has_tasks, completed_at, user_id, tenant_id, event_type, priority_score, reminder_dismissed')
        .in('external_event_id', eventIds);

      // 3. Finde Events ohne Feedback
      const feedbackMap = new Map<string, AppointmentFeedbackRow>(
        (feedbackData as AppointmentFeedbackRow[] | null)?.flatMap((feedback) =>
          feedback.external_event_id ? [[feedback.external_event_id, feedback] as const] : [],
        ) || [],
      );
      const eventsWithoutFeedback = externalEventsRaw.filter(e => !feedbackMap.has(e.id));

      // 4. Erstelle Feedback-Einträge für Events ohne Feedback
      if (eventsWithoutFeedback.length > 0) {
        const newFeedbackEntries = eventsWithoutFeedback.map(event => ({
          external_event_id: event.id,
          user_id: user.id,
          tenant_id: currentTenant.id,
          event_type: 'external_event',
          feedback_status: 'pending',
          priority_score: 1
        }));

        const { data: newFeedback, error: insertError } = await supabase
          .from('appointment_feedback')
          .insert(newFeedbackEntries)
          .select();

        if (!insertError && newFeedback) {
          // Füge neue Feedback-Einträge zur Map hinzu
          newFeedback.forEach(f => feedbackMap.set(f.external_event_id, f));
        }
      }

      // 5. Transform zu AppointmentWithFeedback Interface
      return (externalEventsRaw as ExternalEventWithCalendarRow[]).map((event) => {
        const calendar = extractExternalCalendar(event.external_calendars);
        const feedback = feedbackMap.get(event.id);
        return {
          id: event.id,
          title: event.title,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          description: event.description,
          user_id: calendar?.user_id ?? user.id,
          tenant_id: calendar?.tenant_id ?? currentTenant.id,
          event_type: 'external_event' as const,
          feedback: feedback ? {
            id: feedback.id,
            feedback_status: feedback.feedback_status,
            notes: feedback.notes,
            completed_at: feedback.completed_at,
            priority_score: feedback.priority_score,
            has_documents: feedback.has_documents || false,
            has_tasks: feedback.has_tasks || false,
            reminder_dismissed: feedback.reminder_dismissed || false,
          } : null
        };
      }) as AppointmentWithFeedback[];
    },
    enabled: !!user?.id && !!currentTenant?.id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Kombiniere und sortiere alle Events
  const allEvents = React.useMemo(() => {
    const combined = [
      ...(appointments || []),
      ...(externalEvents || [])
    ];
    return combined.sort((a, b) => 
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );
  }, [appointments, externalEvents]);

  // Lade Preparations für interne Termine
  const appointmentIds = React.useMemo(() => {
    return (appointments || []).map(a => a.id);
  }, [appointments]);

  const { data: preparationsMap } = useQuery({
    queryKey: ['appointment-feedback-preparations', appointmentIds],
    queryFn: async () => {
      if (appointmentIds.length === 0) return new Map<string, AppointmentPreparation>();

      const { data, error } = await supabase
        .from('appointment_preparations')
        .select('*')
        .in('appointment_id', appointmentIds)
        .eq('is_archived', false);

      if (error) {
        debugConsole.error('Error fetching preparations for feedback:', error);
        return new Map<string, AppointmentPreparation>();
      }

      const map = new Map<string, AppointmentPreparation>();
      for (const row of data || []) {
        const prep: AppointmentPreparation = {
          id: row.id,
          title: row.title,
          status: row.status,
          notes: row.notes,
          appointment_id: row.appointment_id,
          template_id: row.template_id,
          tenant_id: row.tenant_id,
          created_by: row.created_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          is_archived: row.is_archived,
          archived_at: row.archived_at,
          preparation_data: (row.preparation_data as AppointmentPreparation['preparation_data']) ?? {},
          checklist_items: (row.checklist_items as AppointmentPreparation['checklist_items']) ?? [],
        };
        map.set(row.appointment_id, prep);
      }
      return map;
    },
    enabled: appointmentIds.length > 0,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const isLoading = appointmentsLoading || externalEventsLoading;

  // Lade Settings
  const { data: settings } = useQuery({
    queryKey: ['appointment-feedback-settings', user?.id],
    queryFn: async () => {
      if (!user?.id || !currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('appointment_feedback_settings')
        .select('id, user_id, tenant_id, reminder_start_time, priority_categories, show_all_appointments, auto_skip_internal')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      // Default-Settings wenn keine vorhanden
      if (!data) {
        const defaultSettings = {
          user_id: user.id,
          tenant_id: currentTenant.id,
          reminder_start_time: '17:00:00',
          priority_categories: ['extern', 'wichtig'],
          show_all_appointments: true,
          auto_skip_internal: false
        };

        const { data: newSettings, error: insertError } = await supabase
          .from('appointment_feedback_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (insertError) throw insertError;
        return newSettings as FeedbackSettings;
      }

      return data as FeedbackSettings;
    },
    enabled: !!user?.id && !!currentTenant?.id,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Update Feedback Mutation
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ 
      feedbackId, 
      updates 
    }: { 
      feedbackId: string; 
      updates: AppointmentFeedbackUpdate 
    }) => {
      const updateData: AppointmentFeedbackUpdate & { updated_at: string } = { ...updates, updated_at: new Date().toISOString() };
      
      if (updates.feedback_status === 'completed' && !updates.completed_at) {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('appointment_feedback')
        .update(updateData)
        .eq('id', feedbackId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-external'] });
    },
    onError: (error) => {
      debugConsole.error('Error updating feedback:', error);
      toast({
        title: 'Fehler',
        description: 'Feedback konnte nicht aktualisiert werden.',
        variant: 'destructive'
      });
    }
  });

  // Create Feedback Entry
  const createFeedbackMutation = useMutation({
    mutationFn: async ({ 
      appointmentId,
      priorityScore = 0
    }: { 
      appointmentId: string;
      priorityScore?: number;
    }) => {
      if (!user?.id || !currentTenant?.id) throw new Error('User or tenant not found');

      const { error } = await supabase
        .from('appointment_feedback')
        .insert([{
          appointment_id: appointmentId,
          user_id: user.id,
          tenant_id: currentTenant.id,
          feedback_status: 'pending',
          priority_score: priorityScore
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-external'] });
    }
  });

  // Update Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<FeedbackSettings>) => {
      if (!settings?.id) throw new Error('Settings not found');

      const { error } = await supabase
        .from('appointment_feedback_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', settings.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-settings'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-feedback-external'] });
      toast({
        title: 'Einstellungen gespeichert',
        description: 'Ihre Einstellungen wurden erfolgreich aktualisiert.'
      });
    },
    onError: (error) => {
      debugConsole.error('Error updating settings:', error);
      toast({
        title: 'Fehler',
        description: 'Einstellungen konnten nicht gespeichert werden.',
        variant: 'destructive'
      });
    }
  });

  const refetch = React.useCallback(() => {
    refetchAppointments();
    refetchExternalEvents();
  }, [refetchAppointments, refetchExternalEvents]);

  // Anzahl der offenen Feedbacks
  const pendingFeedbackCount = React.useMemo(() => {
    return allEvents.filter(event => 
      event.feedback?.feedback_status === 'pending'
    ).length;
  }, [allEvents]);

  return {
    appointments: allEvents,
    settings,
    isLoading,
    updateFeedback: updateFeedbackMutation.mutateAsync,
    createFeedback: createFeedbackMutation.mutateAsync,
    updateSettings: updateSettingsMutation.mutateAsync,
    refetch,
    pendingFeedbackCount,
  };
};
