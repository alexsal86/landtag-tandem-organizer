import { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useAppointmentFeedback } from '@/hooks/useAppointmentFeedback';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { getCurrentTimeSlot, getCurrentDayOfWeek } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import {
  DEFAULT_SPECIAL_DAYS,
  getSpecialDayHint,
  parseSpecialDaysSetting,
  SpecialDay,
} from '@/utils/dashboard/specialDays';

interface AppointmentData {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  is_all_day: boolean;
}

export const DashboardAppointments = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const { appointments: feedbackAppointments, settings: feedbackSettings } = useAppointmentFeedback();

  const [userRole, setUserRole] = useState('');
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [completedTasksToday, setCompletedTasksToday] = useState(0);
  const [isShowingTomorrow, setIsShowingTomorrow] = useState(false);
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

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setUserRole(data?.role || ''));
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
        .neq('status', 'completed'),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
        .eq('status', 'completed').gte('updated_at', today.toISOString()),
    ]).then(([open, completed]) => {
      setOpenTasksCount(open.count || 0);
      setCompletedTasksToday(completed.count || 0);
    });
  }, [user]);

  useEffect(() => {
    const load = async () => {
      try {
        let query = supabase.from('app_settings').select('setting_value')
          .eq('setting_key', 'dashboard_special_day_hints').limit(1);
        query = currentTenant?.id ? query.eq('tenant_id', currentTenant.id) : query.is('tenant_id', null);
        const { data } = await query.maybeSingle();
        setSpecialDays(parseSpecialDaysSetting(data?.setting_value) || DEFAULT_SPECIAL_DAYS);
      } catch { setSpecialDays(DEFAULT_SPECIAL_DAYS); }
    };
    load();
  }, [currentTenant?.id]);

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
        id: e.id, title: e.title, start_time: e.start_time, end_time: e.end_time, is_all_day: e.all_day ?? false
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
        setAppointments(all.filter(e => {
          const ld = new Date(new Date(e.start_time).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
          return ld.toDateString() === tomorrowDate.toDateString();
        }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).slice(0, 4));
        setIsShowingTomorrow(true);
      } else {
        setAppointments(todayUpcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).slice(0, 4));
        setIsShowingTomorrow(false);
      }
      setIsLoading(false);
    };
    load();
  }, [user, currentTenant]);

  const timeSlot = getCurrentTimeSlot();
  const isLateDay = timeSlot === 'evening' || timeSlot === 'night';
  const useTomorrowTone = isShowingTomorrow || isLateDay;

  const hasPlenum = appointments.some(a => a.title.toLowerCase().includes('plenum'));
  const hasCommittee = appointments.some(a => a.title.toLowerCase().match(/ausschuss|ak\s/i));

  const contextMessage = useMemo(() => {
    return selectMessage({
      timeSlot,
      dayOfWeek: getCurrentDayOfWeek(),
      appointmentsCount: appointments.length,
      tasksCount: openTasksCount,
      completedTasks: completedTasksToday,
      isHoliday: false,
      month: new Date().getMonth() + 1,
      userRole,
      hasPlenum,
      hasCommittee,
      multipleSessions: (hasPlenum && hasCommittee),
    });
  }, [appointments, openTasksCount, completedTasksToday, userRole, hasPlenum, hasCommittee, timeSlot]);

  const getRoleLeadLine = () => {
    if (userRole === 'abgeordneter') {
      if (hasPlenum || hasCommittee) return useTomorrowTone
        ? 'Für morgen stehen zentrale politische Termine und klare Entscheidungen im Fokus.'
        : 'Heute stehen zentrale politische Termine und klare Entscheidungen im Fokus.';
      if (appointments.length === 0) return useTomorrowTone
        ? 'Für morgen gibt es Raum für strategische Vorbereitung und Gespräche im Wahlkreis.'
        : 'Heute gibt es Raum für strategische Vorbereitung und Gespräche im Wahlkreis.';
      return useTomorrowTone
        ? 'Für morgen liegt der Schwerpunkt auf Abstimmungen, Austausch und politischer Präsenz.'
        : 'Heute liegt der Schwerpunkt auf Abstimmungen, Austausch und politischer Präsenz.';
    }
    if (userRole === 'mitarbeiter') {
      if (appointments.length >= 4) return useTomorrowTone
        ? 'Für morgen zählt ein guter Takt zwischen Terminen, Rückmeldungen und Umsetzung.'
        : 'Heute zählt ein guter Takt zwischen Terminen, Rückmeldungen und Umsetzung.';
      if (openTasksCount >= 8) return useTomorrowTone
        ? 'Für morgen lohnt sich ein klarer Fokus auf Prioritäten und verlässliche Übergaben.'
        : 'Heute lohnt sich ein klarer Fokus auf Prioritäten und verlässliche Übergaben.';
      return useTomorrowTone
        ? 'Für morgen geht es um saubere Umsetzung und verlässliche Abstimmung im Alltag.'
        : 'Heute geht es um saubere Umsetzung und verlässliche Abstimmung im Alltag.';
    }
    if (userRole === 'bueroleitung') return useTomorrowTone
      ? 'Für morgen zählt ein klarer Überblick über Team, Fristen und Prioritäten.'
      : 'Heute zählt ein klarer Überblick über Team, Fristen und Prioritäten.';
    if (userRole === 'praktikant') return useTomorrowTone
      ? 'Morgen ist ein guter Tag, um dazuzulernen und Verantwortung zu übernehmen.'
      : 'Heute ist ein guter Tag, um dazuzulernen und Verantwortung zu übernehmen.';
    return null;
  };

  const specialDayHint = getSpecialDayHint(new Date(), specialDays);
  const roleLine = getRoleLeadLine();

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  return (
    <div className="space-y-4">
      {/* Rollenbasierte Zeile + kontextuelle Nachricht */}
      {(roleLine || contextMessage) && (
        <div className="text-sm text-muted-foreground space-y-1">
          {roleLine && <p className="italic">{roleLine}</p>}
          <p>{contextMessage.text}</p>
        </div>
      )}

      {/* Special Day */}
      {specialDayHint && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400 px-3 py-1.5 rounded text-sm text-foreground">
          {specialDayHint}
        </div>
      )}

      {/* Termine */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          📅 {isShowingTomorrow ? 'Deine Termine morgen' : 'Deine Termine heute'}
        </h3>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isShowingTomorrow ? 'Keine Termine morgen.' : 'Keine Termine heute.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {appointments.map(apt => (
              <div key={apt.id} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground font-mono text-xs w-12 shrink-0">
                  {apt.is_all_day ? 'Ganzt.' : format(new Date(apt.start_time), 'HH:mm', { locale: de })}
                </span>
                <span className="text-foreground truncate">{apt.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Reminder */}
      {feedbackReminderVisible && (
        <button
          type="button"
          onClick={() => navigate('/mywork?tab=appointmentfeedback')}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          🔔 {pendingFeedbackCount} offene{pendingFeedbackCount === 1 ? 's' : ''} Termin-Feedback{pendingFeedbackCount !== 1 ? 's' : ''} – jetzt bearbeiten
        </button>
      )}
    </div>
  );
};
