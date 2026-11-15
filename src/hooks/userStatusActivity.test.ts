import { describe, expect, it } from 'vitest';
import {
  shouldPersistUserStatusActivity,
  USER_STATUS_ACTIVITY_WRITE_INTERVAL_MS,
} from './userStatusActivity';

describe('shouldPersistUserStatusActivity', () => {
  it('allows the first write only after exactly five minutes', () => {
    const lastWrite = 1_000_000;

    expect(shouldPersistUserStatusActivity({
      now: lastWrite + USER_STATUS_ACTIVITY_WRITE_INTERVAL_MS - 1,
      lastWrite,
      writePending: false,
      hasStatusContext: true,
    })).toBe(false);

    expect(shouldPersistUserStatusActivity({
      now: lastWrite + USER_STATUS_ACTIVITY_WRITE_INTERVAL_MS,
      lastWrite,
      writePending: false,
      hasStatusContext: true,
    })).toBe(true);
  });

  it('does not start a second write while one is pending', () => {
    expect(shouldPersistUserStatusActivity({
      now: 10 * 60 * 1000,
      lastWrite: 0,
      writePending: true,
      hasStatusContext: true,
    })).toBe(false);
  });

  it('does not write without a loaded user, tenant and status', () => {
    expect(shouldPersistUserStatusActivity({
      now: 10 * 60 * 1000,
      lastWrite: 0,
      writePending: false,
      hasStatusContext: false,
    })).toBe(false);
  });
});
