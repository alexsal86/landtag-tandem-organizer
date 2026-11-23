import { TeamRitualDashboardCard } from "@/features/team-rituals/TeamRitualDashboardCard";
import { DashboardDaySummary } from "./DashboardDaySummary";
import { useState, useEffect, type ComponentType } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, Wind, CloudRain, CloudSnow, CloudLightning } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useDashboardGreetings } from '@/hooks/useDashboardGreetings';
import { formatDashboardGreeting, selectDashboardGreeting } from '@/utils/dashboard/greetings';
import { getWeather } from '@/utils/dashboard/weatherApi';

export const DashboardHeader = ({ showTeamRituals = true }: { showTeamRituals?: boolean }) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { data: greetings = [] } = useDashboardGreetings(currentTenant?.id);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [userName, setUserName] = useState('');
  const [weatherKarlsruhe, setWeatherKarlsruhe] = useState<{ temp: number; icon: string } | null>(null);
  const [weatherStuttgart, setWeatherStuttgart] = useState<{ temp: number; icon: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setUserName(data?.display_name || user.email?.split('@')[0] || 'Nutzer');
      });
  }, [user]);

  useEffect(() => {
    const load = async () => {
      const [ka, st] = await Promise.all([
        getWeather(49.0069, 8.4037),
        getWeather(48.7758, 9.1829),
      ]);
      if (ka) setWeatherKarlsruhe({ temp: ka.temperature, icon: ka.icon });
      if (st) setWeatherStuttgart({ temp: st.temperature, icon: st.icon });
    };
    load();
  }, []);

  const dayDate = format(now, "EEEE, d. MMMM", { locale: de });
  const greeting = selectDashboardGreeting(greetings, now);
  const weatherItems = [
    weatherKarlsruhe ? { city: 'Karlsruhe', ...weatherKarlsruhe } : null,
    weatherStuttgart ? { city: 'Stuttgart', ...weatherStuttgart } : null,
  ].filter((item): item is { city: string; temp: number; icon: string } => item !== null);

  const getWeatherLucideIcon = (condition: string) => {
    const iconMap: Record<string, ComponentType<{ className?: string }>> = {
      'clear-day': Sun,
      'clear-night': Moon,
      'partly-cloudy-day': CloudSun,
      'partly-cloudy-night': CloudMoon,
      cloudy: Cloud,
      fog: CloudFog,
      wind: Wind,
      rain: CloudRain,
      sleet: CloudSnow,
      snow: CloudSnow,
      hail: CloudSnow,
      thunderstorm: CloudLightning,
    };

    return iconMap[condition] || CloudSun;
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-normal capitalize text-muted-foreground">{dayDate}</p>
          {greeting && (
            <h1 className="text-3xl font-semibold tracking-tight">
              {formatDashboardGreeting(greeting, userName || 'Nutzer')}
            </h1>
          )}
        </div>
        <DashboardDaySummary />
      </div>
      <div className="min-w-0 space-y-4">
      {weatherItems.length > 0 && (
        <div className="flex flex-wrap items-end justify-end gap-3 self-end">
        {weatherItems.map((item) => (
          <div key={item.city} className="flex items-center gap-2.5">
            {(() => {
              const Icon = getWeatherLucideIcon(item.icon);
              return <Icon className="h-11 w-11 text-muted-foreground" />;
            })()}
            <div className="flex flex-col gap-0.5">
              <p className="text-sm leading-none text-muted-foreground">{item.city}</p>
              <p className="text-xl font-semibold leading-tight">{Math.round(item.temp)}°C</p>
            </div>
          </div>
        ))}
        </div>
      )}
        {showTeamRituals && <TeamRitualDashboardCard />}
      </div>
    </div>
  );
};
