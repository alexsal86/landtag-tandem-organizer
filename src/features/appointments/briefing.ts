// Pure rules for appointment briefings (decide need → assign → review → approve).
export type BriefingStatus = "undecided" | "none" | "assigned" | "in_review" | "approved" | "completed";
export type BriefingAction = "submit" | "approve" | "return";

export const BRIEFING_STATUS_LABELS: Record<BriefingStatus, string> = {
  undecided: "Briefing offen",
  none: "Kein Briefing",
  assigned: "In Zuarbeit",
  in_review: "Zur Freigabe",
  approved: "Freigegeben",
  completed: "Abgeschlossen",
};

const TRANSITIONS: Record<BriefingAction, { from: BriefingStatus; to: BriefingStatus; deciderOnly: boolean }> = {
  submit: { from: "assigned", to: "in_review", deciderOnly: false },
  approve: { from: "in_review", to: "approved", deciderOnly: true },
  return: { from: "in_review", to: "assigned", deciderOnly: true },
};

export function asBriefingStatus(s: string | null | undefined): BriefingStatus {
  return (s && s in BRIEFING_STATUS_LABELS ? s : "undecided") as BriefingStatus;
}

/** Whether a user may perform an action. Assignee may submit; only deciders approve/return. */
export function canAdvanceBriefing(status: BriefingStatus, action: BriefingAction, opts: { isDecider: boolean; isAssignee: boolean }): boolean {
  const t = TRANSITIONS[action];
  if (t.from !== status) return false;
  return t.deciderOnly ? opts.isDecider : opts.isDecider || opts.isAssignee;
}

export function nextBriefingStatus(status: BriefingStatus, action: BriefingAction): BriefingStatus | null {
  return TRANSITIONS[action].from === status ? TRANSITIONS[action].to : null;
}

/** Suggested deadline: the day before the appointment at 12:00 local, never in the past. */
export function suggestBriefingDue(appointmentStart: Date, now: Date = new Date()): Date {
  const d = new Date(appointmentStart);
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  if (d.getTime() < now.getTime()) return new Date(Math.min(appointmentStart.getTime(), now.getTime() + 3600_000));
  return d;
}

export const BRIEFING_HORIZON_DAYS = 14;

/** Appointments needing a briefing decision: undecided and starting within the horizon. */
export function needsBriefingDecision(a: { briefing_status?: string | null; start_time: string }, now: Date = new Date()): boolean {
  if (asBriefingStatus(a.briefing_status) !== "undecided") return false;
  const t = new Date(a.start_time).getTime();
  return t >= now.getTime() && t <= now.getTime() + BRIEFING_HORIZON_DAYS * 86400_000;
}

/** Approved briefings appear in the deputy's daily briefing on the appointment day. */
export function showsInDailyBriefing(a: { briefing_status?: string | null; start_time: string }, now: Date = new Date()): boolean {
  if (asBriefingStatus(a.briefing_status) !== "approved") return false;
  const d = new Date(a.start_time);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export interface PendingBriefing {
  start_time: string;
  briefing_status: string | null;
  briefing_assignee_id: string | null;
  briefing_due_at: string | null;
}

/** Reminder visibility uses Berlin calendar dates, independent of the browser timezone. */
export function needsBriefingReminder(appointment: PendingBriefing, userId: string, now = new Date()): boolean {
  if (!["undecided", "assigned"].includes(asBriefingStatus(appointment.briefing_status))) return false;
  if (appointment.briefing_assignee_id && appointment.briefing_assignee_id !== userId) return false;
  const start = Date.parse(appointment.start_time);
  if (!Number.isFinite(start) || start <= now.getTime()) return false;
  const preparation = Date.parse(appointment.briefing_due_at ?? appointment.start_time);
  const threshold = (Number.isFinite(preparation) ? preparation : start) - 86400_000;
  if (now.getTime() >= threshold) return true;

  const berlin = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date);
    const value = (key: string) => Number(parts.find(part => part.type === key)?.value);
    return Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"));
  };
  const localStart = new Date(berlin(new Date(start)));
  if (localStart.getUTCDay() !== 1) return false;
  const fridayMorning = Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth(), localStart.getUTCDate() - 3, 8);
  return berlin(now) >= fridayMorning;
}

/** Dashboard labels follow the requested workflow, independently of saved drafts. */
export function dashboardBriefingState(status: string | undefined, hasPreparation: boolean) {
  if (!status) return null; // External calendar events have no briefing assignment.
  if (status === "undecided") return { label: "Briefing nötig?", kind: "pending", canOpen: false };
  if (status === "none") return { label: "Kein Briefing angefordert", kind: "neutral", canOpen: false };
  if (status === "assigned") return { label: hasPreparation ? "Briefing in Bearbeitung" : "Briefing fehlt", kind: hasPreparation ? "pending" : "missing", canOpen: false };
  if (status === "in_review") return { label: "Briefing zur Freigabe", kind: "pending", canOpen: false };
  if (status === "approved" || status === "completed") return {
    label: hasPreparation ? "Briefing fertig" : "Briefing nicht verfügbar",
    kind: hasPreparation ? "ready" : "missing", canOpen: hasPreparation,
  };
  return { label: "Briefing-Status unbekannt", kind: "neutral", canOpen: false };
}
