import { describe, expect, it } from 'vitest';

import {
  assertPresent,
  createHookResult,
  createHookTuple,
  hasOwnProperty,
  hasStringProperty,
  invokeCallback,
  isPresent,
  isRecord,
  normalizeSupabaseResult,
  requireSupabaseData,
  toArray,
} from '@/utils/typeSafety';

describe('typeSafety', () => {
  it('identifies records and properties safely', () => {
    const value: unknown = { message: 'ok', count: 2 };

    expect(isRecord(value)).toBe(true);
    expect(hasOwnProperty(value, 'count')).toBe(true);
    expect(hasStringProperty(value, 'message')).toBe(true);
    expect(hasStringProperty(value, 'count')).toBe(false);
  });

  it('supports present/null helpers', () => {
    expect(isPresent('value')).toBe(true);
    expect(isPresent(null)).toBe(false);
    expect(() => assertPresent(undefined, 'missing')).toThrow('missing');
  });

  it('normalizes array-like values', () => {
    expect(toArray('one')).toEqual(['one']);
    expect(toArray(['one', 'two'])).toEqual(['one', 'two']);
    expect(toArray(null)).toEqual([]);
  });

  it('invokes optional callbacks without branching at call-sites', () => {
    const calls: string[] = [];

    invokeCallback((value: string) => calls.push(value), 'done');
    invokeCallback(undefined, 'ignored');

    expect(calls).toEqual(['done']);
  });

  it('normalizes supabase-style responses', () => {
    expect(normalizeSupabaseResult({ data: [{ id: 1 }], error: null }).hasData).toBe(true);
    expect(normalizeSupabaseResult({ data: null, error: { message: 'kaputt' } }).errorMessage).toBe('kaputt');
  });

  it('requires typed supabase data eagerly', () => {
    expect(requireSupabaseData({ data: { id: 1 }, error: null })).toEqual({ id: 1 });
    expect(() => requireSupabaseData({ data: null, error: null }, 'missing data')).toThrow('missing data');
  });

  it('builds explicit hook return shapes', () => {
    expect(createHookResult('value', true, 'error')).toEqual({ data: 'value', isLoading: true, error: 'error' });
    expect(createHookTuple('value', false, null)).toEqual(['value', false, null]);
  });
});
