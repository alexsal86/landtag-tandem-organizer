import { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useAppointmentFeedback } from '@/hooks/useAppointmentFeedback';
import { getCurrentTimeSlot } from '@/utils/dashboard/timeUtils';
import {
  DEFAULT_SPECIAL_DAYS,
  parseSpecialDaysSetting,
  type SpecialDay,
} from '@/utils/dashboard/specialDays';

export interface AppointmentData {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  is_all_day: boolean;
}

export interface DashboardData {
  userName: string;
  userRole: string;
  appointments: AppointmentData[];
  isShowingTomorrow: boolean;
  openTasksCount: number;
  completedTasksToday: number;
  openTaskTitles: { id: string; title: string }[];
  specialDays: SpecialDay[];
  feedbackReminderVisible: boolean;
  pendingFeedbackCount: number;
  isLoading: boolean;
  tenantLoading: boolean;
  hasTenant: boolean;
}

export const useDashboardData = (): DashboardData => {
  const { user } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { appointments: feedbackAppointments, settings: feedbackSettings } = useAppointmentFeedback();

  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [isShowingTomorrow, setIsShowingTomorrow] = useState(false);
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [completedTasksToday, setCompletedTasksToday] = useState(0);
  const [openTaskTitles, setOpenTaskTitles] = useState<{ id: string; title: string }[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>(DEFAULT_SPECIAL_DAYS);
  const [isLoading, setIsLoading] = useState(true);

  const feedbackReminderVisible = useMemo(() => {
    if (!feedbackSettings?.reminder_start_time) return false;
    const currentTime = format(new Date(), 'HH:mm:ss');
    if (currentTime < feedbackSettings.reminder_start_time) return false;
    return (feedbackAppointments?.filter(a => a.feedback?.feedback_status === 'pending').length ?? 0) > 0;
  }, [feedbackSettings, feedbackAppointments]);

  const pendingFeedbackCount = useMemo(() => {
    return feedbackAppointments?.filter(a => a.feedback?.feedback_status === 'pending').length ?? 0;
  }, [feedbackAppointments]);

  // Load user profile + role
  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
    ]).then(([profileRes, roleRes]) => {
      setUserName(profileRes.data?.display_name || user.email?.split('@')[0] || 'Nutzer');
      setUserRole(roleRes.data?.role || '');
    });
  }, [user]);

  // Load task stats
  useEffect(() => {
    if (!user?.id) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
        .neq('status', 'completed'),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
        .eq('status', 'completed').gte('updated_at', today.toISOString()),
      supabase.from('tasks').select('id, title')
        .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
        .neq('status', 'completed')
        .order('due_date', { ascending: true, nullsFirst: false }),
    ]).then(([openRes, completedRes, titlesRes]) => {
      setOpenTasksCount(openRes.count || 0);
      setCompletedTasksToday(completedRes.count || 0);
      setOpenTaskTitles(
        (titlesRes.data || [])
          .filter(t => Boolean(t.title?.trim()))
          .map(t => ({ id: t.id, title: t.title!.trim() }))
      );
    });
  }, [user]);

  // Load special days
  useEffect(() => {
    const load = async () => {
      try {
        let query = supabase.from('app_settings').select('setting_value')
          .eq('setting_key', 'dashboard_special_day_hints').limit(1);
        query = currentTenant?.id ? query.eq('tenant_id', currentTenant.id) : query.is('tenant_id', null);
        const { data } = await query.maybeSingle();
        setSpecialDays(parseSpecialDaysSetting(data?.setting_value) || DEFAULT_SPECIAL_DAYS);
      } catch {
        setSpecialDays(DEFAULT_SPECIAL_DAYS);
      }
    };
    load();
  }, [currentTenant?.id]);

  // Load appointments (today + tomorrow fallback), no limit
  useEffect(() => {
    const load = async () => {
      if (!user?.id || !currentTenant?.id) return;
      const now = new Date();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const dayAfterTomorrow = new Date(today); dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const threeDaysAhead = new Date(today); threeDaysAhead.setDate(threeDaysAhead.getDate() + 3);

      const [{ data: normal }, { data: allDay }] = await Promise.all([
        supabase.from('appointments').select('id, title, start_time, end_time, is_all_day')
          .eq('tenant_id', currentTenant.id).eq('is_all_day', false)
          .gte('start_time', today.toISOString()).lt('start_time', dayAfterTomorrow.toISOString())
          .order('start_time', { ascending: true }),
        supabase.from('appointments').select('id, title, start_time, end_time, is_all_day')
          .eq('tenant_id', currentTenant.id).eq('is_all_day', true)
          .gte('start_time', yesterday.toISOString()).lt('start_time', threeDaysAhead.toISOString())
          .order('start_time', { ascending: true }),
      ]);

      const externalResult = await (supabase as any).from('external_events')
        .select('id, title, start_time, end_time, all_day, external_calendars!inner(tenant_id)')
        .eq('external_calendars.tenant_id', currentTenant.id)
        .gte('start_time', yesterday.toISOString()).lt('start_time', threeDaysAhead.toISOString())
        .order('start_time', { ascending: true });

      const external: AppointmentData[] = (externalResult.data || []).map((e: any) => ({
        id: e.id, title: e.title, start_time: e.start_time, end_time: e.end_time, is_all_day: e.all_day ?? false,
      }));

      const all = [...(normal || []), ...(allDay || []), ...external];

      const todayUpcoming = all.filter(event => {
        const localDate = new Date(new Date(event.start_time).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        if (localDate.toDateString() !== today.toDateString()) return false;
        if (event.is_all_day) return true;
        const endTime = event.end_time ? new Date(event.end_time) : new Date(new Date(event.start_time).getTime() + 3600000);
        return endTime > now;
      });

      if (todayUpcoming.length === 0) {
        const tomorrowDate = new Date(today); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        setAppointments(
          all.filter(e => {
            const ld = new Date(new Date(e.start_time).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
            return ld.toDateString() === tomorrowDate.toDateString();
          }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        );
        setIsShowingTomorrow(true);
      } else {
        setAppointments(
          todayUpcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        );
        setIsShowingTomorrow(false);
      }
      setIsLoading(false);
    };
    load();
  }, [user, currentTenant]);

  return {
    userName,
    userRole,
    appointments,
    isShowingTomorrow,
    openTasksCount,
    completedTasksToday,
    openTaskTitles,
    specialDays,
    feedbackReminderVisible,
    pendingFeedbackCount,
    isLoading,
    tenantLoading,
    hasTenant: !!currentTenant?.id,
  };
};
