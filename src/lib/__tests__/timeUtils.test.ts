import { describe, it, expect } from 'vitest';
import { formatTimeRange, formatDuration, isMultiDayEvent } from '@/lib/timeUtils';

describe('formatTimeRange', () => {
  it('returns start time when no end time', () => {
    expect(formatTimeRange('09:00')).toBe('09:00');
  });

  it('formats a range with end time string', () => {
    const result = formatTimeRange('09:00', '11:00');
    expect(result).toContain('09:00');
  });
});

describe('isMultiDayEvent', () => {
  it('returns false for same-day events', () => {
    const start = new Date('2024-03-15T09:00:00');
    const end = new Date('2024-03-15T17:00:00');
    expect(isMultiDayEvent(start, end)).toBe(false);
  });

  it('returns true for multi-day events', () => {
    const start = new Date('2024-03-15T09:00:00');
    const end = new Date('2024-03-16T17:00:00');
    expect(isMultiDayEvent(start, end)).toBe(true);
  });
});
