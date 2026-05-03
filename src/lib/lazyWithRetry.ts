import { lazy } from "react";

// Monotonically increasing counter so each lazyWithRetry call gets a unique retry key.
// This prevents a failed chunk for one route from blocking retries for other routes.
let _counter = 0;

export function lazyWithRetry<T extends React.ComponentType<Record<string, unknown>>>(
  factory: () => Promise<{ default: T }>
) {
  const key = `chunk-reload-retry-${_counter++}`;
  return lazy(() =>
    factory().catch((error) => {
      const hasRetried = sessionStorage.getItem(key);

      if (!hasRetried) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        // Return a never-resolving promise to prevent React from rendering
        return new Promise(() => {});
      }

      sessionStorage.removeItem(key);
      throw error;
    })
  );
}
