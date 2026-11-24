import { eachDayOfInterval, format, isWeekend, parseISO } from "date-fns";

/** Absence types that reduce the weekly target of a team member. */
export const WEEK_TARGET_ABSENCE_TYPES = ["vacation", "sick"] as const;

export const BADEN_WUERTTEMBERG_STATE = "BW";

const DEFAULT_HOURS_PER_WEEK = 40;
const DEFAULT_DAYS_PER_WEEK = 5;
const MAX_DAYS_PER_WEEK = 7;

export interface PublicHolidayRow {
  holiday_date: string;
  state?: string | null;
  is_nationwide?: boolean | null;
}

export interface WeeklyAbsence {
  start_date: string;
  end_date: string | null;
}

export interface WeeklyTargetInput {
  hoursPerWeek: number | null;
  daysPerWeek: number | null;
  /** Monday of the evaluated week as yyyy-MM-dd. */
  weekStart: string;
  /** Last evaluated day (usually today) as yyyy-MM-dd. */
  today: string;
  holidays?: PublicHolidayRow[];
  absences?: WeeklyAbsence[];
}

export interface WeeklyTargetResult {
  targetMinutes: number;
  dailyMinutes: number;
  workDaysElapsed: number;
  holidayDays: number;
  absenceDays: number;
}

/**
 * Nationwide holidays and Baden-Württemberg holidays count; holidays of other
 * federal states do not.
 */
export function isBadenWuerttembergHoliday(holiday: PublicHolidayRow | null | undefined): boolean {
  if (!holiday) return false;
  if (holiday.state && holiday.state !== BADEN_WUERTTEMBERG_STATE) return false;
  return holiday.is_nationwide !== false || holiday.state === BADEN_WUERTTEMBERG_STATE;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveDaysPerWeek(daysPerWeek: number | null): number {
  if (!Number.isFinite(daysPerWeek) || (daysPerWeek as number) < 1) return DEFAULT_DAYS_PER_WEEK;
  return Math.min(MAX_DAYS_PER_WEEK, Math.round(daysPerWeek as number));
}

/**
 * Daily quota = weekly hours split across the configured working days.
 * Elapsed working days (Mon–Fri) raise the target, but it never exceeds the
 * weekly hours. Holidays and approved vacation/sick days are not counted.
 */
export function calculateWeeklyTarget({
  hoursPerWeek,
  daysPerWeek,
  weekStart,
  today,
  holidays = [],
  absences = [],
}: WeeklyTargetInput): WeeklyTargetResult {
  const weeklyHours =
    Number.isFinite(hoursPerWeek) && (hoursPerWeek as number) > 0 ? (hoursPerWeek as number) : DEFAULT_HOURS_PER_WEEK;
  const workingDaysPerWeek = resolveDaysPerWeek(daysPerWeek);
  const dailyMinutes = Math.round((weeklyHours * 60) / workingDaysPerWeek);
  const empty: WeeklyTargetResult = {
    targetMinutes: 0,
    dailyMinutes,
    workDaysElapsed: 0,
    holidayDays: 0,
    absenceDays: 0,
  };

  const start = toDate(weekStart);
  const end = toDate(today);
  if (!start || !end || end < start) return empty;

  const holidayDates = new Set(holidays.filter(isBadenWuerttembergHoliday).map((holiday) => holiday.holiday_date));
  const absenceDates = new Set<string>();
  absences.forEach((absence) => {
    const from = toDate(absence.start_date);
    const to = toDate(absence.end_date ?? absence.start_date);
    if (!from || !to || to < from) return;
    eachDayOfInterval({ start: from, end: to }).forEach((day) => absenceDates.add(format(day, "yyyy-MM-dd")));
  });

  let workDaysElapsed = 0;
  let holidayDays = 0;
  let absenceDays = 0;

  eachDayOfInterval({ start, end }).forEach((day) => {
    if (isWeekend(day)) return;
    const dateKey = format(day, "yyyy-MM-dd");
    if (holidayDates.has(dateKey)) {
      holidayDays += 1;
      return;
    }
    workDaysElapsed += 1;
    if (absenceDates.has(dateKey)) absenceDays += 1;
  });

  const countedDays = Math.max(0, Math.min(workDaysElapsed, workingDaysPerWeek) - absenceDays);

  return {
    targetMinutes: countedDays * dailyMinutes,
    dailyMinutes,
    workDaysElapsed,
    holidayDays,
    absenceDays,
  };
}
