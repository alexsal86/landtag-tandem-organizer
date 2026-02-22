import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useAppointmentFeedback } from '@/hooks/useAppointmentFeedback';
import { getCurrentTimeSlot, getCurrentDayOfWeek, getGreeting } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import { getWeather, translateCondition, getWeatherIcon } from '@/utils/dashboard/weatherApi';
import { getSpecialDayHint } from '@/utils/dashboard/specialDays';
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
  const [openTaskTitles, setOpenTaskTitles] = useState<string[]>([]);
  const [isShowingTomorrow, setIsShowingTomorrow] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  // Load task stats for contextual greeting
  useEffect(() => {
    const loadTaskStats = async () => {
      if (!user?.id) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [{ count: openCount }, { count: completedTodayCount }, { data: openTasks }] = await Promise.all([
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
        supabase
          .from('tasks')
          .select('title')
          .or(`assigned_to.eq.${user.id},assigned_to.ilike.%${user.id}%,user_id.eq.${user.id}`)
          .neq('status', 'completed')
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(3)
      ]);

      setOpenTasksCount(openCount || 0);
      setCompletedTasksToday(completedTodayCount || 0);
      setOpenTaskTitles(
        (openTasks || [])
          .map((task) => task.title?.trim())
          .filter((title): title is string => Boolean(title))
      );
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

  // Generate weather hints
  const getWeatherHint = (condition: string, temp: number): string => {
    const lowerCondition = condition.toLowerCase();
    
    if (lowerCondition.includes('regen') || lowerCondition.includes('rain')) {
      return '☔ Regenschirm nicht vergessen!';
    } else if (lowerCondition.includes('schnee') || lowerCondition.includes('snow')) {
      return '❄️ Warme Kleidung empfohlen!';
    } else if (lowerCondition.includes('sonne') || lowerCondition.includes('clear') || lowerCondition.includes('heiter')) {
      return '☀️ Perfektes Wetter für Außentermine!';
    } else if (temp > 25) {
      return '🌡️ Heute wird es warm!';
    } else if (temp < 5) {
      return '🧥 Zieh dich warm an!';
    } else if (lowerCondition.includes('bewölkt') || lowerCondition.includes('cloud')) {
      return '☁️ Ein bewölkter Tag erwartet uns.';
    }
    
    return '';
  };

  // Build complete text
  const fullText = useMemo(() => {
    if (isLoading) return '';
    
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
    
    const roleSpecificLead = {
      abgeordneter: {
        day: 'Heute stehen politische Prioritäten und klare Entscheidungen im Fokus.',
        evening: 'Für morgen stehen politische Prioritäten und klare Entscheidungen im Fokus.'
      },
      bueroleitung: {
        day: 'Heute zählt ein klarer Überblick über Team, Fristen und Prioritäten.',
        evening: 'Für morgen zählt ein klarer Überblick über Team, Fristen und Prioritäten.'
      },
      mitarbeiter: {
        day: 'Heute geht es um saubere Umsetzung und verlässliche Abstimmung im Alltag.',
        evening: 'Für morgen geht es um saubere Umsetzung und verlässliche Abstimmung im Alltag.'
      },
      praktikant: {
        day: 'Heute ist ein guter Tag, um dazuzulernen und Verantwortung zu übernehmen.',
        evening: 'Morgen ist ein guter Tag, um dazuzulernen und Verantwortung zu übernehmen.'
      }
    } as const;

    const roleConfig = roleSpecificLead[userRole as keyof typeof roleSpecificLead];
    const isLateDay = timeSlot === 'evening' || timeSlot === 'night';
    const roleLine = roleConfig
      ? (isShowingTomorrow || isLateDay ? roleConfig.evening : roleConfig.day)
      : undefined;

    let text = `${greeting}, ${userName}!\n\n`;
    if (roleLine) {
      text += `${roleLine}\n\n`;
    }

    text += `${message.text}\n\n`;

    const specialDayHint = getSpecialDayHint();
    if (specialDayHint) {
      text += `${specialDayHint}\n\n`;
    }
    
    // Task summary section
    text += '✅ **Aufgabenstatus:**\n';
    text += `${openTasksCount} offen`;
    if (completedTasksToday > 0) {
      text += ` · ${completedTasksToday} heute abgeschlossen`;
    }
    text += '\n';
    if (openTaskTitles.length > 0) {
      openTaskTitles.forEach((title) => {
        text += `• ${title}\n`;
      });
    }

    if (showWeather) {
      text += '\n☀️ **Das Wetter heute (optional):**\n';
      if (weatherKarlsruhe) {
        const translatedCondition = translateCondition(weatherKarlsruhe.condition);
        const hint = getWeatherHint(weatherKarlsruhe.condition, weatherKarlsruhe.temp);
        text += `${getWeatherIcon(weatherKarlsruhe.icon)} Karlsruhe: ${Math.round(weatherKarlsruhe.temp)}°C, ${translatedCondition}`;
        if (hint) text += ` ${hint}`;
        text += '\n';
      }
      if (weatherStuttgart) {
        const translatedCondition = translateCondition(weatherStuttgart.condition);
        const hint = getWeatherHint(weatherStuttgart.condition, weatherStuttgart.temp);
        text += `${getWeatherIcon(weatherStuttgart.icon)} Stuttgart: ${Math.round(weatherStuttgart.temp)}°C, ${translatedCondition}`;
        if (hint) text += ` ${hint}`;
        text += '\n';
      }
    }
    
    // Appointments section mit dynamischer Überschrift
    text += isShowingTomorrow 
      ? '\n📅 **Deine Termine morgen:**\n' 
      : '\n📅 **Deine Termine heute:**\n';
    
    if (appointments.length === 0) {
      text += isShowingTomorrow 
        ? 'Keine Termine morgen.\n'
        : 'Keine Termine heute.\n';
    } else {
      appointments.forEach(apt => {
        const time = apt.is_all_day 
          ? 'Ganztägig' 
          : format(new Date(apt.start_time), 'HH:mm', { locale: de });
        text += `${time} - ${apt.title}\n`;
      });
    }
    
    return text;
  }, [isLoading, userName, userRole, weatherKarlsruhe, weatherStuttgart, appointments, isShowingTomorrow, openTasksCount, completedTasksToday, openTaskTitles, showWeather]);

  // Parse text for bold markers (**text**)
  const parsedContent = useMemo(() => {
    const parts = fullText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return <strong key={index} className="font-bold">{boldText}</strong>;
      }
      return part;
    });
  }, [fullText]);

  // Show skeleton while tenant is loading
  if (tenantLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg mb-6" />;
  }

  // Don't render without tenant
  if (!currentTenant?.id) {
    return null;
  }

  return (
    <div>
      <span className="text-xl lg:text-2xl font-light tracking-tight text-foreground/90 block whitespace-pre-wrap">
        {parsedContent}
      </span>
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
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowWeather((prev) => !prev)}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          {showWeather ? 'Wetter ausblenden' : 'Wetter anzeigen (optional)'}
        </button>
      </div>
    </div>
  );
};
