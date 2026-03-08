import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debugConsole, isDebugConsoleEnabled } from '../debugConsole';

describe('isDebugConsoleEnabled', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when not set', () => {
    expect(isDebugConsoleEnabled()).toBe(false);
  });

  it('returns true when set to "true"', () => {
    localStorage.setItem('matrix_debug_console', 'true');
    expect(isDebugConsoleEnabled()).toBe(true);
  });

  it('returns false when set to other value', () => {
    localStorage.setItem('matrix_debug_console', 'false');
    expect(isDebugConsoleEnabled()).toBe(false);
  });
});

describe('debugConsole', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not log when disabled', () => {
    const spy = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    debugConsole.log('test');
    expect(spy).not.toHaveBeenCalled();
  });

  it('logs when enabled', () => {
    localStorage.setItem('matrix_debug_console', 'true');
    const spy = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
    debugConsole.log('hello', 42);
    expect(spy).toHaveBeenCalledWith('hello', 42);
  });

  it('calls console.error when enabled', () => {
    localStorage.setItem('matrix_debug_console', 'true');
    const spy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});
    debugConsole.error('err');
    expect(spy).toHaveBeenCalledWith('err');
  });

  it('calls console.warn when enabled', () => {
    localStorage.setItem('matrix_debug_console', 'true');
    const spy = vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {});
    debugConsole.warn('warning');
    expect(spy).toHaveBeenCalledWith('warning');
  });

  it('calls console.info when enabled', () => {
    localStorage.setItem('matrix_debug_console', 'true');
    const spy = vi.spyOn(globalThis.console, 'info').mockImplementation(() => {});
    debugConsole.info('info');
    expect(spy).toHaveBeenCalledWith('info');
  });
});
