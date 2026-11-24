export const DECISION_NUDGE_WINDOW_MS = 10_000;
export const DECISION_NUDGE_COOLDOWN_MS = 24 * 3600_000;

export function canNudgeDecision(nudgedAt: string | null, now = new Date()): boolean {
  if (!nudgedAt) return true;
  const sent = Date.parse(nudgedAt);
  return Number.isFinite(sent) && now.getTime() - sent >= DECISION_NUDGE_COOLDOWN_MS;
}

export const decisionNudgeTime = (value: string) => new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit",
}).format(new Date(value));

export function decisionNudgeDateTime(value: string, now = new Date()): string {
  const date = new Date(value);
  const day = (input: Date) => new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(input).reduce((parts, part) => {
    if (part.type === "year" || part.type === "month" || part.type === "day") parts[part.type] = part.value;
    return parts;
  }, {} as Record<"year" | "month" | "day", string>);
  const today = day(now);
  const sent = day(date);
  const calendarDays = Math.round((Date.UTC(+today.year, +today.month - 1, +today.day) - Date.UTC(+sent.year, +sent.month - 1, +sent.day)) / 86_400_000);
  const prefix = calendarDays === 0 ? "heute" : calendarDays === 1 ? "gestern" : calendarDays === 2 ? "vorgestern"
    : new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  return `${prefix} um ${decisionNudgeTime(value)}`;
}

export function decisionNudgeSecondsRemaining(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function decisionNudgePriority(nudgedAt: string | null | undefined, now = new Date()): number {
  if (!nudgedAt || canNudgeDecision(nudgedAt, now)) return 0;
  const timestamp = Date.parse(nudgedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}
