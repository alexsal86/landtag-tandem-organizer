import { describe, expect, it } from "vitest";
import { groupByZone, isOnResubmission, stafetteEvents, stepState, taskZone } from "./stafette";

const now = new Date(2026, 10, 7, 12);

describe("stafette rules", () => {
  it("step without text is unset", () => {
    expect(stepState({ next_action: "  " })).toBe("unset");
    expect(stepState({ next_action: "Anrufen" })).toBe("set");
  });

  it("future step due goes to resubmission, today does not", () => {
    expect(isOnResubmission({ next_action: "x", next_action_due: "2026-11-08" }, now)).toBe(true);
    expect(isOnResubmission({ next_action: "x", next_action_due: "2026-11-07" }, now)).toBe(false);
    expect(isOnResubmission({ next_action_due: "2026-11-20" }, now)).toBe(false);
  });

  it("ball with deputy puts task into waiting", () => {
    expect(taskZone({ ball_owner: "deputy" }, "me", now)).toBe("waiting");
    expect(taskZone({ ball_owner: "office", ball_assignee_id: "other" }, "me", now)).toBe("waiting");
    expect(taskZone({ ball_owner: "office", ball_assignee_id: "me" }, "me", now)).toBe("mine");
    expect(taskZone({ next_action: "x", next_action_due: "2026-12-01" }, "me", now)).toBe("resubmission");
  });

  it("completed tasks are not grouped", () => {
    const g = groupByZone([{ status: "completed" }, { status: "todo" }], "me", now);
    expect(g.mine).toHaveLength(1);
  });

  it("handover and step completion are logged", () => {
    const ev = stafetteEvents({ ball_owner: "office", next_action: "Entwurf" }, { ball_owner: "deputy", next_action: null }, { now });
    expect(ev.map((e) => e.text)).toEqual(["Am Zug: Büro → Abgeordnete/r", "Schritt erledigt: „Entwurf“"]);
  });
});

import { isReminderDue as _due, reminderPreset as _preset } from "./stafette";
describe("Erinnerungen", () => {
  const now = new Date(2026, 10, 7, 10, 0);
  it("fällige Erinnerung holt wartende Aufgabe in Mein Zug", () => {
    expect(taskZone({ ball_owner: "deputy", reminder_at: new Date(2026, 10, 7, 9).toISOString() }, "me", now)).toBe("mine");
  });
  it("künftige Erinnerung lässt Aufgabe wartend", () => {
    expect(taskZone({ ball_owner: "deputy", reminder_at: new Date(2026, 10, 8, 9).toISOString() }, "me", now)).toBe("waiting");
    expect(_due({ reminder_at: null }, now)).toBe(false);
  });
  it("Nächste Woche = kommender Montag 9 Uhr", () => {
    const d = _preset("nextweek", now);
    expect([d.getDate(), d.getHours()]).toEqual([9, 9]);
  });
});
