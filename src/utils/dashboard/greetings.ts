import { getCurrentTimeSlot, getGreeting, TIME_SLOTS, type TimeSlot } from './timeUtils';

export const DASHBOARD_GREETINGS_KEY = 'dashboard_greetings_v1';

export interface DashboardGreeting {
  id: string;
  text: string;
  timeSlot?: TimeSlot;
  dayOfWeek?: number;
  month?: number;
}

const isInRange = (value: unknown, from: number, to: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= from && value <= to;

function isGreeting(value: unknown): value is DashboardGreeting {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Partial<DashboardGreeting>;
  return typeof rule.id === 'string'
    && typeof rule.text === 'string' && rule.text.trim().length > 0
    && (rule.timeSlot === undefined || Object.hasOwn(TIME_SLOTS, rule.timeSlot))
    && (rule.dayOfWeek === undefined || isInRange(rule.dayOfWeek, 0, 6))
    && (rule.month === undefined || isInRange(rule.month, 1, 12));
}

export function parseDashboardGreetings(raw?: string | null): DashboardGreeting[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isGreeting) : [];
  } catch {
    return [];
  }
}

export function selectDashboardGreeting(rules: DashboardGreeting[], date: Date): string {
  const timeSlot = getCurrentTimeSlot(date);
  const month = date.getMonth();
  const matches = rules.filter(rule =>
    (rule.timeSlot === undefined || rule.timeSlot === timeSlot)
    && (rule.dayOfWeek === undefined || rule.dayOfWeek === date.getDay())
    && (rule.month === undefined || rule.month === month + 1),
  );
  if (!matches.length) return getGreeting(timeSlot) + ', {name}!';
  const day = Date.UTC(date.getFullYear(), month, date.getDate()) / 86_400_000;
  const index = ((day % matches.length) + matches.length) % matches.length;
  return matches[index].text;
}

export function formatDashboardGreeting(text: string, name: string): string {
  return text.replaceAll('{name}', () => name);
}
