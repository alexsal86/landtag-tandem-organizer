import { describe, expect, it } from "vitest";
import { countFocusActions, type FocusTask } from "./useFocusSummary";
import { appointmentHref, appointmentLabel } from "./sidebarAppointments";

describe("Personal focus data", () => {
  it("counts actionable assignments and ball ownership once, independently of navigation visits", () => {
    const task: FocusTask = { id: "assigned", assigned_to: "{me,friend}", category: null, status: "todo" };
    const tasks: FocusTask[] = [
      task, { ...task, task_assignees: [{ user_id: "me" }] },
      { ...task, id: "ball", assigned_to: null, ball_owner: "deputy", ball_assignee_id: "me" },
      { ...task, id: "passed", ball_assignee_id: "friend" },
      { ...task, id: "external", ball_owner: "external" },
      { ...task, id: "complete", status: "completed" },
      { ...task, id: "snoozed", stafette_resume_on: "2026-12-15" },
      { ...task, id: "created", assigned_to: null, user_id: "me" },
    ];
    expect(countFocusActions(tasks, [], "me", new Date("2026-11-28T09:00:00Z"))).toEqual({ taskCount: 2, caseCount: 0 });
  });

  it("counts a personal case step once when the same step is also tracked as a task", () => {
    const task: FocusTask = { id: "task", assigned_to: "me", category: null, source_type: "case_step", source_id: "linked" };
    const item = { id: "linked", status: "in_klaerung", ball_owner: "office", next_action_assignee_id: "me" };
    const cases = [
      item,
      { ...item, id: "direct" },
      { ...item, id: "waiting", ball_owner: "citizen" },
      { ...item, id: "transferred", owner_user_id: "me", next_action_assignee_id: "colleague" },
      { ...item, id: "done", status: "erledigt" },
    ];
    expect(countFocusActions([task], cases, "me")).toEqual({ taskCount: 1, caseCount: 1 });
  });

  it("uses Berlin time and links an external appointment with the calendar's existing highlight format", () => {
    const appointment = { id: "42", title: "Ausschuss", start_time: "2026-11-28T13:00:00Z", is_all_day: false, isExternal: true };
    expect(appointmentLabel(appointment, new Date("2026-11-28T09:00:00Z"))).toBe("14:00");
    expect(appointmentHref(appointment)).toBe("/calendar?highlight=external-42");
  });
});
