import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, leadingEdgeDebounce } from '@/utils/debounce';

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('delays execution by the specified time', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced('a');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledWith('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('first');
    vi.advanceTimersByTime(200);
    debounced('second');
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('second');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses default delay of 300ms', () => {
    const fn = vi.fn();
    const debounced = debounce(fn);

    debounced();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('leadingEdgeDebounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('fires immediately on the first call', () => {
    const fn = vi.fn();
    const debounced = leadingEdgeDebounce(fn, 300);

    debounced('a');
    expect(fn).toHaveBeenCalledWith('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores subsequent calls within the delay window', () => {
    const fn = vi.fn();
    const debounced = leadingEdgeDebounce(fn, 300);

    debounced('first');
    debounced('second');
    debounced('third');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');
  });

  it('allows a new call after the delay window resets', () => {
    const fn = vi.fn();
    const debounced = leadingEdgeDebounce(fn, 300);

    debounced('first');
    vi.advanceTimersByTime(300);
    debounced('second');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('second');
  });
});
