import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentTimeSlot, getGreeting } from '@/utils/dashboard/timeUtils';
import { getWeather, translateCondition, getWeatherIcon } from '@/utils/dashboard/weatherApi';

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

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground capitalize">{dayDate}</h1>
        <p className="text-lg text-muted-foreground">{greeting}, {userName}!</p>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {weatherKarlsruhe && (
          <span className="flex items-center gap-1">
            <span className="text-lg">{getWeatherIcon(weatherKarlsruhe.icon)}</span>
            <span>Karlsruhe {Math.round(weatherKarlsruhe.temp)}°C</span>
          </span>
        )}
        {weatherStuttgart && (
          <span className="flex items-center gap-1">
            <span className="text-lg">{getWeatherIcon(weatherStuttgart.icon)}</span>
            <span>Stuttgart {Math.round(weatherStuttgart.temp)}°C</span>
          </span>
        )}
      </div>
    </div>
  );
};
