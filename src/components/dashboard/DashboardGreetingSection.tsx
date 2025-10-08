import { useEffect, useState, useMemo } from 'react';
import { TypewriterText } from './TypewriterText';
import { supabase } from '@/integrations/supabase/client';
import { WidgetQuickAccess } from './WidgetQuickAccess';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { getCurrentTimeSlot, getCurrentDayOfWeek, getGreeting } from '@/utils/dashboard/timeUtils';
import { selectMessage } from '@/utils/dashboard/messageGenerator';
import { getWeather, translateCondition, getWeatherIcon } from '@/utils/dashboard/weatherApi';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CallLogWidget } from '@/components/widgets/CallLogWidget';
import { PomodoroWidget } from '@/components/widgets/PomodoroWidget';
import { QuickNotesWidget } from '@/components/widgets/QuickNotesWidget';

interface AppointmentData {
  id: string;
  title: string;
  start_time: string;
  is_all_day: boolean;
}

export const DashboardGreetingSection = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [userName, setUserName] = useState<string>('');
  const [weatherKarlsruhe, setWeatherKarlsruhe] = useState<{ temp: number; condition: string; icon: string } | null>(null);
  const [weatherStuttgart, setWeatherStuttgart] = useState<{ temp: number; condition: string; icon: string } | null>(null);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeWidget, setActiveWidget] = useState<string>('quicknotes');

  // Load user name
  useEffect(() => {
    const loadUserName = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setUserName(data?.display_name || user.email?.split('@')[0] || 'Nutzer');
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

  // Load today's appointments (max 2)
  useEffect(() => {
    const loadAppointments = async () => {
      if (!user?.id || !currentTenant?.id) return;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Erweiterte Zeitfenster für Ganztagstermine (UTC-Probleme)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      
      // Normale Termine
      const { data: normalAppointments } = await supabase
        .from('appointments')
        .select('id, title, start_time, is_all_day')
        .eq('tenant_id', currentTenant.id)
        .eq('is_all_day', false)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .order('start_time', { ascending: true });
      
      // Ganztagstermine (größeres Zeitfenster wegen UTC)
      const { data: allDayAppointments } = await supabase
        .from('appointments')
        .select('id, title, start_time, is_all_day')
        .eq('tenant_id', currentTenant.id)
        .eq('is_all_day', true)
        .gte('start_time', yesterday.toISOString())
        .lt('start_time', dayAfterTomorrow.toISOString())
        .order('start_time', { ascending: true });
      
      // Externe Kalender-Events (type-safe cast to avoid deep instantiation)
      const externalEventsResult = await (supabase as any)
        .from('external_events')
        .select(`
          id,
          title,
          start_time,
          all_day,
          external_calendars!inner(tenant_id)
        `)
        .eq('external_calendars.tenant_id', currentTenant.id)
        .gte('start_time', yesterday.toISOString())
        .lt('start_time', dayAfterTomorrow.toISOString())
        .order('start_time', { ascending: true });
      
      // Map external events to AppointmentData type
      const externalEventsFormatted: AppointmentData[] = (externalEventsResult.data || []).map((e: any) => ({
        id: e.id as string,
        title: e.title as string,
        start_time: e.start_time as string,
        is_all_day: (e.all_day as boolean) ?? false
      }));
      
      // Alle Events kombinieren
      const allEvents: AppointmentData[] = [
        ...(normalAppointments || []),
        ...(allDayAppointments || []),
        ...externalEventsFormatted
      ];
      
      // Filtern für lokale Zeit (Deutsche Zeit = UTC+1/+2)
      const filteredEvents = allEvents.filter(event => {
        const eventDate = new Date(event.start_time);
        const localDate = new Date(eventDate.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        return localDate.toDateString() === today.toDateString();
      }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 2);
      
      setAppointments(filteredEvents);
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
      tasksCount: 0,
      completedTasks: 0,
      isHoliday: false,
      month: new Date().getMonth() + 1,
      hasPlenum,
      hasCommittee,
      multipleSessions
    };
    
    const message = selectMessage(context);
    
    let text = `${greeting}, ${userName}!\n\n${message.text}\n\n`;
    
    // Weather section
    text += '☀️ **Das Wetter heute:**\n';
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
    
    // Appointments section
    text += '\n📅 **Deine Termine heute:**\n';
    if (appointments.length === 0) {
      text += 'Keine Termine heute.\n';
    } else {
    appointments.forEach(apt => {
      const time = apt.is_all_day 
        ? 'Ganztägig' 
        : format(new Date(apt.start_time), 'HH:mm', { locale: de });
      text += `${time} - ${apt.title}\n`;
    });
    }
    
    return text;
  }, [isLoading, userName, weatherKarlsruhe, weatherStuttgart, appointments]);

  return (
    <div className="mb-6 flex items-start gap-4">
      {/* Left column: Greeting only */}
      <div className="flex-1 min-w-0">
        <TypewriterText
          text={fullText}
          className="text-xl lg:text-2xl font-light tracking-tight text-foreground/90 block whitespace-pre-wrap"
        />
      </div>

      {/* Right column: Widget Buttons + Content (Desktop only) */}
      <div className="hidden lg:flex flex-col gap-2 w-[420px]">
        <WidgetQuickAccess
          activeWidget={activeWidget}
          onWidgetChange={setActiveWidget}
        />
      </div>
    </div>
  );
};
