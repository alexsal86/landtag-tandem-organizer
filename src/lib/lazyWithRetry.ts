import { lazy } from "react";

export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((error) => {
      const key = "chunk-reload-retry";
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
