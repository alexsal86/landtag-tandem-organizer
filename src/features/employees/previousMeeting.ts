import type { ActionItem, EmployeeMeeting } from "@/components/employees/types";

/** Only an earlier, finished conversation can supply the agreed baseline. */
export function getPreviousMeetingContext(employeeId: string, current: Pick<EmployeeMeeting, "id" | "meeting_date">, meetings: EmployeeMeeting[], actions: ActionItem[]) {
  const previous = meetings.filter(m => m.employee_id === employeeId && m.id !== current.id &&
    ["completed", "acknowledged"].includes(m.status) && Date.parse(m.meeting_date) < Date.parse(current.meeting_date))
    .sort((a, b) => Date.parse(b.meeting_date) - Date.parse(a.meeting_date) || b.id.localeCompare(a.id))[0];
  if (!previous) return null;
  return { meeting: previous, actions: actions.filter(a => a.meeting_id === previous.id) };
}
export type PreviousMeetingContext = ReturnType<typeof getPreviousMeetingContext>;
