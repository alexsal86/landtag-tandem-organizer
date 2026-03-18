import { useCallback, useMemo } from 'react';
import { useUserPreference } from '@/hooks/useUserPreference';
import type { SoundName } from '@/utils/notificationSounds';

export interface NotificationDisplayPreferences {
  position: 'top-right' | 'top-center' | 'bottom-right';
  size: 'normal' | 'large';
  duration: number;
  persist: boolean;
  soundEnabled: boolean;
  soundName: SoundName;
  soundVolume: number;
  categorySounds: Record<string, SoundName>;
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

export interface NotificationDisplayPreferencesHookResult {
  preferences: NotificationDisplayPreferences;
  setPreferences: (update: Partial<NotificationDisplayPreferences>) => void;
  resetPreferences: () => void;
}

export const useNotificationDisplayPreferences = (): NotificationDisplayPreferencesHookResult => {
  const [raw, setRaw] = useUserPreference<NotificationDisplayPreferences>(
    'notification_display_preferences',
    DEFAULT_PREFERENCES,
  );

  const preferences = useMemo<NotificationDisplayPreferences>(
    () => ({ ...DEFAULT_PREFERENCES, ...raw }),
    [raw],
  );

  const setPreferences = useCallback((update: Partial<NotificationDisplayPreferences>): void => {
    setRaw((prev: NotificationDisplayPreferences): NotificationDisplayPreferences => ({
      ...prev,
      ...update,
    }));
  }, [setRaw]);

  const resetPreferences = useCallback((): void => {
    setRaw(DEFAULT_PREFERENCES);
  }, [setRaw]);

  return { preferences, setPreferences, resetPreferences };
};
