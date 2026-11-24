import { eachDayOfInterval, format, getDay, parseISO } from "date-fns";

/** Absence types that reduce the weekly target of a team member. */
export const WEEK_TARGET_ABSENCE_TYPES = ["vacation", "sick"] as const;

export const BADEN_WUERTTEMBERG_STATE = "BW";

/** Monday-first labels, matching the order of employee_settings.workdays. */
export const WORKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** Default plan in employee_settings.workdays: Monday to Friday. */
export const DEFAULT_WORKDAYS: boolean[] = [true, true, true, true, true, false, false];

const DEFAULT_HOURS_PER_WEEK = 40;
const DEFAULT_DAYS_PER_WEEK = 5;
const DAYS_PER_WEEK = 7;

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
  /** Only used when no workday plan is stored. */
  daysPerWeek?: number | null;
  /** Monday-first plan from employee_settings.workdays. */
  workdays?: boolean[] | null;
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
  workDaysPerWeek: number;
  workdays: boolean[];
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

/**
 * Individual workday plan as a Monday-first array. A stored plan (up to seven
 * days, including Saturday and Sunday) wins; without one, the first
 * `daysPerWeek` days of the week are assumed.
 */
export function resolveWorkdays(
  workdays: boolean[] | null | undefined,
  daysPerWeek?: number | null,
): boolean[] {
  if (Array.isArray(workdays) && workdays.length === DAYS_PER_WEEK && workdays.some(Boolean)) {
    return workdays.map(Boolean);
  }

  const days = typeof daysPerWeek === "number" && Number.isFinite(daysPerWeek) && daysPerWeek >= 1
    ? Math.min(DAYS_PER_WEEK, Math.round(daysPerWeek))
    : DEFAULT_DAYS_PER_WEEK;

  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => index < days);
}

export function countWorkdays(workdays: boolean[] | null | undefined): number {
  return Array.isArray(workdays) ? workdays.filter(Boolean).length : 0;
}

/** "Mo, Mi, Fr" for the configured plan. */
export function formatWorkdays(workdays: boolean[] | null | undefined): string {
  if (!Array.isArray(workdays) || workdays.length !== DAYS_PER_WEEK) return "";
  return WORKDAY_LABELS.filter((_, index) => workdays[index]).join(", ");
}

/** True when the plan is the default Monday–Friday week (or no plan is stored). */
export function isDefaultWorkdays(workdays: boolean[] | null | undefined): boolean {
  if (!Array.isArray(workdays) || workdays.length !== DAYS_PER_WEEK) return true;
  return DEFAULT_WORKDAYS.every((day, index) => workdays[index] === day);
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Daily quota = weekly hours split across the employee's planned workdays.
 * Only planned days raise the target, so someone working Monday, Wednesday and
 * Friday sees 8 h on Monday and 16 h on Wednesday, not 16 h on Tuesday.
 * Weekends count when they are part of the plan. Holidays and approved
 * vacation/sick days are not counted. The target never exceeds the weekly hours.
 */
export function calculateWeeklyTarget({
  hoursPerWeek,
  daysPerWeek,
  workdays,
  weekStart,
  today,
  holidays = [],
  absences = [],
}: WeeklyTargetInput): WeeklyTargetResult {
  const weeklyHours =
    typeof hoursPerWeek === "number" && Number.isFinite(hoursPerWeek) && hoursPerWeek > 0
      ? hoursPerWeek
      : DEFAULT_HOURS_PER_WEEK;
  const plan = resolveWorkdays(workdays, daysPerWeek);
  const workDaysPerWeek = countWorkdays(plan);
  const dailyMinutes = Math.round((weeklyHours * 60) / workDaysPerWeek);
  const empty: WeeklyTargetResult = {
    targetMinutes: 0,
    dailyMinutes,
    workDaysPerWeek,
    workdays: plan,
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
    // date-fns getDay(): Sunday = 0; the plan starts on Monday.
    if (!plan[(getDay(day) + 6) % 7]) return;
    const dateKey = format(day, "yyyy-MM-dd");
    if (holidayDates.has(dateKey)) {
      holidayDays += 1;
      return;
    }
    workDaysElapsed += 1;
    if (absenceDates.has(dateKey)) absenceDays += 1;
  });

  return {
    targetMinutes: Math.max(0, workDaysElapsed - absenceDays) * dailyMinutes,
    dailyMinutes,
    workDaysPerWeek,
    workdays: plan,
    workDaysElapsed,
    holidayDays,
    absenceDays,
  };
}
