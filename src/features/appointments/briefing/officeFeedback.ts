export type ReminderChoice = "hour" | "evening" | "morning";

function berlinParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const number = (key: string) => Number(parts.find(part => part.type === key)?.value);
  return { year: number("year"), month: number("month"), day: number("day"), hour: number("hour") };
}

export function officeReminderTime(choice: ReminderChoice, now = new Date()): string {
  if (choice === "hour") return new Date(now.getTime() + 3600_000).toISOString();
  const local = berlinParts(now);
  const hour = choice === "morning" ? 8 : 18;
  const nextDay = choice === "morning" || local.hour >= hour;
  const wallTime = Date.UTC(local.year, local.month - 1, local.day + Number(nextDay), hour);
  // Berlin uses UTC+1 or UTC+2. Match the requested wall clock across DST changes.
  for (const offset of [1, 2]) {
    const candidate = new Date(wallTime - offset * 3600_000);
    const parts = berlinParts(candidate);
    const expected = new Date(wallTime);
    if (parts.year === expected.getUTCFullYear() && parts.month === expected.getUTCMonth() + 1
      && parts.day === expected.getUTCDate() && parts.hour === hour) return candidate.toISOString();
  }
  throw new Error("Erinnerungszeit konnte nicht bestimmt werden.");
}

export function needsOfficeFeedback(feedback: { feedback_status: string; notes: string | null } | null): boolean {
  return !feedback || (feedback.feedback_status === "pending" && !feedback.notes?.trim());
}

export function isOlderOfficeFeedback(start: string, now = new Date()): boolean {
  const day = (date: Date) => {
    const parts = berlinParts(date);
    return Date.UTC(parts.year, parts.month - 1, parts.day);
  };
  return day(new Date(start)) < day(now);
}

export interface OfficeSnooze {
  until: string;
  count: number;
}

/** Keep reminders saved before the counter was introduced readable. */
export function readOfficeSnooze(value: string | OfficeSnooze | undefined): OfficeSnooze | null {
  if (typeof value === "string") return { until: value, count: 1 };
  if (!value || typeof value.until !== "string") return null;
  return { until: value.until, count: Number.isFinite(value.count) ? Math.max(0, Math.floor(value.count)) : 0 };
}

export function isOfficeReminderDue(value: string | OfficeSnooze | undefined, now = new Date()): boolean {
  const reminder = readOfficeSnooze(value);
  const timestamp = Date.parse(reminder?.until ?? "");
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

export function showsOfficeTaskHint(value: string | OfficeSnooze | undefined, now = new Date()): boolean {
  const reminder = readOfficeSnooze(value);
  return (reminder?.count ?? 0) >= 2 && Date.parse(reminder?.until ?? "") > now.getTime();
}

export function officeReminderLabel(until: string, now = new Date()): string {
  const date = new Date(until);
  const current = berlinParts(now);
  const target = berlinParts(date);
  const today = Date.UTC(current.year, current.month - 1, current.day);
  const targetDay = Date.UTC(target.year, target.month - 1, target.day);
  const dayLabel = targetDay === today ? "" : targetDay === today + 86400_000 ? "morgen "
    : "am " + new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "numeric" }).format(date) + " ";
  const time = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", hour: "numeric", minute: "2-digit", hourCycle: "h23",
  }).format(date).replace(/:00$/, "");
  const minutes = Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 60_000));
  const relative = new Intl.RelativeTimeFormat("de-DE").format(
    minutes < 60 ? minutes : Math.ceil(minutes / 60), minutes < 60 ? "minute" : "hour",
  );
  return `Erinnerung ${dayLabel}um ${time} Uhr (${relative})`;
}
