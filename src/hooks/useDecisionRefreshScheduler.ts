import { useEffect, useRef } from "react";

export function useDecisionRefreshScheduler(refreshFn: () => Promise<void>) {
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const scheduleRefresh = (debounceMs = 150) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      void refreshFn();
    }, debounceMs);
  };

  return { scheduleRefresh };
}
