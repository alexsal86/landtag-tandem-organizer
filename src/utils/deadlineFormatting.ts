import { format, isToday, isTomorrow, isPast, endOfWeek, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import type { DeadlineItem, GroupedDeadlineItems, DeadlineKind } from '@/types/dashboardDeadlines';

const TYPE_CONTEXT_LABEL: Record<DeadlineKind, string> = {
  task: 'Aufgabe',
  note: 'Notiz',
  case: 'Vorgang',
  decision: 'Entscheidung',
  eventPlanning: 'Veranstaltung',
};

export type DeadlineStatus = 'overdue' | 'today' | 'soon' | 'later';

export function getDeadlineStatus(dueDate: string): DeadlineStatus {
  const d = new Date(dueDate);
  if (isToday(d)) return 'today';
  if (isPast(d)) return 'overdue';
  if (d <= endOfWeek(new Date(), { weekStartsOn: 1 })) return 'soon';
  return 'later';
}

export function formatDeadlineDateLabel(dueDate: string): string {
  const d = new Date(dueDate);
  // Date-only deadlines are also stored as timestamps at local midnight.
  const hasTime = /\d{2}:\d{2}/.test(dueDate) &&
    (d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0);
  const time = hasTime ? format(d, 'HH:mm', { locale: de }) : null;

  if (isToday(d)) return time ? `Heute ${time}` : 'Heute';
  if (isTomorrow(d)) return time ? `Morgen ${time}` : 'Morgen';
  if (isPast(d)) {
    const days = differenceInCalendarDays(new Date(), d);
    return `seit ${days} ${days === 1 ? 'Tag' : 'Tagen'} überfällig`;
  }
  return format(d, 'EEE, dd.MM.', { locale: de });
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

/** Disjoint calendar groups: today, tomorrow through Sunday, and following weeks. */
export function groupDeadlineItems(items: DeadlineItem[]): GroupedDeadlineItems {
  const groups: GroupedDeadlineItems = { overdue: [], today: [], thisWeek: [], later: [] };
  for (const item of items) {
    const status = getDeadlineStatus(item.dueDate);
    groups[status === 'soon' ? 'thisWeek' : status].push(item);
  }
  for (const list of [groups.today, groups.thisWeek, groups.later]) {
    list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }
  groups.overdue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
  return groups;
}
