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

export interface ArbzgEntryLike {
  started_at?: string | null;
  ended_at?: string | null;
  pause_minutes?: number | null;
}

export interface ArbzgDaySummary extends ArbzgDayCheck {
  /** Bruttoanwesenheit des Tages in Minuten. */
  grossMinutes: number;
  /** Tatsächlich als Pause erfasste Minuten des Tages. */
  recordedPauseMinutes: number;
  /** Tatsächlich geleistete Arbeit des Tages (brutto minus erfasste Pausen). */
  workedMinutes: number;
}

/** Bruttoanwesenheit eines Eintrags in Minuten (Start → Ende). */
export function entryGrossMinutes(entry: ArbzgEntryLike): number {
  if (!entry.started_at || !entry.ended_at) return 0;
  const start = new Date(entry.started_at).getTime();
  const end = new Date(entry.ended_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
}

/**
 * Tagesbilanz eines Arbeitstags. Die Pausenpflicht gilt für den gesamten Tag,
 * nicht für den einzelnen Eintrag: geteilter Dienst und mehrere Einträge werden
 * gemeinsam bewertet. Fehlende Ruhepausen werden nur ausgewiesen; die tatsächlich
 * geleistete Arbeit bleibt unverändert und wird nie um eine rechnerische Pause gekürzt.
 */
export function summarizeArbzgDay(entries: ArbzgEntryLike[]): ArbzgDaySummary {
  let grossMinutes = 0;
  let recordedPauseMinutes = 0;
  let workedMinutes = 0;

  for (const entry of entries) {
    const gross = entryGrossMinutes(entry);
    if (gross === 0) continue;
    const pause = Number.isFinite(entry.pause_minutes) ? Math.max(0, Math.min(entry.pause_minutes as number, gross)) : 0;
    grossMinutes += gross;
    recordedPauseMinutes += pause;
    workedMinutes += gross - pause;
  }

  const day = checkArbzgDay({ workedMinutes, pauseMinutes: recordedPauseMinutes });
  return { ...day, grossMinutes, recordedPauseMinutes, workedMinutes };
}

/**
 * Smallest statutory break for a gross span (start → end, breaks included).
 * The requirement refers to the working time that remains after the break, so
 * a 9,5 h span is covered by 30 minutes as long as the rest stays within 9 h.
 */
export function requiredPauseForSpan(grossMinutes: number): number {
  const gross = Number.isFinite(grossMinutes) ? Math.max(0, Math.round(grossMinutes)) : 0;
  const candidates = [0, ARBZG_BREAK_MINUTES_ABOVE_SIX_HOURS, ARBZG_BREAK_MINUTES_ABOVE_NINE_HOURS];
  for (const candidate of candidates) {
    if (requiredBreakMinutes(gross - candidate) <= candidate) return candidate;
  }
  return ARBZG_BREAK_MINUTES_ABOVE_NINE_HOURS;
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
