import { type DaySlipDayData, type DaySlipStore, extractLinesFromHtml, isDayKey, toDayKey } from "./dayslipTypes";

export type DaySlipDayView = {
  /** Day actually shown; unknown or future selections fall back to today. */
  key: string;
  isToday: boolean;
  isPast: boolean;
  /** Valid completion timestamp, if the day was explicitly completed. */
  completedAt?: string;
  /** Past days are a record: they are never edited. */
  readOnly: boolean;
  /** Nearest earlier day with stored content. */
  previousKey?: string;
  /** Nearest later day with stored content, or today; undefined on today. */
  nextKey?: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

export type OpenPastDay = { dayKey: string; openCount: number };

export type SnoozePreset = { label: string; until: string };

export function shiftDayKey(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
}

const storedKeys = (store: DaySlipStore, todayKey: string) =>
  Object.keys(store).filter(isDayKey).sort().filter(key => key <= todayKey);

/**
 * Resolves what the panel shows. Selection only moves between days that actually
 * have a sheet, so arrows never strand the user on empty calendar days.
 */
export function resolveDayView(store: DaySlipStore, todayKey: string, selectedKey?: string): DaySlipDayView {
  const keys = storedKeys(store, todayKey);
  const requested = selectedKey && isDayKey(selectedKey) ? selectedKey : todayKey;
  const key = requested > todayKey ? todayKey : keys.includes(requested) ? requested : todayKey;
  const day = store[key];
  const completedAt = day?.completedAt && Number.isFinite(Date.parse(day.completedAt)) ? day.completedAt : undefined;
  const previousKey = keys.filter(entry => entry < key).pop();
  const laterKey = keys.find(entry => entry > key && entry <= todayKey);
  const nextKey = key < todayKey ? laterKey ?? todayKey : undefined;
  return {
    key,
    isToday: key === todayKey,
    isPast: key < todayKey,
    completedAt,
    readOnly: key !== todayKey,
    previousKey,
    nextKey,
    canGoPrevious: Boolean(previousKey),
    canGoNext: Boolean(nextKey),
  };
}

/** Lines that still need a decision: neither checked off, assigned, nor carried over. */
export function openLineCount(day: DaySlipDayData | undefined): number {
  if (!day) return 0;
  const struck = new Set(day.struckLineIds ?? day.struckLines ?? []);
  const resolved = new Set((day.resolved ?? []).map(item => item.lineId));
  return extractLinesFromHtml(day.html).filter(line =>
    !struck.has(line.id) && !resolved.has(line.id) && !day.carriedTo?.[line.id],
  ).length;
}

/** Days before today that were never completed and still hold open work, newest first. */
export function openPastDays(store: DaySlipStore, todayKey: string): OpenPastDay[] {
  return Object.keys(store)
    .filter(key => key < todayKey && isDayKey(key))
    .map(dayKey => ({ dayKey, openCount: openLineCount(store[dayKey]) }))
    .filter(entry => entry.openCount > 0 && !store[entry.dayKey]?.completedAt)
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

/** One entry per future date; the old menu offered "+1 Tag" and "Morgen" twice. */
export function snoozePresets(todayKey: string): SnoozePreset[] {
  return [
    { label: "+1 Tag", until: shiftDayKey(todayKey, 1) },
    { label: "+3 Tage", until: shiftDayKey(todayKey, 3) },
    { label: "Nächste Woche", until: shiftDayKey(todayKey, 7) },
  ];
}

export const defaultSnoozeUntil = (todayKey: string) => shiftDayKey(todayKey, 1);
