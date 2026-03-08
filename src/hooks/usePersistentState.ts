import { useUserPreference } from "@/hooks/useUserPreference";

/**
 * Generic persistent state hook backed by the user_preferences DB table.
 * Drop-in replacement for the old localStorage-only version.
 */
export function usePersistentState<T>(key: string, defaultValue: T) {
  return useUserPreference<T>(key, defaultValue);
}
