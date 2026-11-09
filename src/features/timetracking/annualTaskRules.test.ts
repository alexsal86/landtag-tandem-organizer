import { describe, expect, it } from "vitest";
import { annualDueDay, annualTaskStatus, canDelegateAnnualTask } from "./annualTaskRules";

describe("Jahresaufgaben-Stafette", () => {
  it("behält einen konkreten jährlichen Stichtag", () => {
    expect(annualDueDay({ due_month: 4, due_day: 1 }, 2027)).toBe("2027-04-01");
  });
  it("setzt Monatsfristen auf Monatsende", () => {
    expect(annualDueDay({ due_month: 2, due_day: null }, 2027)).toBe("2027-02-28");
  });
  it("behandelt Schaltjahre ohne Überlauf in den März", () => {
    expect(annualDueDay({ due_month: 2, due_day: 29 }, 2028)).toBe("2028-02-29");
    expect(annualDueDay({ due_month: 2, due_day: 29 }, 2027)).toBe("2027-02-28");
  });
  it("lehnt ungültige Stichtage ab", () => {
    expect(() => annualDueDay({ due_month: 13, due_day: 1 }, 2027)).toThrow();
    expect(() => annualDueDay({ due_month: 1, due_day: 0 }, 2027)).toThrow();
  });
  it("wird am exakten Stichtag fällig und erst danach überfällig", () => {
    const task = { due_month: 4, due_day: 1 };
    expect(annualTaskStatus(task, 2027, null, new Date(2027, 2, 31))).toBe("upcoming");
    expect(annualTaskStatus(task, 2027, null, new Date(2027, 3, 1))).toBe("due");
    expect(annualTaskStatus(task, 2027, null, new Date(2027, 3, 2))).toBe("overdue");
    expect(annualTaskStatus(task, 2027, "2027-04-01", new Date(2027, 3, 2))).toBe("completed");
  });
  it("übergibt nur offene organisatorische Aufgaben, nie System-Routinen oder Duplikate", () => {
    const task = { is_system_task: false, execute_function: null };
    expect(canDelegateAnnualTask(task)).toBe(true);
    expect(canDelegateAnnualTask({ ...task, is_system_task: true })).toBe(false);
    expect(canDelegateAnnualTask({ ...task, execute_function: "execute_reset_vacation_days" })).toBe(false);
    expect(canDelegateAnnualTask(task, { completed_at: null, linked_task_id: "existing" })).toBe(false);
    expect(canDelegateAnnualTask(task, { completed_at: "2027-01-01", linked_task_id: null })).toBe(false);
  });
});