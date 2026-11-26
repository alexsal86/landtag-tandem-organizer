import { sortDebriefReports, type DebriefEvent, type DebriefReport } from "@/features/appointments/briefing/officeDebriefInbox";
import type { DeadlineItem } from "@/types/dashboardDeadlines";
import { berlinDayKey } from "@/utils/berlinDate";
import { getReviewableOverdueDeadlines } from "@/utils/deadlineFormatting";

type PendingBriefing = {
  id: string;
  title: string;
  start_time: string;
  briefing_due_at: string | null;
};

export type TodayPriority =
  | { kind: "today"; briefing: PendingBriefing }
  | { kind: "promise" | "report"; report: DebriefReport }
  | { kind: "followUp"; event: DebriefEvent }
  | { kind: "deadlines"; items: DeadlineItem[] };

export function buildTodayPriorities(
  briefings: PendingBriefing[],
  reports: DebriefReport[],
  missing: DebriefEvent[],
  overdue: DeadlineItem[],
  now = new Date(),
): TodayPriority[] {
  const today = berlinDayKey(now);
  const due = (briefing: PendingBriefing) => briefing.briefing_due_at ?? briefing.start_time;
  const dueToday = briefings
    .filter(briefing => Date.parse(briefing.start_time) > now.getTime()
      && (berlinDayKey(due(briefing)) <= today || berlinDayKey(briefing.start_time) === today))
    .sort((a, b) => Date.parse(due(a)) - Date.parse(due(b)));
  const oldDeadlines = getReviewableOverdueDeadlines(overdue, now);

  return [
    ...dueToday.map((briefing): TodayPriority => ({ kind: "today", briefing })),
    ...sortDebriefReports(reports).map((report): TodayPriority => ({
      kind: report.promise && !report.due_on ? "promise" : "report", report,
    })),
    ...missing.map((event): TodayPriority => ({ kind: "followUp", event })),
    ...(oldDeadlines.length ? [{ kind: "deadlines" as const, items: oldDeadlines }] : []),
  ];
}
