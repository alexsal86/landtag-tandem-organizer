import { useState, useEffect } from 'react';

export type FeatureFlags = {
  useReactBigCalendar: boolean;
  // Add more feature flags as needed
};

const DEFAULT_FLAGS: FeatureFlags = {
  useReactBigCalendar: false,
};

/**
 * Hook for managing feature flags
 * In production, this could be connected to a feature flag service
 */
export function useFeatureFlag() {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);

  useEffect(() => {
    // Load feature flags from localStorage for development
    const savedFlags = localStorage.getItem('featureFlags');
    if (savedFlags) {
      try {
        const parsedFlags = JSON.parse(savedFlags);
        setFlags(prevFlags => ({ ...prevFlags, ...parsedFlags }));
      } catch (error) {
        console.warn('Failed to parse feature flags from localStorage:', error);
      }
    }
  }, []);

  const toggleFlag = (flagName: keyof FeatureFlags) => {
    const newFlags = {
      ...flags,
      [flagName]: !flags[flagName]
    };
    setFlags(newFlags);
    localStorage.setItem('featureFlags', JSON.stringify(newFlags));
  };

  const setFlag = (flagName: keyof FeatureFlags, value: boolean) => {
    const newFlags = {
      ...flags,
      [flagName]: value
    };
    setFlags(newFlags);
    localStorage.setItem('featureFlags', JSON.stringify(newFlags));
  };

  return {
    flags,
    toggleFlag,
    setFlag,
    isEnabled: (flagName: keyof FeatureFlags) => flags[flagName]
  };
}

/**
 * Development component to toggle feature flags
 */
export function FeatureFlagToggle() {
  const { flags, toggleFlag } = useFeatureFlag();

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-card border rounded-lg shadow-lg z-50">
      <h3 className="font-semibold mb-2">Feature Flags (Dev)</h3>
      <div className="space-y-2">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={flags.useReactBigCalendar}
            onChange={() => toggleFlag('useReactBigCalendar')}
            className="rounded"
          />
          <span className="text-sm">Use React Big Calendar</span>
        </label>
      </div>
    </div>
  );
}