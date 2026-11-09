import { addDays, endOfDay, startOfDay } from 'date-fns';

export function agendaHorizon(date: string | Date, days: number) {
  const start = startOfDay(new Date(date));
  return { start: start.toISOString(), end: endOfDay(addDays(start, days)).toISOString() };
}

export function criticalTaskReason(task: { status: string; nudge_count: number | null; next_action_due: string | null; due_date: string | null }, now: Date) {
  if (task.status === 'completed') return null;
  const due = task.next_action_due || task.due_date;
  if (due && new Date(due).getTime() < addDays(now, -7).getTime()) return 'Mehr als 7 Tage überfällig';
  if ((task.nudge_count ?? 0) >= 2) return 'Mehrfach angestupst';
  return null;
}

/** Ampel für die Termin-Rückschau: Nachbereitung fehlt / Notizen ohne Folgeaufgaben / erledigt. */
export function pastAppointmentReview(feedback: { feedback_status: string; notes: string | null; has_tasks: boolean | null } | null | undefined, openPromises = 0) {
  if (openPromises > 0) return { status: `${openPromises} offene ${openPromises === 1 ? 'Zusage' : 'Zusagen'}`, open: true };
  if (!feedback || !feedback.notes?.trim()) return { status: 'Nachbereitung fehlt', open: true };
  if (feedback.feedback_status !== 'completed') return { status: 'Notizen da · nicht abgeschlossen', open: true };
  return { status: feedback.has_tasks ? 'Nachbereitet · Folgeaufgaben' : 'Nachbereitet', open: false };
}

export interface MeetingEntryResult { result: string; completed?: boolean; follow_up?: boolean; assigned_to?: string[]; due_at?: string }
export function parseMeetingResults(text?: string | null): Record<string, MeetingEntryResult> {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, value]) => {
      if (typeof value === 'string') return [[id, { result: value }]];
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const row = value as Record<string, unknown>;
      return [[id, {
        result: typeof row.result === 'string' ? row.result : '',
        completed: row.completed === true,
        follow_up: row.follow_up === true,
        assigned_to: Array.isArray(row.assigned_to) ? row.assigned_to.filter((v): v is string => typeof v === 'string') : undefined,
        due_at: typeof row.due_at === 'string' ? row.due_at : undefined,
      }]];
    }));
  } catch { return {}; }
}