import { useState, useEffect, type ComponentType } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, Wind, CloudRain, CloudSnow, CloudLightning } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentTimeSlot, getGreeting } from '@/utils/dashboard/timeUtils';
import { getWeather } from '@/utils/dashboard/weatherApi';

export const DashboardHeader = () => {
  const { user } = useAuth();
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

  const now = new Date();
  const dayDate = format(now, "EEEE, d. MMMM", { locale: de });
  const greeting = getGreeting(getCurrentTimeSlot());
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-1">
        <p className="text-lg font-medium text-foreground/80 capitalize">{dayDate}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {greeting}, {userName}!
        </h1>
      </div>

      <div className="flex items-end justify-end gap-6">
        {weatherItems.map((item) => (
          <div key={item.city} className="flex min-w-[9rem] items-center gap-2.5">
            {(() => {
              const Icon = getWeatherLucideIcon(item.icon);
              return <Icon className="h-11 w-11 text-muted-foreground" />;
            })()}
            <div className="flex flex-col gap-0.5">
              <p className="text-sm leading-none text-muted-foreground">{item.city}</p>
              <p className="text-3xl font-semibold leading-tight">{Math.round(item.temp)}°C</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
