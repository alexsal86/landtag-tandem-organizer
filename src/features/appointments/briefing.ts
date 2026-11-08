// Pure rules for appointment briefings (decide need → assign → review → approve).
export type BriefingStatus = "undecided" | "none" | "assigned" | "in_review" | "approved";
export type BriefingAction = "submit" | "approve" | "return";

export const BRIEFING_STATUS_LABELS: Record<BriefingStatus, string> = {
  undecided: "Briefing offen",
  none: "Kein Briefing",
  assigned: "In Zuarbeit",
  in_review: "Zur Freigabe",
  approved: "Freigegeben",
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
