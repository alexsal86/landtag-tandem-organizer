import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getErrorMessage, handleAppError } from '../errorHandler';

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
});

describe('handleAppError', () => {
  beforeEach(() => {
    localStorage.setItem('matrix_debug_console', 'true');
  });

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
});
