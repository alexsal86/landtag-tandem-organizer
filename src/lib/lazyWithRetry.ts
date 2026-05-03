import { lazy } from "react";

// Monotonically increasing counter so each lazyWithRetry call gets a unique retry key.
// This prevents a failed chunk for one route from blocking retries for other routes.
let _counter = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends React.ComponentType<any>>(
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
