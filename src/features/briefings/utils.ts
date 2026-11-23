import { addDays, format, isWeekend } from "date-fns";

/** Liefert den nächsten Werktag (Mo-Fr) ab `from` (exklusive `from` selbst). */
export function nextWorkingDay(from: Date = new Date()): Date {
  let d = addDays(from, 1);
  while (isWeekend(d)) {
    d = addDays(d, 1);
  }
  return d;
}

/** Format YYYY-MM-DD für DATE-Spalten. */
export function toDateString(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Heutiges Datum als YYYY-MM-DD (lokale Zeit). */
export function todayString(): string {
  return toDateString(new Date());
}

/** Calendar-day chips follow Berlin dates, including weekends and DST changes. */
export function briefingDateOptions(now = new Date()): { tomorrow: string; dayAfter: string } {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const noon = Date.parse(`${day}T12:00:00Z`);
  return {
    tomorrow: new Date(noon + 86400_000).toISOString().slice(0, 10),
    dayAfter: new Date(noon + 2 * 86400_000).toISOString().slice(0, 10),
  };
}
