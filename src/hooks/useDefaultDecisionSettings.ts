import { useState, useCallback } from 'react';

const STORAGE_KEY = 'default_decision_settings';
const OLD_STORAGE_KEY = 'default_decision_participants';

export interface DefaultDecisionSettings {
  participants: string[];
  visibleToAll: boolean;
  sendByEmail: boolean;
  sendViaMatrix: boolean;
}

const DEFAULT_SETTINGS: DefaultDecisionSettings = {
  participants: [],
  visibleToAll: true,
  sendByEmail: true,
  sendViaMatrix: true,
};

const loadSettings = (): DefaultDecisionSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };

    // Migrate from old key
    const oldStored = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldStored) {
      const participants = JSON.parse(oldStored);
      if (Array.isArray(participants)) {
        const migrated: DefaultDecisionSettings = { ...DEFAULT_SETTINGS, participants };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(OLD_STORAGE_KEY);
        return migrated;
      }
    }
  } catch (e) {
    console.error('Error loading default decision settings:', e);
  }
  return DEFAULT_SETTINGS;
};

export const useDefaultDecisionSettings = () => {
  const [settings, setSettingsState] = useState<DefaultDecisionSettings>(loadSettings);

  const setSettings = useCallback((next: DefaultDecisionSettings) => {
    setSettingsState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Error saving default decision settings:', e);
    }
  }, []);

  const setDefaultParticipants = useCallback((userIds: string[]) => {
    setSettingsState(prev => {
      const next = { ...prev, participants: userIds };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Backwards-compatible aliases
  const defaultParticipants = settings.participants;
  const hasDefaults = settings.participants.length > 0;

  return {
    settings,
    setSettings,
    defaultParticipants,
    setDefaultParticipants,
    hasDefaults,
  };
};

// Keep old hook name as alias for existing imports
export const useDefaultDecisionParticipants = useDefaultDecisionSettings;
