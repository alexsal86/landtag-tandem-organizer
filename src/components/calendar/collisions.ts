import type { CalendarEvent } from "./types";

export function overlaps(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.id !== b.id && !a.is_all_day && !a.allDay && !b.is_all_day && !b.allDay &&
    !!a.endTime && !!b.endTime && a.date < b.endTime && b.date < a.endTime;
}

export function nextFreeSlot(event: CalendarEvent, events: CalendarEvent[]): Date | null {
  if (!event.endTime || event.endTime <= event.date) return null;
  const duration = event.endTime.getTime() - event.date.getTime();
  // Stay within the loaded calendar day and preserve the full duration.
  for (let step = 1; step <= 48; step++) {
    const date = new Date(event.date.getTime() + step * 30 * 60_000);
    const endTime = new Date(date.getTime() + duration);
    if (date.toDateString() !== event.date.toDateString() || endTime.toDateString() !== event.date.toDateString()) return null;
    if (!events.some(other => overlaps({ ...event, date, endTime }, other))) return date;
  }
  return null;
}

export function canMoveAppointment(event: CalendarEvent): boolean {
  return event.sourceScope === "internal" && !event._isExternal && !event._isRecurring &&
    !/^(external-|blocked-)/.test(event.id) && event.type !== "birthday";
}
