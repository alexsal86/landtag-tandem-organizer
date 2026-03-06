import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useAppointmentFeedback } from '@/hooks/useAppointmentFeedback';
import { getCurrentTimeSlot, getCurrentDayOfWeek, getGreeting } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import { getWeather, translateCondition, getWeatherIcon } from '@/utils/dashboard/weatherApi';
import {
  DEFAULT_SPECIAL_DAYS,
  getSpecialDayHint,
  parseSpecialDaysSetting,
  SpecialDay
} from '@/utils/dashboard/specialDays';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface AppointmentData {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  is_all_day: boolean;
}

export const DashboardGreetingSection = () => {
  const { user } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const { appointments: feedbackAppointments, settings: feedbackSettings } = useAppointmentFeedback();

  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [weatherKarlsruhe, setWeatherKarlsruhe] = useState<{ temp: number; condition: string; icon: string } | null>(null);
  const [weatherStuttgart, setWeatherStuttgart] = useState<{ temp: number; condition: string; icon: string } | null>(null);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [completedTasksToday, setCompletedTasksToday] = useState(0);
  const [isShowingTomorrow, setIsShowingTomorrow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>(DEFAULT_SPECIAL_DAYS);

  // Feedback-Reminder: zeitgesteuert + offene Feedbacks
  const feedbackReminderVisible = useMemo(() => {
    if (!feedbackSettings?.reminder_start_time) return false;
    const currentTime = format(new Date(), 'HH:mm:ss');
    if (currentTime < feedbackSettings.reminder_start_time) return false;
    return (feedbackAppointments?.filter(a => a.feedback?.feedback_status === 'pending').length ?? 0) > 0;
  }, [feedbackSettings, feedbackAppointments]);

  const pendingFeedbackCount = useMemo(() => {
    return feedbackAppointments?.filter(a => a.feedback?.feedback_status === 'pending').length ?? 0;
  }, [feedbackAppointments]);

  // Load user name
  useEffect(() => {
    const loadUserName = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setUserName(data?.display_name || user.email?.split('@')[0] || 'Nutzer');
      setUserRole(roleData?.role || '');
    };
    
    loadUserName();
  }, [user]);

  // Load weather data
  useEffect(() => {
    const loadWeather = async () => {
      const karlsruhe = await getWeather(49.0069, 8.4037); // Karlsruhe
      const stuttgart = await getWeather(48.7758, 9.1829); // Stuttgart
      
      if (karlsruhe) {
        setWeatherKarlsruhe({
          temp: karlsruhe.temperature,
          condition: karlsruhe.condition,
          icon: karlsruhe.icon
        });
      }
      
      if (stuttgart) {
        setWeatherStuttgart({
          temp: stuttgart.temperature,
          condition: stuttgart.condition,
          icon: stuttgart.icon
        });
      }
    };
    
    loadWeather();
  }, []);

  useEffect(() => {
    const loadSpecialDays = async () => {
      try {
        let query = supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'dashboard_special_day_hints')
          .limit(1);

        query = currentTenant?.id
          ? query.eq('tenant_id', currentTenant.id)
          : query.is('tenant_id', null);

        const { data } = await query.maybeSingle();

        const parsedDays = parseSpecialDaysSetting(data?.setting_value);
        setSpecialDays(parsedDays || DEFAULT_SPECIAL_DAYS);
      } catch (error) {
        console.error('Error loading dashboard special day hints:', error);
        setSpecialDays(DEFAULT_SPECIAL_DAYS);
      }
    };

    loadSpecialDays();
  }, [currentTenant?.id]);

  // Load task stats for contextual greeting
  useEffect(() => {
    const loadTaskStats = async () => {
      if (!user?.id) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [{ count: openCount }, { count: completedTodayCount }] = await Promise.all([
        supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
          .neq('status', 'completed'),
        supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
          .eq('status', 'completed')
          .gte('updated_at', today.toISOString()),
      ]);

      setOpenTasksCount(openCount || 0);
      setCompletedTasksToday(completedTodayCount || 0);
    };

    loadTaskStats();
  }, [user]);

  // Load today's and tomorrow's appointments
  useEffect(() => {
    const loadAppointments = async () => {
      if (!user?.id || !currentTenant?.id) return;
      
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      
      // Erweiterte Zeitfenster für Ganztagstermine (UTC-Probleme)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const threeDaysAhead = new Date(today);
      threeDaysAhead.setDate(threeDaysAhead.getDate() + 3);
      
      // Normale Termine für heute und morgen
      const { data: normalAppointments } = await supabase
        .from('appointments')
        .select('id, title, start_time, end_time, is_all_day')
        .eq('tenant_id', currentTenant.id)
        .eq('is_all_day', false)
        .gte('start_time', today.toISOString())
        .lt('start_time', dayAfterTomorrow.toISOString())
        .order('start_time', { ascending: true });
      
      // Ganztagstermine (größeres Zeitfenster wegen UTC)
      const { data: allDayAppointments } = await supabase
        .from('appointments')
        .select('id, title, start_time, end_time, is_all_day')
        .eq('tenant_id', currentTenant.id)
        .eq('is_all_day', true)
        .gte('start_time', yesterday.toISOString())
        .lt('start_time', threeDaysAhead.toISOString())
        .order('start_time', { ascending: true });
      
      // Externe Kalender-Events (type-safe cast to avoid deep instantiation)
      const externalEventsResult = await (supabase as any)
        .from('external_events')
        .select(`
          id,
          title,
          start_time,
          end_time,
          all_day,
          external_calendars!inner(tenant_id)
        `)
        .eq('external_calendars.tenant_id', currentTenant.id)
        .gte('start_time', yesterday.toISOString())
        .lt('start_time', threeDaysAhead.toISOString())
        .order('start_time', { ascending: true });
      
      // Map external events to AppointmentData type
      const externalEventsFormatted: AppointmentData[] = (externalEventsResult.data || []).map((e: any) => ({
        id: e.id as string,
        title: e.title as string,
        start_time: e.start_time as string,
        end_time: e.end_time as string | undefined,
        is_all_day: (e.all_day as boolean) ?? false
      }));
      
      // Alle Events kombinieren
      const allEvents: AppointmentData[] = [
        ...(normalAppointments || []),
        ...(allDayAppointments || []),
        ...externalEventsFormatted
      ];
      
      // Schritt 1: Kommende Termine von heute finden
      const todayUpcoming = allEvents.filter(event => {
        const eventDate = new Date(event.start_time);
        const localDate = new Date(eventDate.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        
        // Muss heute sein
        if (localDate.toDateString() !== today.toDateString()) return false;
        
        // Für Ganztagstermine: Immer anzeigen
        if (event.is_all_day) return true;
        
        // Für normale Termine: Nur wenn noch nicht vorbei
        // Event gilt als "vorbei" wenn end_time < jetzt (oder start_time + 1h falls keine end_time)
        const endTime = event.end_time 
          ? new Date(event.end_time) 
          : new Date(new Date(event.start_time).getTime() + 60 * 60 * 1000); // +1h default
        
        return endTime > now;
      });
      
      // Schritt 2: Falls keine kommenden Termine heute, nehme Termine von morgen
      let finalAppointments: AppointmentData[];
      let showingTomorrow = false;
      
      if (todayUpcoming.length === 0) {
        // Zeige Termine von morgen
        const tomorrowDate = new Date(today);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        
        finalAppointments = allEvents
          .filter(event => {
            const eventDate = new Date(event.start_time);
            const localDate = new Date(eventDate.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
            return localDate.toDateString() === tomorrowDate.toDateString();
          })
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .slice(0, 2);
        
        showingTomorrow = true;
      } else {
        // Zeige heutige kommende Termine
        finalAppointments = todayUpcoming
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .slice(0, 2);
      }
      
      setAppointments(finalAppointments);
      setIsShowingTomorrow(showingTomorrow);
      setIsLoading(false);
    };
    
    loadAppointments();
  }, [user, currentTenant]);

  const dashboardContent = useMemo(() => {
    const timeSlot = getCurrentTimeSlot();
    const greeting = getGreeting(timeSlot);
    
    // Keyword-Detection für Plenum, Ausschuss, AK
    const hasPlenum = appointments.some(apt => 
      apt.title.toLowerCase().includes('plenum')
    );
    
    const hasCommittee = appointments.some(apt => 
      apt.title.toLowerCase().match(/ausschuss|ak\s/i)
    );

    const multipleSessions = (hasPlenum && hasCommittee) || 
      (appointments.filter(apt => 
        apt.title.toLowerCase().includes('plenum') || 
        apt.title.toLowerCase().match(/ausschuss|ak\s/i)
      ).length >= 2);
    
    // Get contextual message
    const context = {
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
      multipleSessions
    };
    
    const message = selectMessage(context);
    
    const isLateDay = timeSlot === 'evening' || timeSlot === 'night';
    const useTomorrowTone = isShowingTomorrow || isLateDay;

    const getRoleLeadLine = () => {
      if (userRole === 'abgeordneter') {
        if (hasPlenum || hasCommittee || multipleSessions) {
          return useTomorrowTone
            ? 'Für morgen stehen zentrale politische Termine und klare Entscheidungen im Fokus.'
            : 'Heute stehen zentrale politische Termine und klare Entscheidungen im Fokus.';
        }

        if (appointments.length === 0) {
          return useTomorrowTone
            ? 'Für morgen gibt es Raum für strategische Vorbereitung und Gespräche im Wahlkreis.'
            : 'Heute gibt es Raum für strategische Vorbereitung und Gespräche im Wahlkreis.';
        }

        return useTomorrowTone
          ? 'Für morgen liegt der Schwerpunkt auf Abstimmungen, Austausch und politischer Präsenz.'
          : 'Heute liegt der Schwerpunkt auf Abstimmungen, Austausch und politischer Präsenz.';
      }

      if (userRole === 'mitarbeiter') {
        if (appointments.length >= 4) {
          return useTomorrowTone
            ? 'Für morgen zählt ein guter Takt zwischen Terminen, Rückmeldungen und Umsetzung.'
            : 'Heute zählt ein guter Takt zwischen Terminen, Rückmeldungen und Umsetzung.';
        }

        if (openTasksCount >= 8) {
          return useTomorrowTone
            ? 'Für morgen lohnt sich ein klarer Fokus auf Prioritäten und verlässliche Übergaben.'
            : 'Heute lohnt sich ein klarer Fokus auf Prioritäten und verlässliche Übergaben.';
        }

        return useTomorrowTone
          ? 'Für morgen geht es um saubere Umsetzung und verlässliche Abstimmung im Alltag.'
          : 'Heute geht es um saubere Umsetzung und verlässliche Abstimmung im Alltag.';
      }

      if (userRole === 'bueroleitung') {
        return useTomorrowTone
          ? 'Für morgen zählt ein klarer Überblick über Team, Fristen und Prioritäten.'
          : 'Heute zählt ein klarer Überblick über Team, Fristen und Prioritäten.';
      }

      if (userRole === 'praktikant') {
        return useTomorrowTone
          ? 'Morgen ist ein guter Tag, um dazuzulernen und Verantwortung zu übernehmen.'
          : 'Heute ist ein guter Tag, um dazuzulernen und Verantwortung zu übernehmen.';
      }

      return undefined;
    };

    return {
      greeting,
      roleLine: getRoleLeadLine(),
      motivationalLine: message.text,
      specialDayHint: getSpecialDayHint(new Date(), specialDays),
    };
  }, [
    userRole,
    appointments,
    isShowingTomorrow,
    openTasksCount,
    completedTasksToday,
    specialDays
  ]);

  const weatherItems = useMemo(() => {
    const items: string[] = [];
    if (weatherKarlsruhe) {
      items.push(`${getWeatherIcon(weatherKarlsruhe.icon)} Karlsruhe ${Math.round(weatherKarlsruhe.temp)}°C · ${translateCondition(weatherKarlsruhe.condition)}`);
    }
    if (weatherStuttgart) {
      items.push(`${getWeatherIcon(weatherStuttgart.icon)} Stuttgart ${Math.round(weatherStuttgart.temp)}°C · ${translateCondition(weatherStuttgart.condition)}`);
    }
    return items;
  }, [weatherKarlsruhe, weatherStuttgart]);

  const dayLabel = format(new Date(), 'EEEE, d. MMMM', { locale: de });

  // Show skeleton while tenant is loading
  if (tenantLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg mb-6" />;
  }

  // Don't render without tenant
  if (!currentTenant?.id) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <h1 className="text-3xl lg:text-5xl font-semibold tracking-tight">{dayLabel}</h1>
          <p className="text-xl text-muted-foreground">{dashboardContent.greeting}, {userName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {weatherItems.length > 0 ? weatherItems.map((item) => (
            <Badge key={item} variant="outline" className="px-3 py-1.5 text-sm">
              {item}
            </Badge>
          )) : (
            <Badge variant="outline" className="px-3 py-1.5 text-sm">Wetterdaten werden geladen…</Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{isShowingTomorrow ? 'Termine morgen' : 'Termine heute'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboardContent.specialDayHint && (
            <p className="text-sm text-amber-700 dark:text-amber-300">🌸 {dashboardContent.specialDayHint}</p>
          )}
          {dashboardContent.roleLine && <p className="text-sm text-muted-foreground">{dashboardContent.roleLine}</p>}
          <p className="text-sm">{dashboardContent.motivationalLine}</p>

          <div className="space-y-2 pt-1">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Termine werden geladen…</p>
            ) : appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Termine.</p>
            ) : (
              appointments.map((apt) => (
                <button
                  key={apt.id}
                  type="button"
                  onClick={() => navigate('/mywork?tab=jourFixe')}
                  className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium mr-2">{apt.is_all_day ? 'Ganztägig' : format(new Date(apt.start_time), 'HH:mm', { locale: de })}</span>
                  <span>{apt.title}</span>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {feedbackReminderVisible && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => navigate('/mywork?tab=appointmentfeedback')}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            🔔 {pendingFeedbackCount} offene{pendingFeedbackCount === 1 ? 's' : ''} Termin-Feedback{pendingFeedbackCount !== 1 ? 's' : ''} – jetzt bearbeiten
          </button>
        </div>
      )}
    </div>
  );
};
