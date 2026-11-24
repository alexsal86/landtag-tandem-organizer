/**
 * Arbeitszeitgesetz (ArbZG) rules for the time tracking.
 *
 * § 3 limits the daily working time to 10 hours (existing hard block),
 * § 4 requires rest breaks: 30 minutes above 6 hours and 45 minutes above
 * 9 hours of working time.
 */

export const ARBZG_MAX_DAILY_WORK_MINUTES = 10 * 60;

export const ARBZG_BREAK_MINUTES_ABOVE_SIX_HOURS = 30;
export const ARBZG_BREAK_MINUTES_ABOVE_NINE_HOURS = 45;

export interface ArbzgDayCheck {
  requiredPauseMinutes: number;
  pauseMinutes: number;
  missingPauseMinutes: number;
  compliant: boolean;
  exceedsMaxDailyWork: boolean;
}

/** Statutory rest break for a gross working time in minutes. */
export function requiredBreakMinutes(workMinutes: number): number {
  if (!Number.isFinite(workMinutes) || workMinutes <= 0) return 0;
  if (workMinutes > 9 * 60) return ARBZG_BREAK_MINUTES_ABOVE_NINE_HOURS;
  if (workMinutes > 6 * 60) return ARBZG_BREAK_MINUTES_ABOVE_SIX_HOURS;
  return 0;
}

export function checkArbzgDay({
  workedMinutes,
  pauseMinutes,
}: {
  workedMinutes: number;
  pauseMinutes: number;
}): ArbzgDayCheck {
  const worked = Number.isFinite(workedMinutes) ? Math.max(0, workedMinutes) : 0;
  const pause = Number.isFinite(pauseMinutes) ? Math.max(0, pauseMinutes) : 0;
  const requiredPauseMinutes = requiredBreakMinutes(worked);
  const missingPauseMinutes = Math.max(0, requiredPauseMinutes - pause);

  return {
    requiredPauseMinutes,
    pauseMinutes: pause,
    missingPauseMinutes,
    compliant: missingPauseMinutes === 0,
    exceedsMaxDailyWork: worked > ARBZG_MAX_DAILY_WORK_MINUTES,
  };
}

function parseClockTime(value: string, reference: Date): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  const result = new Date(reference);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Net worked minutes of a running punch clock. While a pause is running the
 * elapsed time is measured up to its start.
 */
export function elapsedWorkedMinutes(
  clockIn: string,
  pauseStart: string | null,
  pauseTotalMinutes: number,
  now: Date = new Date(),
): number {
  const start = parseClockTime(clockIn, now);
  if (!start) return 0;
  const pauseFrom = pauseStart ? parseClockTime(pauseStart, now) : null;
  const end = pauseFrom ?? now;
  const gross = Math.round((end.getTime() - start.getTime()) / 60000);
  const pause = Number.isFinite(pauseTotalMinutes) ? Math.max(0, pauseTotalMinutes) : 0;
  return Math.max(0, gross - pause);
}
