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
