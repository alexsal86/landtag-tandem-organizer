import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { format } from 'date-fns';
import { toast } from './use-toast';

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
    enabled: !!user?.id && !!currentTenant?.id
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

      // Hole Feedback-Einträge für externe Events
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('appointment_feedback')
        .select(`
          id,
          feedback_status,
          notes,
          completed_at,
          priority_score,
          has_documents,
          has_tasks,
          reminder_dismissed,
          external_event_id,
          external_events!inner(
            id,
            title,
            start_time,
            end_time,
            location,
            description,
            all_day,
            external_calendar_id,
            external_calendars!inner(user_id, tenant_id)
          )
        `)
        .eq('event_type', 'external_event')
        .eq('user_id', user.id)
        .gte('external_events.start_time', `${sevenDaysAgoStr}T00:00:00`)
        .lte('external_events.end_time', now)
        .order('external_events.start_time', { ascending: false });

      if (feedbackError) {
        console.error('Error fetching external events feedback:', feedbackError);
        return [];
      }

      // Transform zu AppointmentWithFeedback Interface
      return (feedbackData || []).map(fb => {
        const event = fb.external_events;
        return {
          id: event.id,
          title: event.title,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          description: event.description,
          user_id: event.external_calendars.user_id,
          tenant_id: event.external_calendars.tenant_id,
          event_type: 'external_event' as const,
          feedback: {
            id: fb.id,
            feedback_status: fb.feedback_status,
            notes: fb.notes,
            completed_at: fb.completed_at,
            priority_score: fb.priority_score,
            has_documents: fb.has_documents,
            has_tasks: fb.has_tasks,
            reminder_dismissed: fb.reminder_dismissed,
          }
        };
      }) as AppointmentWithFeedback[];
    },
    enabled: !!user?.id && !!currentTenant?.id
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

  const isLoading = appointmentsLoading || externalEventsLoading;

  // Lade Settings
  const { data: settings } = useQuery({
    queryKey: ['appointment-feedback-settings', user?.id],
    queryFn: async () => {
      if (!user?.id || !currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('appointment_feedback_settings')
        .select('*')
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
    enabled: !!user?.id && !!currentTenant?.id
  });

  // Update Feedback Mutation
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ 
      feedbackId, 
      updates 
    }: { 
      feedbackId: string; 
      updates: Partial<{
        feedback_status: 'pending' | 'completed' | 'skipped';
        notes: string;
        has_documents: boolean;
        has_tasks: boolean;
        completed_at: string;
        reminder_dismissed: boolean;
      }> 
    }) => {
      const updateData: any = { ...updates, updated_at: new Date().toISOString() };
      
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
      console.error('Error updating feedback:', error);
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
        .insert({
          appointment_id: appointmentId,
          user_id: user.id,
          tenant_id: currentTenant.id,
          feedback_status: 'pending',
          priority_score: priorityScore
        });

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
      toast({
        title: 'Einstellungen gespeichert',
        description: 'Ihre Einstellungen wurden erfolgreich aktualisiert.'
      });
    },
    onError: (error) => {
      console.error('Error updating settings:', error);
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

  return {
    appointments: allEvents,
    settings,
    isLoading,
    updateFeedback: updateFeedbackMutation.mutateAsync,
    createFeedback: createFeedbackMutation.mutateAsync,
    updateSettings: updateSettingsMutation.mutateAsync,
    refetch,
  };
};
