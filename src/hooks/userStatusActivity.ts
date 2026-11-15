export const USER_STATUS_ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;

interface ActivityWriteGate {
  now: number;
  lastWrite: number;
  writePending: boolean;
  hasStatusContext: boolean;
}

export function shouldPersistUserStatusActivity({
  now,
  lastWrite,
  writePending,
  hasStatusContext,
}: ActivityWriteGate): boolean {
  return hasStatusContext
    && !writePending
    && now - lastWrite >= USER_STATUS_ACTIVITY_WRITE_INTERVAL_MS;
}
