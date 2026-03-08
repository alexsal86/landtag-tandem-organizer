import { useCallback, useMemo } from 'react';
import { useUserPreference } from '@/hooks/useUserPreference';

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

export const useDefaultDecisionSettings = () => {
  const [settings, setSettingsRaw] = useUserPreference<DefaultDecisionSettings>(
    'default_decision_settings',
    DEFAULT_SETTINGS,
  );

  // Ensure all keys exist (forward-compat)
  const mergedSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...settings }),
    [settings],
  );

  const setSettings = useCallback(
    (next: DefaultDecisionSettings) => setSettingsRaw(next),
    [setSettingsRaw],
  );

  const setDefaultParticipants = useCallback(
    (userIds: string[]) =>
      setSettingsRaw((prev) => ({ ...prev, participants: userIds })),
    [setSettingsRaw],
  );

  const defaultParticipants = mergedSettings.participants;
  const hasDefaults = mergedSettings.participants.length > 0;

  return {
    settings: mergedSettings,
    setSettings,
    defaultParticipants,
    setDefaultParticipants,
    hasDefaults,
  };
};

// Backwards-compatible alias
export const useDefaultDecisionParticipants = useDefaultDecisionSettings;
