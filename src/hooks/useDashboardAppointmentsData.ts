import { isDashboardBirthday, occursOnDay } from "@/utils/dashboard/occasions";
import { berlinDay, hasAppointmentEnded } from "@/utils/dashboard/daySummary";
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime';
import { STALE_TIME } from '@/lib/query-cache';
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
type AppointmentLocationRow = Pick<Database['public']['Tables']['appointments']['Row'], 'id' | 'location' | 'category'>;

const isDashboardRpcResult = (value: unknown): value is DashboardRpcResult => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return 'display_name' in candidate && 'role' in candidate;
};

export interface DashboardData {
  userName: string;
  userRole: string;
  appointments: AppointmentData[];
  nextAppointment?: AppointmentData;
  isShowingTomorrow: boolean;
  /** Filled when only one appointment remains today, so the next day can be previewed. */
  tomorrowAppointments: AppointmentData[];
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
  nextAppointment?: AppointmentData;
  isShowingTomorrow: boolean;
  /** Filled when only one appointment remains today, so the next day can be previewed. */
  tomorrowAppointments: AppointmentData[];
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

export const fetchDashboardRpc = async (userId: string, userEmail: string | undefined, tenantId: string, includePastToday = false): Promise<DashboardRpcData & { failedSources: string[] }> => {
  const { data, error } = await supabase.rpc('get_dashboard_data', {
    p_user_id: userId,
    p_tenant_id: tenantId,
  });

  if (error) throw error;

  if (!isDashboardRpcResult(data)) {
    throw new Error('Unexpected dashboard RPC response');
  }

  const rpcResult = data;
  // Teilausfälle werden gesammelt, statt die ganze Terminkachel in den Fehlerzustand
  // zu schicken: interne Termine bleiben sichtbar, fehlende Quellen werden benannt.
  const failedSources = new Set<string>();
  const userName = rpcResult.display_name || userEmail?.split('@')[0] || 'Nutzer';
  const userRole = rpcResult.role || '';
  const openTasksCount = rpcResult.open_tasks_count ?? 0;
  const completedTasksToday = rpcResult.completed_today ?? 0;
  const openTaskTitles = rpcResult.open_task_titles ?? [];

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrowDay = new Date(Date.parse(berlinDay(now) + "T12:00:00Z") + 86400_000).toISOString().slice(0, 10);

  // Ein Ladefehler der externen Kalender darf nicht als "keine externen Termine"
  // durchgehen: er wird als Teilausfall gemeldet, während interne Termine sichtbar
  // bleiben. Ein Büro ohne verbundene Kalender ist dagegen kein Fehler, es kommen
  // schlicht keine Zeilen zurück.
  const externalResult = await supabase.from('external_events')
    .select('id, title, start_time, end_time, all_day, location, external_calendars!inner(tenant_id)')
    .eq('external_calendars.tenant_id', tenantId)
    .gte('end_time', new Date(today.getTime() - 86400000).toISOString())
    .lt('start_time', new Date(today.getTime() + 3 * 86400000).toISOString())
    .order('start_time', { ascending: true });

  if (externalResult.error) failedSources.add('Externe Kalender');

  const externalAppointments: AppointmentData[] = (externalResult.data as ExternalEventRow[] | null ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    start_time: event.start_time,
    end_time: event.end_time,
    is_all_day: event.all_day ?? false,
    location: event.location ?? undefined,
  }));

  const rpcAppointments = rpcResult.appointments ?? [];
  const appointmentIds = rpcAppointments
    .map((appointment) => appointment.id);

  let locationByAppointmentId = new Map<string, string>();
  const birthdayIds = new Set<string>();
  if (appointmentIds.length > 0) {
    const { data: appointmentLocations, error: metadataError } = await supabase
      .from('appointments')
      .select('id, location, category')
      .in('id', appointmentIds)
      .eq('tenant_id', tenantId);

    if (metadataError) {
      // Nur Ort und Geburtstags-Kennzeichnung fehlen; die Termine selbst bleiben sichtbar.
      failedSources.add('Termindetails');
    }
    for (const row of appointmentLocations ?? []) {
      if (isDashboardBirthday(row)) birthdayIds.add(row.id);
    }
    locationByAppointmentId = new Map(
      ((appointmentLocations as AppointmentLocationRow[] | null) ?? [])
        .filter((appointment) => appointment.location?.trim())
        .map((appointment) => [appointment.id, appointment.location!.trim()])
    );
  }

  const normalizedAppointments = rpcAppointments.filter(appointment => !birthdayIds.has(appointment.id)).map((appointment) => ({
    ...appointment,
    location: appointment.location?.trim() || locationByAppointmentId.get(appointment.id),
  }));

  // Fetch the next actual appointment independently of the short dashboard RPC window.
  const [nextInternal, nextExternal, ongoingAllDay] = await Promise.all([
    supabase.from('appointments').select('id,title,start_time,end_time,is_all_day,location')
      .eq('tenant_id', tenantId).or('category.is.null,category.neq.birthday').gte('start_time', now.toISOString())
      .not('status', 'in', '(cancelled,canceled)').order('start_time').limit(1),
    supabase.from('external_events').select('id,title,start_time,end_time,all_day,location,external_calendars!inner(tenant_id)')
      .eq('external_calendars.tenant_id', tenantId).gte('start_time', now.toISOString()).order('start_time').limit(1),
    supabase.from('appointments').select('id,title,start_time,end_time,is_all_day,location')
      .eq('tenant_id', tenantId).or('category.is.null,category.neq.birthday').eq('is_all_day', true).lte('start_time', now.toISOString())
      .gt('end_time', now.toISOString()).not('status', 'in', '(cancelled,canceled)'),
  ]);
  if (ongoingAllDay.error) failedSources.add('Laufende Termine');
  if (nextInternal.error) failedSources.add('Folgetermine');
  if (nextExternal.error) failedSources.add('Externe Kalender');
  const future: AppointmentData[] = [
    ...(nextInternal.data ?? []).map(e => ({ ...e, is_all_day: e.is_all_day ?? false, end_time: e.end_time ?? undefined, location: e.location ?? undefined })),
    ...(nextExternal.data ?? []).map(e => ({ ...e, is_all_day: e.all_day ?? false, end_time: e.end_time ?? undefined, location: e.location ?? undefined })),
  ];
  const all = [...new Map([...normalizedAppointments, ...externalAppointments,
    ...(ongoingAllDay.data ?? []).map(e => ({ ...e, is_all_day: true, end_time: e.end_time ?? undefined, location: e.location ?? undefined }))
  ].map(e => [e.id, e])).values()];
  const nextAppointment = [...all, ...future].filter(e => Date.parse(e.start_time) > now.getTime())
    .sort((a,b) => Date.parse(a.start_time)-Date.parse(b.start_time))[0];

  const todayAll = all.filter(event => occursOnDay(event, berlinDay(now)))
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  const todayUpcoming = todayAll.filter(event => !hasAppointmentEnded(event, now));

  let appointments: AppointmentData[];
  let isShowingTomorrow: boolean;
  let tomorrowAppointments: AppointmentData[] = [];
  const tomorrowAll = all.filter(e => {
    return occursOnDay(e, tomorrowDay);
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  if (includePastToday && todayAll.length > 0) {
    appointments = todayAll;
    isShowingTomorrow = false;
    if (todayUpcoming.length <= 1) tomorrowAppointments = tomorrowAll;
  } else if (todayUpcoming.length === 0) {
    appointments = tomorrowAll;
    isShowingTomorrow = true;
  } else {
    appointments = todayUpcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    isShowingTomorrow = false;
    if (appointments.length === 1) tomorrowAppointments = tomorrowAll;
  }

  return { userName, userRole, appointments, nextAppointment, isShowingTomorrow, tomorrowAppointments, openTasksCount, completedTasksToday, openTaskTitles, failedSources: [...failedSources] };
};

export const useDashboardAppointmentsData = (includePastToday = false): DashboardData & { isError: boolean; refetch: () => void; failedSources: string[] } => {
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

  useDashboardRealtime(userId, tenantId);

  const { data: rpcData, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-rpc-data', userId, tenantId, includePastToday],
    queryFn: () => fetchDashboardRpc(userId!, user!.email ?? undefined, tenantId!, includePastToday),
    enabled: !!userId && !!tenantId,
    staleTime: STALE_TIME.LIST_WITH_REALTIME,
    // Bleibt bewusst: get_dashboard_data schneidet sein Zeitfenster mit now() (gestern bis
    // übermorgen) und zählt completed_today ab. Realtime meldet nur Zeilenänderungen, nie den
    // Tageswechsel; profiles und user_roles aus der RPC stehen zudem nicht in der
    // Invalidation-Map von useDashboardRealtime.
    refetchInterval: includePastToday ? STALE_TIME.LIST_WITH_REALTIME : false,
    refetchIntervalInBackground: false,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  const pendingFeedbackCount = useMemo(() => {
    return feedbackAppointments?.filter(a => a.feedback?.feedback_status === 'pending').length ?? 0;
  }, [feedbackAppointments]);

  return {
    userName: rpcData?.userName ?? '',
    userRole: rpcData?.userRole ?? '',
    appointments: rpcData?.appointments ?? [],
    nextAppointment: rpcData?.nextAppointment,
    isShowingTomorrow: rpcData?.isShowingTomorrow ?? false,
    tomorrowAppointments: rpcData?.tomorrowAppointments ?? [],
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
    refetch,
    failedSources: rpcData?.failedSources ?? [],
  };
};
