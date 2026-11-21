import { describe, expect, it } from "vitest";
import { TASK_TEMPLATES, buildTemplateRows, nextRecurrenceDate, subtaskProgress, taskPackageStepsFromText, taskPackageStepsToText, taskTemplateFromAutomationRule, validateTaskPackageStepsText, validateTaskTemplate } from "./templates";

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
  it("maps a manual automation rule and enforces the 365-day limit", () => {
    const t = taskTemplateFromAutomationRule({ id: "db-1", name: "Haushalt", description: "", module: "tasks", trigger_type: "manual", enabled: true, actions: [{ type: "create_task_package", payload: { title: "Haushalt", description: "", first_step: "Entwurf", due_in_days: "365", subtasks: JSON.stringify([{ title: "Stellungnahme", offsetDays: 30 }]) } }] });
    expect(t?.id).toBe("db-1");
    expect(t?.subtasks[0]).toEqual({ title: "Stellungnahme", offsetDays: 30 });
    expect(t && validateTaskTemplate(t)).toBeNull();
    expect(t && validateTaskTemplate({ ...t, dueInDays: 366 })).toContain("365");
  });
  it("does not expose scheduled, paused or mixed-action rules as member templates", () => {
    const base = { id: "db-1", name: "Haushalt", description: "", module: "tasks", trigger_type: "manual", enabled: true, actions: [{ type: "create_task_package", payload: { first_step: "Entwurf", due_in_days: "7", subtasks: "[]" } }] };
    expect(taskTemplateFromAutomationRule({ ...base, trigger_type: "schedule" })).toBeNull();
    expect(taskTemplateFromAutomationRule({ ...base, enabled: false })).toBeNull();
    expect(taskTemplateFromAutomationRule({ ...base, actions: [...base.actions, { type: "send_email_template" }] })).toBeNull();
  });
  it("round-trips editable package steps and rejects malformed rows", () => {
    const text = taskPackageStepsToText([{ title: "Recherche", offsetDays: 2 }, { title: "Freigabe", offsetDays: 5 }]);
    expect(taskPackageStepsFromText(text)).toEqual([{ title: "Recherche", offsetDays: 2 }, { title: "Freigabe", offsetDays: 5 }]);
    expect(validateTaskPackageStepsText(text)).toBeNull();
    expect(validateTaskPackageStepsText("Recherche ohne Frist")).toContain("Tage | Unteraufgabe");
    expect(validateTaskPackageStepsText("366 | Zu spät")).toContain("365");
  });
  it("rejects empty subtask titles and more than 30 steps", () => {
    expect(validateTaskTemplate({ ...TASK_TEMPLATES[0], subtasks: [{ title: "", offsetDays: 1 }] })).toContain("Titel");
    expect(validateTaskTemplate({ ...TASK_TEMPLATES[0], subtasks: Array.from({ length: 31 }, () => ({ title: "Schritt", offsetDays: 1 })) })).toContain("30");
  });
});

describe("subtaskProgress", () => {
  it("counts completed", () => expect(subtaskProgress([{ status: "completed" }, { status: "todo" }])).toEqual({ done: 1, total: 2, percent: 50 }));
  it("empty is zero", () => expect(subtaskProgress([]).percent).toBe(0));
});
