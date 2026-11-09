import { describe, expect, it } from 'vitest';
import { agendaHorizon, criticalTaskReason, parseMeetingResults } from './platformAgendaRules';

describe('Jour-fixe source rules', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const task = { status: 'todo', nudge_count: 0, next_action_due: null, due_date: null };
  it('escalates only repeated nudges', () => {
    expect(criticalTaskReason({ ...task, nudge_count: 1 }, now)).toBeNull();
    expect(criticalTaskReason({ ...task, nudge_count: 2 }, now)).toBe('Mehrfach angestupst');
  });
  it('escalates a task more than seven days overdue, not exactly seven', () => {
    expect(criticalTaskReason({ ...task, due_date: '2026-11-01T12:00:00Z' }, now)).toBeNull();
    expect(criticalTaskReason({ ...task, due_date: '2026-11-01T11:59:59Z' }, now)).toBe('Mehr als 7 Tage überfällig');
  });
  it('never escalates completed tasks', () => {
    expect(criticalTaskReason({ ...task, status: 'completed', nudge_count: 9, due_date: '2020-01-01' }, now)).toBeNull();
  });
  it('uses the next action deadline ahead of the old task deadline', () => {
    expect(criticalTaskReason({ ...task, due_date: '2020-01-01', next_action_due: '2026-11-10' }, now)).toBeNull();
  });
  it('preserves source IDs and explicit follow-up choices for string and object results', () => {
    expect(parseMeetingResults(JSON.stringify({ a: 'Beschluss', b: { result: 'Klärung', follow_up: true, assigned_to: ['u'], due_at: '2026-11-12' } }))).toEqual({
      a: { result: 'Beschluss' }, b: { result: 'Klärung', completed: false, follow_up: true, assigned_to: ['u'], due_at: '2026-11-12' },
    });
  });
  it('does not interpret unstructured text as a decision ID', () => {
    expect(parseMeetingResults('Freigeben')).toEqual({});
    expect(parseMeetingResults('[1,2]')).toEqual({});
  });
  it.each([7, 10, 14, 60])('covers the agreed %i-day horizon', days => {
    const range = agendaHorizon(now, days);
    const end = new Date(range.end);
    const start = new Date(range.start);
    expect(end.getDate()).toBe(new Date(2026, 10, 8 + days).getDate());
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(23);
  });
});
import { pastAppointmentReview } from './platformAgendaRules';
describe('pastAppointmentReview', () => {
  it('flags missing notes', () => expect(pastAppointmentReview(null)).toEqual({ status: 'Nachbereitung fehlt', open: true }));
  it('flags notes not completed', () => expect(pastAppointmentReview({ feedback_status: 'pending', notes: 'x', has_tasks: false }).open).toBe(true));
  it('done with tasks', () => expect(pastAppointmentReview({ feedback_status: 'completed', notes: 'x', has_tasks: true })).toEqual({ status: 'Nachbereitet · Folgeaufgaben', open: false }));
});
