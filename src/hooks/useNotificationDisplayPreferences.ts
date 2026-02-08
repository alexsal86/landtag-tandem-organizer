import { useState, useEffect, useCallback } from 'react';

export interface NotificationDisplayPreferences {
  position: 'top-right' | 'bottom-right';
  size: 'normal' | 'large';
  duration: number; // in milliseconds
  persist: boolean;
  soundEnabled: boolean;
  soundName: string;
  soundVolume: number;
  categorySounds: Record<string, string>; // category -> sound name
}

const STORAGE_KEY = 'notification_display_preferences';

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
  const [preferences, setPreferencesState] = useState<NotificationDisplayPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Error loading notification preferences:', e);
    }
    return DEFAULT_PREFERENCES;
  });

  const setPreferences = useCallback((update: Partial<NotificationDisplayPreferences>) => {
    setPreferencesState(prev => {
      const next = { ...prev, ...update };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Error saving notification preferences:', e);
      }
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferencesState(DEFAULT_PREFERENCES);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error resetting notification preferences:', e);
    }
  }, []);

  return { preferences, setPreferences, resetPreferences };
};
