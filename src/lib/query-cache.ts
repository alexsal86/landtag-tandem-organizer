/**
 * Standard-staleTime-Werte für react-query.
 * Phase 1 des Egress-Sweeps: einheitliche Caching-Politik.
 */
export const STALE_TIME = {
  /** Lookups, Stammdaten, Kategorien, Statuses, Districts. Ändern sich selten. */
  LOOKUP: 15 * 60 * 1000, // 15 min
  /** User-Profile, Tenant-Profile. Ändern sich selten innerhalb einer Session. */
  PROFILE: 10 * 60 * 1000, // 10 min
  /** Geo-/Map-Daten. Quasi statisch. */
  GEO: 30 * 60 * 1000, // 30 min
  /** Listen mit Realtime-Updates. Realtime invalidiert, daher hoch. */
  LIST_WITH_REALTIME: 5 * 60 * 1000, // 5 min
  /** Standard-Listen ohne Realtime. */
  LIST: 60 * 1000, // 1 min
  /** Detail-Views. */
  DETAIL: 30 * 1000, // 30 s
  /** Hochfrequente Daten (Notifications, Counts). */
  REALTIME: 10 * 1000, // 10 s
} as const;
