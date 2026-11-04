import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDeadlineDateLabel, getDeadlineStatus, groupDeadlineItems } from '../deadlineFormatting';
import type { DeadlineItem } from '@/types/dashboardDeadlines';

const item = (id: string, dueDate: string, priority = 0): DeadlineItem => ({ id, title: id, dueDate, priority, type: 'task', canSnooze: true });
describe('dashboard deadline calendar groups', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 4, 15)); });
  afterEach(() => vi.useRealTimers());
  it('separates today from tomorrow through Sunday, excluding next Monday', () => {
    expect(getDeadlineStatus('2026-11-04')).toBe('today');
    expect(getDeadlineStatus('2026-11-05')).toBe('soon');
    expect(getDeadlineStatus('2026-11-08T23:59:00')).toBe('soon');
    expect(getDeadlineStatus('2026-11-09')).toBe('later');
  });
  it('does not treat a passed time today as a previous-day deadline', () => {
    expect(getDeadlineStatus('2026-11-04T08:00:00')).toBe('today');
    expect(formatDeadlineDateLabel('2026-11-04T08:00:00')).toBe('Heute 08:00');
  });
  it('shows overdue age with correct singular/plural', () => {
    expect(formatDeadlineDateLabel('2026-11-03')).toBe('seit 1 Tag überfällig');
    expect(formatDeadlineDateLabel('2026-10-23')).toBe('seit 12 Tagen überfällig');
  });
  it('puts high-priority overdue work first, then recent work, with disjoint counts', () => {
    const input = [item('old', '2026-02-01'), item('recent', '2026-11-03'), item('urgent', '2026-02-02', 3), item('today', '2026-11-04'), item('week', '2026-11-06'), item('later', '2026-11-20')];
    const groups = groupDeadlineItems(input);
    expect(groups.overdue.map(entry => entry.id)).toEqual(['urgent', 'recent', 'old']);
    expect(groups.today.map(entry => entry.id)).toEqual(['today']);
    expect(groups.thisWeek.map(entry => entry.id)).toEqual(['week']);
    expect(groups.later.map(entry => entry.id)).toEqual(['later']);
    expect(Object.values(groups).flat()).toHaveLength(input.length);
    expect(input[0].id).toBe('old');
  });
  it('starts a new week on Monday without including the following Monday', () => {
    vi.setSystemTime(new Date(2026, 10, 9, 12));
    expect(getDeadlineStatus('2026-11-08')).toBe('overdue');
    expect(getDeadlineStatus('2026-11-15')).toBe('soon');
    expect(getDeadlineStatus('2026-11-16')).toBe('later');
  });
});
