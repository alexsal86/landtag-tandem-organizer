import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/providers/queryClient";

const REALTIME_REFRESH_DEBOUNCE_MS = 250;

export const DASHBOARD_QUERY_KEYS_BY_TABLE = {
  appointments: [["dashboard-rpc-data"], ["dashboard-day-summary"], ["appointment-briefing"]],
  external_events: [["dashboard-rpc-data"], ["dashboard-day-summary"]],
  tasks: [["dashboard-rpc-data"], ["dashboard-deadlines"]],
  quick_notes: [["dashboard-deadlines"]],
  case_items: [["dashboard-deadlines"]],
  task_decisions: [["my-work-decisions"], ["dashboard-deadlines"]],
  task_decision_participants: [["my-work-decisions"]],
  task_decision_responses: [["my-work-decisions"]],
  task_decision_attachments: [["my-work-decisions"]],
  event_planning_timeline_assignments: [["dashboard-deadlines"]],
  event_planning_checklist_items: [["dashboard-deadlines"]],
  event_plannings: [["dashboard-deadlines"]],
} as const;

type DashboardTable = keyof typeof DASHBOARD_QUERY_KEYS_BY_TABLE;
type SubscriptionEntry = {
  references: number;
  channel: ReturnType<typeof supabase.channel>;
  timer: ReturnType<typeof setTimeout> | null;
};

const subscriptions = new Map<string, SubscriptionEntry>();

function scheduleInvalidation(entry: SubscriptionEntry, table: DashboardTable) {
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    entry.timer = null;
    for (const queryKey of DASHBOARD_QUERY_KEYS_BY_TABLE[table]) {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    }
  }, REALTIME_REFRESH_DEBOUNCE_MS);
}

function acquireSubscription(key: string): SubscriptionEntry {
  const existing = subscriptions.get(key);
  if (existing) {
    existing.references += 1;
    return existing;
  }

  const entry: SubscriptionEntry = {
    references: 1,
    channel: supabase.channel(`dashboard-live-${key}-${crypto.randomUUID()}`),
    timer: null,
  };

  for (const table of Object.keys(DASHBOARD_QUERY_KEYS_BY_TABLE) as DashboardTable[]) {
    entry.channel = entry.channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => scheduleInvalidation(entry, table),
    );
  }
  entry.channel.subscribe();
  subscriptions.set(key, entry);
  return entry;
}

/** Shares one realtime channel and one invalidation scheduler per user and office. */
export function useDashboardRealtime(userId?: string, tenantId?: string) {
  useEffect(() => {
    if (!userId || !tenantId) return;
    const key = `${userId}:${tenantId}`;
    const entry = acquireSubscription(key);

    return () => {
      entry.references -= 1;
      if (entry.references > 0) return;
      if (entry.timer) clearTimeout(entry.timer);
      subscriptions.delete(key);
      void supabase.removeChannel(entry.channel);
    };
  }, [userId, tenantId]);
}
