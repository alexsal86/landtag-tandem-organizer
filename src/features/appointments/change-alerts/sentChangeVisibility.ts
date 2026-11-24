import { berlinDay } from '@/utils/dashboard/daySummary';

/** Dismissal is personal; this filter never changes the underlying alert or receipt. */
export function visibleSentChanges<T extends { id: string; created_at: string }>(
  alerts: readonly T[], dismissedIds: readonly string[], now = new Date(),
): T[] {
  const today = berlinDay(now);
  const dismissed = new Set(dismissedIds);
  return alerts.filter(alert => Number.isFinite(Date.parse(alert.created_at))
    && berlinDay(new Date(alert.created_at)) === today && !dismissed.has(alert.id));
}
