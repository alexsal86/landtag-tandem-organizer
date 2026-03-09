import { describe, it, expect } from 'vitest';
import { isValidEmail, formatGermanDate, cn } from '@/lib/utils';

describe('cn', () => {
  it('merges tailwind classes', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('px-4 py-1');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra');
  });
});

describe('isValidEmail', () => {
  it('validates correct emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.de')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@missing.com')).toBe(false);
  });

  it('handles null/undefined gracefully', () => {
    expect(isValidEmail(null as any)).toBe(false);
    expect(isValidEmail(undefined as any)).toBe(false);
  });
});

describe('formatGermanDate', () => {
  it('formats ISO date to German format', () => {
    const result = formatGermanDate('2024-03-15');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/03|3|März/);
  });
});
