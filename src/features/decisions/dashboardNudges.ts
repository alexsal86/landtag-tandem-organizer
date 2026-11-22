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

export function decisionNudgeSecondsRemaining(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function decisionNudgePriority(nudgedAt: string | null | undefined, now = new Date()): number {
  if (!nudgedAt || canNudgeDecision(nudgedAt, now)) return 0;
  const timestamp = Date.parse(nudgedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}
