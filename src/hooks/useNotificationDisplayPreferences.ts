import { useCallback, useMemo } from 'react';
import { useUserPreference } from '@/hooks/useUserPreference';

export interface NotificationDisplayPreferences {
  position: 'top-right' | 'top-center' | 'bottom-right';
  size: 'normal' | 'large';
  duration: number;
  persist: boolean;
  soundEnabled: boolean;
  soundName: string;
  soundVolume: number;
  categorySounds: Record<string, string>;
}

const DEFAULT_PREFERENCES: NotificationDisplayPreferences = {
  position: 'bottom-right',
  size: 'normal',
  duration: 5000,
  persist: false,
  soundEnabled: false,
  soundName: 'ping',
  soundVolume: 0.5,
  categorySounds: {},
};

export const useNotificationDisplayPreferences = () => {
  const [raw, setRaw] = useUserPreference<NotificationDisplayPreferences>(
    'notification_display_preferences',
    DEFAULT_PREFERENCES,
  );

  const preferences = useMemo(
    () => ({ ...DEFAULT_PREFERENCES, ...raw }),
    [raw],
  );

  const setPreferences = useCallback(
    (update: Partial<NotificationDisplayPreferences>) => {
      setRaw((prev) => ({ ...prev, ...update }));
    },
    [setRaw],
  );

  const resetPreferences = useCallback(() => {
    setRaw(DEFAULT_PREFERENCES);
  }, [setRaw]);

  return { preferences, setPreferences, resetPreferences };
};
