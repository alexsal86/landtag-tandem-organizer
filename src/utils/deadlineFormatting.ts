import type { DeadlineItem, GroupedDeadlineItems, DeadlineKind } from '@/types/dashboardDeadlines';
import {
  berlinClock,
  berlinDayKey,
  berlinDaysSince,
  berlinWeekEnd,
  berlinWeekdayShortDate,
  shiftBerlinDay,
} from '@/utils/berlinDate';

const TYPE_CONTEXT_LABEL: Record<DeadlineKind, string> = {
  task: 'Aufgabe',
  note: 'Notiz',
  case: 'Vorgang',
  caseAction: 'Nächster Schritt',
  decision: 'Entscheidung',
  eventPlanning: 'Veranstaltung',
};

export type DeadlineStatus = 'overdue' | 'today' | 'soon' | 'later';

/**
 * Fristen werden über Berliner Kalendertage bewertet. `new Date('2026-11-25')`
 * ist UTC-Mitternacht (in Berlin 01:00) und darf den Tag deshalb nicht
 * verschieben; „bald“ reicht bis Sonntag der laufenden Woche.
 */
export function getDeadlineStatus(dueDate: string, now: Date = new Date()): DeadlineStatus {
  const due = berlinDayKey(dueDate);
  const today = berlinDayKey(now);
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return due <= berlinWeekEnd(today) ? 'soon' : 'later';
}

export function formatDeadlineDateLabel(dueDate: string, now: Date = new Date()): string {
  // Reine Datumsangaben haben keine Uhrzeit; echte Zeitstempel um 00:00 Berlin
  // zeigen bewusst nur den Tag.
  const hasTime = /\d{2}:\d{2}/.test(dueDate) && berlinClock(dueDate) !== '00:00';
  const time = hasTime ? berlinClock(dueDate) : null;
  const due = berlinDayKey(dueDate);
  const today = berlinDayKey(now);

  if (due === today) return time ? `Heute ${time}` : 'Heute';
  if (due === shiftBerlinDay(today, 1)) return time ? `Morgen ${time}` : 'Morgen';
  if (due < today) {
    const days = berlinDaysSince(dueDate, now);
    return `seit ${days} ${days === 1 ? 'Tag' : 'Tagen'} überfällig`;
  }
  return berlinWeekdayShortDate(dueDate);
}

export function getDeadlineContextLabel(type: DeadlineKind): string {
  return TYPE_CONTEXT_LABEL[type];
}

export const DEADLINE_STATUS_BAR_CLASS: Record<DeadlineStatus, string> = {
  overdue: 'bg-destructive',
  today: 'bg-palette-amber',
  soon: 'bg-palette-blue',
  later: 'bg-muted-foreground/30',
};

/**
 * Disjoint calendar groups: today, tomorrow through Sunday, and following weeks.
 * `now` macht den Bezugstag explizit, damit ein offener Tab die Einordnung am
 * Kalendertagwechsel neu berechnen kann, ohne die Daten erneut zu laden.
 */
export function groupDeadlineItems(items: DeadlineItem[], now: Date = new Date()): GroupedDeadlineItems {
  const groups: GroupedDeadlineItems = { overdue: [], today: [], thisWeek: [], later: [] };
  for (const item of items) {
    const status = getDeadlineStatus(item.dueDate, now);
    groups[status === 'soon' ? 'thisWeek' : status].push(item);
  }
  for (const list of [groups.today, groups.thisWeek, groups.later]) {
    list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }
  groups.overdue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
  return groups;
}
