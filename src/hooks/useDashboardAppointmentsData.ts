import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useAppointmentFeedback } from '@/hooks/useAppointmentFeedback';
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
  location?: string;
}

type DashboardRpcResult = {
  display_name: string | null;
  role: string | null;
  open_tasks_count: number | null;
  completed_today: number | null;
  open_task_titles: { id: string; title: string }[] | null;
  appointments: AppointmentData[] | null;
};

type ExternalEventRow = Pick<Database['public']['Tables']['external_events']['Row'], 'id' | 'title' | 'start_time' | 'end_time' | 'all_day' | 'location'>;
type AppointmentLocationRow = Pick<Database['public']['Tables']['appointments']['Row'], 'id' | 'location'>;

const isDashboardRpcResult = (value: unknown): value is DashboardRpcResult => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return 'display_name' in candidate && 'role' in candidate;
};

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

interface DashboardRpcData {
  userName: string;
  userRole: string;
  appointments: AppointmentData[];
  isShowingTomorrow: boolean;
  openTasksCount: number;
  completedTasksToday: number;
  openTaskTitles: { id: string; title: string }[];
}

export const fetchSpecialDays = async (tenantId: string | undefined): Promise<SpecialDay[]> => {
  try {
    let query = supabase.from('app_settings').select('setting_value')
      .eq('setting_key', 'dashboard_special_day_hints').limit(1);
    query = tenantId ? query.eq('tenant_id', tenantId) : query.is('tenant_id', null);
    const { data } = await query.maybeSingle();
    return parseSpecialDaysSetting(data?.setting_value) || DEFAULT_SPECIAL_DAYS;
  } catch {
    return DEFAULT_SPECIAL_DAYS;
  }
};

export const fetchDashboardRpc = async (userId: string, userEmail: string | undefined, tenantId: string): Promise<DashboardRpcData> => {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_data', {
      p_user_id: userId,
      p_tenant_id: tenantId,
    });

    if (error) throw error;

    if (!isDashboardRpcResult(data)) {
      throw new Error('Unexpected dashboard RPC response');
    }

    const rpcResult = data;
    const userName = rpcResult.display_name || userEmail?.split('@')[0] || 'Nutzer';
    const userRole = rpcResult.role || '';
    const openTasksCount = rpcResult.open_tasks_count ?? 0;
    const completedTasksToday = rpcResult.completed_today ?? 0;
    const openTaskTitles = rpcResult.open_task_titles ?? [];

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrowDate = new Date(today);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    let externalAppointments: AppointmentData[] = [];
    try {
      const externalResult = await supabase.from('external_events')
        .select('id, title, start_time, end_time, all_day, location, external_calendars!inner(tenant_id)')
        .eq('external_calendars.tenant_id', tenantId)
        .gte('start_time', new Date(today.getTime() - 86400000).toISOString())
        .lt('start_time', new Date(today.getTime() + 3 * 86400000).toISOString())
        .order('start_time', { ascending: true });

      externalAppointments = (externalResult.data as ExternalEventRow[] | null ?? []).map((event) => ({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        is_all_day: event.all_day ?? false,
        location: event.location ?? undefined,
      }));
    } catch {
      // external events are optional
    }

    const rpcAppointments = rpcResult.appointments ?? [];
    const appointmentIdsWithoutLocation = rpcAppointments
      .filter((appointment) => !appointment.location?.trim())
      .map((appointment) => appointment.id);

    let locationByAppointmentId = new Map<string, string>();
    if (appointmentIdsWithoutLocation.length > 0) {
      const { data: appointmentLocations } = await supabase
        .from('appointments')
        .select('id, location')
        .in('id', appointmentIdsWithoutLocation)
        .eq('tenant_id', tenantId);

      locationByAppointmentId = new Map(
        ((appointmentLocations as AppointmentLocationRow[] | null) ?? [])
          .filter((appointment) => appointment.location?.trim())
          .map((appointment) => [appointment.id, appointment.location!.trim()])
      );
    }

    const normalizedAppointments = rpcAppointments.map((appointment) => ({
      ...appointment,
      location: appointment.location?.trim() || locationByAppointmentId.get(appointment.id),
    }));

    const all = [...normalizedAppointments, ...externalAppointments];

    const todayUpcoming = all.filter(event => {
      const localDate = new Date(new Date(event.start_time).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      if (localDate.toDateString() !== today.toDateString()) return false;
      if (event.is_all_day) return true;
      const endTime = event.end_time ? new Date(event.end_time) : new Date(new Date(event.start_time).getTime() + 3600000);
      return endTime > now;
    });

    let appointments: AppointmentData[];
    let isShowingTomorrow: boolean;

    if (todayUpcoming.length === 0) {
      appointments = all.filter(e => {
        const localDate = new Date(new Date(e.start_time).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        return localDate.toDateString() === tomorrowDate.toDateString();
      }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      isShowingTomorrow = true;
    } else {
      appointments = todayUpcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      isShowingTomorrow = false;
    }

    return { userName, userRole, appointments, isShowingTomorrow, openTasksCount, completedTasksToday, openTaskTitles };
  } catch {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);
      return {
        userName: profileRes.data?.display_name || userEmail?.split('@')[0] || 'Nutzer',
        userRole: roleRes.data?.role || '',
        appointments: [],
        isShowingTomorrow: false,
        openTasksCount: 0,
        completedTasksToday: 0,
        openTaskTitles: [],
      };
    } catch {
      return { userName: 'Nutzer', userRole: '', appointments: [], isShowingTomorrow: false, openTasksCount: 0, completedTasksToday: 0, openTaskTitles: [] };
    }
  }
};

export const useDashboardAppointmentsData = (): DashboardData & { isError: boolean } => {
  const { user } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { appointments: feedbackAppointments } = useAppointmentFeedback();

  const userId = user?.id;
  const tenantId = currentTenant?.id;

  const { data: specialDays = DEFAULT_SPECIAL_DAYS } = useQuery({
    queryKey: ['dashboard-special-days', tenantId],
    queryFn: () => fetchSpecialDays(tenantId),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: rpcData, isLoading, isError } = useQuery({
    queryKey: ['dashboard-rpc-data', userId, tenantId],
    queryFn: () => fetchDashboardRpc(userId!, user!.email ?? undefined, tenantId!),
    enabled: !!userId && !!tenantId,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const pendingFeedbackCount = useMemo(() => {
    return feedbackAppointments?.filter(a => a.feedback?.feedback_status === 'pending').length ?? 0;
  }, [feedbackAppointments]);

  return {
    userName: rpcData?.userName ?? '',
    userRole: rpcData?.userRole ?? '',
    appointments: rpcData?.appointments ?? [],
    isShowingTomorrow: rpcData?.isShowingTomorrow ?? false,
    openTasksCount: rpcData?.openTasksCount ?? 0,
    completedTasksToday: rpcData?.completedTasksToday ?? 0,
    openTaskTitles: rpcData?.openTaskTitles ?? [],
    specialDays,
    feedbackReminderVisible: pendingFeedbackCount > 0,
    pendingFeedbackCount,
    isLoading,
    tenantLoading,
    hasTenant: !!tenantId,
    isError,
  };
};
