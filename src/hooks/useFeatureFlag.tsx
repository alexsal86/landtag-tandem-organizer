import React, { useState, useEffect } from "react";
import { debugConsole } from "@/utils/debugConsole";

export type FeatureFlags = {
  useReactBigCalendar: boolean;
  // Add more feature flags as needed
};

export type FeatureFlagName = keyof FeatureFlags;
export type ToggleFeatureFlag = (flagName: FeatureFlagName) => void;
export type SetFeatureFlag = (flagName: FeatureFlagName, value: boolean) => void;
export type IsFeatureFlagEnabled = (flagName: FeatureFlagName) => boolean;

export interface UseFeatureFlagResult {
  flags: FeatureFlags;
  toggleFlag: ToggleFeatureFlag;
  setFlag: SetFeatureFlag;
  isEnabled: IsFeatureFlagEnabled;
}

const DEFAULT_FLAGS: FeatureFlags = {
  useReactBigCalendar: true,
};

const isFeatureFlags = (value: unknown): value is Partial<FeatureFlags> => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Object.entries(candidate).every(([key, entryValue]) => key in DEFAULT_FLAGS && typeof entryValue === "boolean");
};

/**
 * Hook for managing feature flags
 * In production, this could be connected to a feature flag service
 */
export function useFeatureFlag(): UseFeatureFlagResult {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);

  useEffect(() => {
    // Load feature flags from localStorage for development
    const savedFlags = localStorage.getItem("featureFlags");
    if (savedFlags) {
      try {
        const parsedFlags: unknown = JSON.parse(savedFlags);
        if (isFeatureFlags(parsedFlags)) {
          setFlags((prevFlags: FeatureFlags) => ({ ...prevFlags, ...parsedFlags }));
        } else {
          debugConsole.warn("Invalid feature flags in localStorage:", parsedFlags);
        }
      } catch (error: unknown) {
        debugConsole.warn("Failed to parse feature flags from localStorage:", error);
      }
    }
  }, []);

  const toggleFlag: ToggleFeatureFlag = (flagName) => {
    const newFlags = {
      ...flags,
      [flagName]: !flags[flagName],
    };
    setFlags(newFlags);
    localStorage.setItem("featureFlags", JSON.stringify(newFlags));
  };

  const setFlag: SetFeatureFlag = (flagName, value) => {
    const newFlags = {
      ...flags,
      [flagName]: value,
    };
    setFlags(newFlags);
    localStorage.setItem("featureFlags", JSON.stringify(newFlags));
  };

  const isEnabled: IsFeatureFlagEnabled = (flagName) => flags[flagName];

  return {
    flags,
    toggleFlag,
    setFlag,
    isEnabled,
  };
}

/**
 * Development component to toggle feature flags
 */
export function FeatureFlagToggle(): React.JSX.Element {
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
          <span className="text-sm text-foreground">React Big Calendar</span>
          <input
            type="checkbox"
            checked={flags.useReactBigCalendar}
            onChange={() => toggleFlag("useReactBigCalendar")}
            className="rounded border-border focus:ring-primary focus:ring-2"
          />
        </label>
        <div className="text-xs text-muted-foreground">
          {flags.useReactBigCalendar ? "✅ React Big Calendar aktiv" : "⚪ Fallback Kalender aktiv"}
        </div>
      </div>
    </div>
  );
}
