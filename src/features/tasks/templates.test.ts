import { describe, expect, it } from "vitest";
import { TASK_TEMPLATES, buildTemplateRows, nextRecurrenceDate, subtaskProgress } from "./templates";

describe("recurrence", () => {
  it("weekly adds 7 days", () => expect(nextRecurrenceDate("2026-11-07", "weekly")).toBe("2026-11-14"));
  it("biweekly adds 14 days", () => expect(nextRecurrenceDate("2026-11-07", "biweekly")).toBe("2026-11-21"));
  it("monthly adds a month", () => expect(nextRecurrenceDate("2026-11-07", "monthly")).toBe("2026-12-07"));
  it("quarterly adds 3 months across year", () => expect(nextRecurrenceDate("2026-11-07", "quarterly")).toBe("2027-02-07"));
  it("yearly adds a year", () => expect(nextRecurrenceDate("2026-11-07", "yearly")).toBe("2027-11-07"));
});

describe("templates", () => {
  it("plenarwoche creates parent with 5 linked subtasks", () => {
    let n = 0;
    const t = TASK_TEMPLATES.find((x) => x.key === "plenarwoche")!;
    const { parent, children } = buildTemplateRows(t, { userId: "u", tenantId: "t", start: new Date("2026-11-09T12:00:00"), makeId: () => `id${n++}` });
    expect(children).toHaveLength(5);
    expect(children.every((c) => c.parent_task_id === parent.id)).toBe(true);
    expect(parent.due_date).toBe("2026-11-16");
    expect(parent.next_action).toBe("Tagesordnung sichten");
  });
  it("kleine Anfrage includes the 21-day answer check", () => {
    const t = TASK_TEMPLATES.find((x) => x.key === "kleine-anfrage")!;
    expect(t.subtasks.some((s) => s.title.includes("21 Tage"))).toBe(true);
  });
});

describe("subtaskProgress", () => {
  it("counts completed", () => expect(subtaskProgress([{ status: "completed" }, { status: "todo" }])).toEqual({ done: 1, total: 2, percent: 50 }));
  it("empty is zero", () => expect(subtaskProgress([]).percent).toBe(0));
});
