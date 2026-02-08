import { useState, useCallback } from 'react';

const STORAGE_KEY = 'default_decision_participants';

export const useDefaultDecisionParticipants = () => {
  const [defaultParticipants, setDefaultParticipantsState] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Error loading default participants:', e);
    }
    return [];
  });

  const setDefaultParticipants = useCallback((userIds: string[]) => {
    setDefaultParticipantsState(userIds);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userIds));
    } catch (e) {
      console.error('Error saving default participants:', e);
    }
  }, []);

  const clearDefaultParticipants = useCallback(() => {
    setDefaultParticipantsState([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error clearing default participants:', e);
    }
  }, []);

  const hasDefaults = defaultParticipants.length > 0;

  return { defaultParticipants, setDefaultParticipants, clearDefaultParticipants, hasDefaults };
};
