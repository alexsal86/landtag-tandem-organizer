import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getErrorMessage, handleAppError } from '../errorHandler';

// Enable debug console for all tests so debugConsole.error actually calls console.error
beforeEach(() => {
  try { localStorage.setItem('matrix_debug_console', 'true'); } catch { /* noop */ }
});

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns string errors as-is', () => {
    expect(getErrorMessage('something failed')).toBe('something failed');
  });

  it('extracts message from object with message property', () => {
    expect(getErrorMessage({ message: 'db error' })).toBe('db error');
  });

  it('returns fallback for unknown types', () => {
    expect(getErrorMessage(42)).toBe('Ein unbekannter Fehler ist aufgetreten.');
    expect(getErrorMessage(null)).toBe('Ein unbekannter Fehler ist aufgetreten.');
    expect(getErrorMessage(undefined)).toBe('Ein unbekannter Fehler ist aufgetreten.');
  });

  it('handles unknown objects with non-string message values', () => {
    expect(getErrorMessage({ message: { nested: 'failure' } })).toBe('[object Object]');
    expect(getErrorMessage({ message: ['array-failure'] })).toBe('array-failure');
    expect(getErrorMessage({ message: 500 })).toBe('500');
  });

  it('extracts message from Supabase PostgrestError-like objects', () => {
    expect(getErrorMessage({ message: 'insert violates FK', details: 'Key not present', hint: null, code: '23503' })).toBe('insert violates FK');
    expect(getErrorMessage({ message: '', details: 'fallback details' })).toBe('fallback details');
  });

  it('handles mixed error-like payloads from api clients', () => {
    const mixedError = {
      error: { code: 'PGRST116', message: 'Row not found' },
      message: 'Request failed with 404',
      status: 404,
    };

    expect(getErrorMessage(mixedError)).toBe('Request failed with 404');
  });
});

describe('handleAppError', () => {
  it('logs error with context label', () => {
    const spy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});
    const err = new Error('test');
    handleAppError(err, { context: 'myHook' });
    expect(spy).toHaveBeenCalledWith('[myHook]', 'test', err);
    spy.mockRestore();
  });

  it('shows toast when toast option provided', () => {
    vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});
    const toastFn = vi.fn();
    handleAppError(new Error('fail'), {
      toast: { fn: toastFn, title: 'Oh nein' },
    });
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Oh nein',
      description: 'fail',
      variant: 'destructive',
    });
    vi.restoreAllMocks();
  });

  it('rethrows when rethrow option is true', () => {
    vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});
    const err = new Error('rethrown');
    expect(() => handleAppError(err, { rethrow: true })).toThrow('rethrown');
    vi.restoreAllMocks();
  });

  it('does not rethrow by default', () => {
    vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});
    expect(() => handleAppError(new Error('safe'))).not.toThrow();
    vi.restoreAllMocks();
  });

  it('logs fallback message for unknown thrown values', () => {
    const spy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    handleAppError(Symbol('boom'), { context: 'symbolCase' });

    expect(spy).toHaveBeenCalledWith(
      '[symbolCase]',
      'Ein unbekannter Fehler ist aufgetreten.',
      expect.any(Symbol),
    );
    vi.restoreAllMocks();
  });

  it('uses custom toast description over extracted mixed error message', () => {
    vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});
    const toastFn = vi.fn();
    const mixedError = { message: 'backend down', status: 503, details: { retry: true } };

    handleAppError(mixedError, {
      toast: {
        fn: toastFn,
        title: 'Synchronisierung fehlgeschlagen',
        description: 'Bitte später erneut versuchen',
      },
    });

    expect(toastFn).toHaveBeenCalledWith({
      title: 'Synchronisierung fehlgeschlagen',
      description: 'Bitte später erneut versuchen',
      variant: 'destructive',
    });
    vi.restoreAllMocks();
  });
});
