import { format, isToday, isTomorrow, isPast, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import type { DeadlineKind } from '@/types/dashboardDeadlines';

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
  const diff = differenceInCalendarDays(d, new Date());
  if (diff <= 7) return 'soon';
  return 'later';
}

export function formatDeadlineDateLabel(dueDate: string): string {
  const d = new Date(dueDate);
  const hasTime = /\d{2}:\d{2}/.test(dueDate);
  const time = hasTime ? format(d, 'HH:mm', { locale: de }) : null;

  if (isToday(d)) return time ? `Heute ${time}` : 'Heute';
  if (isTomorrow(d)) return time ? `Morgen ${time}` : 'Morgen';
  if (isPast(d)) return `überfällig · ${format(d, 'dd.MM.', { locale: de })}`;
  return format(d, 'EEE, dd.MM.', { locale: de });
}

export function getDeadlineContextLabel(type: DeadlineKind): string {
  return TYPE_CONTEXT_LABEL[type];
}

export const DEADLINE_STATUS_BAR_CLASS: Record<DeadlineStatus, string> = {
  overdue: 'bg-destructive',
  today: 'bg-palette-green',
  soon: 'bg-palette-amber',
  later: 'bg-muted-foreground/30',
};
