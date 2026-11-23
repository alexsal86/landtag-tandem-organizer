import { berlinDay } from './daySummary';
import type { AppointmentData } from '@/hooks/useDashboardAppointmentsData';

export function birthdayAge(birthday: string, day: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || birthday.slice(5) !== day.slice(5)) return undefined;
  const age = Number(day.slice(0, 4)) - Number(birthday.slice(0, 4));
  return age >= 0 ? age : undefined;
}

export function nextAppointmentLabel(event: AppointmentData): string {
  const date = new Date(event.start_time);
  const day = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long' }).format(date);
  const time = event.is_all_day ? 'ganztägig' : new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', hour: 'numeric', minute: '2-digit',
  }).format(date);
  return `Nächster Termin: ${day}, ${time} · ${event.title}${event.location ? ` · ${event.location}` : ''}.`;
}

export function occursOnDay(event: AppointmentData, day: string): boolean {
  const start = berlinDay(new Date(event.start_time));
  return event.is_all_day ? start <= day && berlinDay(new Date(event.end_time ? Date.parse(event.end_time) - 1 : Date.parse(event.start_time))) >= day : start === day;
}

/** Birthday calendar records are occasions, not appointments in the daily timeline. */
export function isDashboardBirthday(event: { category?: string | null }): boolean {
  return event.category === 'birthday';
}
