/**
 * Route prefetching utilities.
 * Preloads lazy-loaded chunks on hover / idle so navigation feels instant.
 */

type ImportFn = () => Promise<unknown>;

const prefetchMap: Record<string, ImportFn> = {
  dashboard: () => import("@/components/CustomizableDashboard"),
  mywork: () => import("@/components/MyWorkView"),
  calendar: () => import("@/components/CalendarView"),
  contacts: () => import("@/features/contacts/components/ContactsView"),
  tasks: () => import("@/components/TasksView"),
  decisions: () => import("@/components/task-decisions/DecisionOverview"),
  meetings: () => import("@/features/meetings"),
  documents: () => import("@/components/DocumentsView"),
  knowledge: () => import("@/features/knowledge"),
  settings: () => import("@/components/SettingsView"),
  employee: () => import("@/features/employees"),
  time: () => import("@/features/timetracking"),
  eventplanning: () => import("@/components/EventPlanningView"),
  casefiles: () => import("@/components/CaseFilesView"),
  daten: () => import("@/components/DataView"),
  chat: () => import("@/components/chat/MatrixChatView"),
  administration: () => import("@/pages/Administration"),
};

const prefetched = new Set<string>();

/** Eagerly load the chunk for a section (idempotent, fire-and-forget). */
export function prefetchRoute(sectionId: string): void {
  if (prefetched.has(sectionId)) return;
  const loader = prefetchMap[sectionId];
  if (!loader) return;
  prefetched.add(sectionId);
  // Use requestIdleCallback where available, else setTimeout
  const schedule = typeof requestIdleCallback === "function" ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 50);
  schedule(() => {
    loader().catch(() => {
      // Remove from set so a retry is possible
      prefetched.delete(sectionId);
    });
  });
}

/** Prefetch all routes that belong to a navigation group's sub-items. */
export function prefetchGroup(subItemIds: string[]): void {
  subItemIds.forEach(prefetchRoute);
}
