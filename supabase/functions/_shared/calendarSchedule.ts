export type ScheduleConfig = {
  schedule_kind?: string;
  month?: string;
  day?: string;
  hour?: string;
  month_end?: string;
  timezone?: string;
  minutes_interval?: string | number;
};

export const CALENDAR_KINDS = ["annual", "monthly", "quarterly"] as const;
export function isCalendarSchedule(config: ScheduleConfig): boolean {
  return CALENDAR_KINDS.some(kind => kind === config.schedule_kind);
}

export function validateCalendarSchedule(config: ScheduleConfig): string | null {
  if (!isCalendarSchedule(config)) return "Ungültiger Stichtagstyp.";
  if (config.timezone !== "Europe/Berlin") return "Die Zeitzone muss Europe/Berlin sein.";
  const hour = Number(config.hour);
  const day = Number(config.day);
  const month = Number(config.month);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !config.hour?.trim()) return "Uhrzeit muss zwischen 0 und 23 liegen.";
  if (!Number.isInteger(day) || day < 1 || day > 31 || !config.day?.trim()) return "Tag muss zwischen 1 und 31 liegen.";
  if (config.schedule_kind === "annual") {
    if (!Number.isInteger(month) || month < 1 || month > 12) return "Monat muss zwischen 1 und 12 liegen.";
    if (config.month_end !== "true" && day > new Date(Date.UTC(2024, month, 0)).getUTCDate()) return "Dieser Tag existiert in dem Monat nicht.";
  }
  return null;
}

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour") };
}

function dayInMonth(config: ScheduleConfig, year: number, month: number): number {
  const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return config.month_end === "true" ? end : Math.min(Number(config.day), end);
}

function matchesMonth(config: ScheduleConfig, month: number): boolean {
  return config.schedule_kind === "annual" ? month === Number(config.month)
    : config.schedule_kind === "quarterly" ? [3, 6, 9, 12].includes(month) : true;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Only today's occurrence is eligible: disabled/paused days are not backfilled. */
export function calendarOccurrence(config: ScheduleConfig, now: Date): string | null {
  if (validateCalendarSchedule(config)) return null;
  const local = localParts(now);
  if (!matchesMonth(config, local.month) || local.day !== dayInMonth(config, local.year, local.month) || local.hour < Number(config.hour)) return null;
  return dateKey(local.year, local.month, local.day);
}

function berlinInstant(year: number, month: number, day: number, hour: number): Date {
  // Fixed-point conversion handles CET/CEST; missing 02:00 resolves at 03:00.
  const wall = Date.UTC(year, month - 1, day, hour);
  let utc = wall;
  for (let i = 0; i < 4; i++) {
    const local = localParts(new Date(utc));
    const delta = wall - Date.UTC(local.year, local.month - 1, local.day, local.hour);
    if (delta === 0) return new Date(utc);
    utc += delta;
  }
  return new Date(Math.max(utc, utc + 3600000));
}

export function nextCalendarOccurrence(config: ScheduleConfig, now: Date): Date | null {
  if (validateCalendarSchedule(config)) return null;
  const local = localParts(now);
  for (let offset = 0; offset < 25; offset++) {
    const base = new Date(Date.UTC(local.year, local.month - 1 + offset, 1));
    const year = base.getUTCFullYear(), month = base.getUTCMonth() + 1;
    if (!matchesMonth(config, month)) continue;
    const candidate = berlinInstant(year, month, dayInMonth(config, year, month), Number(config.hour));
    if (candidate > now) return candidate;
  }
  return null;
}

export function scheduleRunKey(ruleId: string, occurrence: string): string {
  return `${ruleId}-calendar-${occurrence}`;
}