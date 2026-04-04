import { useState, useEffect, type ComponentType } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CircleHelp, Users, Shield, Settings, Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, Wind, CloudRain, CloudSnow, CloudLightning } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentTimeSlot, getGreeting } from '@/utils/dashboard/timeUtils';
import { getWeather } from '@/utils/dashboard/weatherApi';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export const DashboardHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [weatherKarlsruhe, setWeatherKarlsruhe] = useState<{ temp: number; icon: string } | null>(null);
  const [weatherStuttgart, setWeatherStuttgart] = useState<{ temp: number; icon: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setUserName(data?.display_name || user.email?.split('@')[0] || 'Nutzer');
        setAvatarUrl(data?.avatar_url ?? null);
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
      'cloudy': Cloud,
      'fog': CloudFog,
      'wind': Wind,
      'rain': CloudRain,
      'sleet': CloudSnow,
      'snow': CloudSnow,
      'hail': CloudSnow,
      'thunderstorm': CloudLightning,
    };

    return iconMap[condition] || CloudSun;
  };

  const lowerNavItems = [
    { label: 'Info', icon: CircleHelp, onClick: () => navigate('/mywork?tab=dashboard') },
    { label: 'Team', icon: Users, onClick: () => navigate('/mywork?tab=team') },
    { label: 'Admin', icon: Shield, onClick: () => navigate('/administration') },
    { label: 'Einstellungen', icon: Settings, onClick: () => navigate('/settings') },
  ];

  return (
    <div className="rounded-2xl border bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 p-6 pb-5">
        <div className="space-y-1">
          <p className="text-lg font-medium text-foreground/80 capitalize">{dayDate}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {greeting}, {userName}!
          </h1>
        </div>

        <div className="flex items-end justify-end gap-6">
          {weatherItems.map((item) => (
            <div key={item.city} className="flex items-center gap-3 min-w-[9rem]">
              {(() => {
                const Icon = getWeatherLucideIcon(item.icon);
                return <Icon className="h-10 w-10 text-muted-foreground" />;
              })()}
              <div>
                <p className="text-sm text-muted-foreground">{item.city}</p>
                <p className="text-3xl font-semibold leading-tight">{Math.round(item.temp)}°C</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {lowerNavItems.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={onClick}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full',
                'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}

          <button
            type="button"
            aria-label="Profil öffnen"
            onClick={() => navigate('/profile/edit')}
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full',
              'ring-1 ring-border transition-colors hover:ring-muted-foreground/40',
            )}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatarUrl ?? undefined} alt={userName} />
              <AvatarFallback className="text-sm">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>
    </div>
  );
};
