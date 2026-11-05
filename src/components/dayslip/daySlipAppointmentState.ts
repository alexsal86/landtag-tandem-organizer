import { endOfDay } from "date-fns";

export interface DaySlipEventLike {
  id: string;
  date: Date;
  endTime?: Date;
  is_all_day?: boolean;
}

/** Effective end: all-day events last until the end of their (last) day. */
export function effectiveEnd(e: DaySlipEventLike): Date {
  if (e.is_all_day) return endOfDay(e.endTime ?? e.date);
  return e.endTime ?? e.date;
}

export function isPast(e: DaySlipEventLike, now: Date): boolean {
  return effectiveEnd(e).getTime() <= now.getTime();
}

export function isRunning(e: DaySlipEventLike, now: Date): boolean {
  return !e.is_all_day && e.date.getTime() <= now.getTime() && effectiveEnd(e).getTime() > now.getTime();
}

/** Splits today's events into upcoming/running and past, and finds "now" and "next". */
export function splitDayEvents<T extends DaySlipEventLike>(events: T[], now: Date) {
  const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());
  const remaining = sorted.filter((e) => !isPast(e, now));
  const past = sorted.filter((e) => isPast(e, now));
  const running = remaining.filter((e) => isRunning(e, now));
  const next = remaining.find((e) => !e.is_all_day && e.date.getTime() > now.getTime()) ?? null;
  return { remaining, past, runningIds: new Set(running.map((e) => e.id)), next };
}

export function minutesUntil(date: Date, now: Date): number {
  return Math.max(0, Math.round((date.getTime() - now.getTime()) / 60_000));
}
