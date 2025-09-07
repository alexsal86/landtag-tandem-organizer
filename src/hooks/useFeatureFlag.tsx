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

  // Show in all environments for now to allow testing
  // if (process.env.NODE_ENV === 'production') {
  //   return null;
  // }

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-card border border-border rounded-lg shadow-lg z-50 max-w-xs">
      <h3 className="font-semibold mb-3 text-sm text-foreground">🚀 Feature Flags</h3>
      <div className="space-y-3">
        <label className="flex items-center justify-between space-x-3 cursor-pointer">
          <span className="text-sm text-foreground">Enhanced Calendar</span>
          <input
            type="checkbox"
            checked={flags.useReactBigCalendar}
            onChange={() => toggleFlag('useReactBigCalendar')}
            className="rounded border-border focus:ring-primary focus:ring-2"
          />
        </label>
        <div className="text-xs text-muted-foreground">
          {flags.useReactBigCalendar ? '✅ Enhanced mode active' : '⚪ Standard mode active'}
        </div>
      </div>
    </div>
  );
}