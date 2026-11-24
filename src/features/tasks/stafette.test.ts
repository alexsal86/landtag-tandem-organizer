import { describe, expect, it } from "vitest";
import { groupByZone, isOnResubmission, stafetteEvents, stepState, taskZone } from "./stafette";

const now = new Date(2026, 10, 7, 12);

describe("stafette rules", () => {
  it("step without text is unset", () => {
    expect(stepState({ next_action: "  " })).toBe("unset");
    expect(stepState({ next_action: "Anrufen" })).toBe("set");
  });

  it("only an explicit future resubmission defers the task", () => {
    expect(isOnResubmission({ next_action: "x", next_action_due: "2026-11-08" }, now)).toBe(false);
    expect(isOnResubmission({ next_action: "x", next_action_due: "2026-11-07" }, now)).toBe(false);
    expect(isOnResubmission({ stafette_resume_on: "2026-11-20" }, now)).toBe(true);
  });

  it("ball with deputy puts task into waiting", () => {
    expect(taskZone({ ball_owner: "deputy" }, "me", now)).toBe("waiting");
    expect(taskZone({ ball_owner: "office", ball_assignee_id: "other" }, "me", now)).toBe("waiting");
    expect(taskZone({ ball_owner: "office", ball_assignee_id: "me" }, "me", now)).toBe("mine");
    expect(taskZone({ stafette_resume_on: "2026-12-01" }, "me", now)).toBe("resubmission")
    expect(taskZone({ ball_owner: "deputy", ball_assignee_id: "me" }, "me", now)).toBe("mine");
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
    expect(taskZone({ ball_owner: "deputy", user_id: "me", reminder_at: new Date(2026, 10, 7, 9).toISOString() }, "me", now)).toBe("mine");
  });
  it("künftige Erinnerung lässt Aufgabe wartend", () => {
    expect(taskZone({ ball_owner: "deputy", user_id: "me", reminder_at: new Date(2026, 10, 8, 9).toISOString() }, "me", now)).toBe("waiting");
    expect(_due({ reminder_at: null }, now)).toBe(false);
  });
  it("Nächste Woche = kommender Montag 9 Uhr", () => {
    const d = _preset("nextweek", now);
    expect([d.getDate(), d.getHours()]).toEqual([9, 9]);
  });
});

import { canNudge, checklistEvents, isNudgeActive, shiftDay, batchPreviewSummary, describeBatchItem, groupBatchSkips, parseTaskBatchPreview, taskBatchPreview, ballAssigneeLabel, daysWaiting, describeTaskCommand, escalationFor, isStalledTask, parseTaskCommand, slaLevel, weekReview } from "./stafette";
describe("Anstupsen, Checkliste, Stapel", () => {
  const now = new Date(2026, 10, 7, 10, 0);
  it("Angestupste Aufgabe steht beim Empfänger ganz oben, beim Absender nicht", () => {
    const t = { ball_owner: "office", ball_assignee_id: "me", nudged_by: "kollegin", nudged_at: now.toISOString() };
    expect(taskZone(t, "me", now)).toBe("nudged");
    expect(taskZone({ ...t, ball_assignee_id: "kollegin", nudged_by: "me" }, "me", now)).toBe("waiting");
  });
  it("Gesehen beendet das Anstupsen", () => {
    expect(isNudgeActive({ nudged_at: "2026-11-07T09:00:00Z", nudge_seen_at: "2026-11-07T09:30:00Z" })).toBe(false);
  });
  it("Höchstens einmal pro 24 Stunden, nie bei Extern", () => {
    const t = { ball_owner: "deputy", nudged_by: "me", nudged_at: new Date(2026, 10, 6, 12).toISOString() };
    expect(canNudge(t, "me", now)).toBe(false);
    expect(canNudge(t, "me", new Date(2026, 10, 7, 12, 1))).toBe(true);
    expect(canNudge({ ball_owner: "external" }, "me", now)).toBe(false);
  });
  it("Abgehakter Checkpunkt landet im Verlauf", () => {
    expect(checklistEvents([{ id: "1", text: "Anrufen", done: false }], [{ id: "1", text: "Anrufen", done: true }])).toEqual(["Checkpunkt erledigt: „Anrufen“"]);
  });
  it("Frist +1 Woche", () => {
    expect(shiftDay("2026-11-28", 7)).toBe("2026-12-05");
  });
});

describe("Sammelaktionen", () => {
  const items = [
    { task_id: "a", title: "Entwurf", eligible: true, reason: null, before: "28.11.2026", after: "05.12.2026" },
    { task_id: "b", title: "Ohne Frist", eligible: false, reason: "keine Frist gesetzt", before: null, after: null },
    { task_id: "c", title: "Auch ohne Frist", eligible: false, reason: "keine Frist gesetzt", before: null, after: null },
  ];

  it("Vorschau zählt, was passiert und was übersprungen wird", () => {
    const preview = taskBatchPreview("week", items);
    expect([preview.total, preview.affected, preview.skipped]).toEqual([3, 1, 2]);
    expect(batchPreviewSummary(preview)).toBe("3 Aufgaben, 2 werden übersprungen");
  });

  it("Einzahl bleibt lesbar", () => {
    expect(batchPreviewSummary(taskBatchPreview("week", [items[0]]))).toBe("1 Aufgabe wird bearbeitet");
    expect(batchPreviewSummary(taskBatchPreview("week", [items[1]]))).toBe("1 Aufgabe, 1 wird übersprungen");
  });

  it("Übersprungene Aufgaben werden nach Grund gruppiert", () => {
    expect(groupBatchSkips(items)).toEqual([{ reason: "keine Frist gesetzt", count: 2 }]);
  });

  it("Freigabe-Vorschau zeigt erhaltene Schritte statt Überschreiben", () => {
    const kept = describeBatchItem({ ...items[0], before: "Entwurf schreiben", after: "Entwurf schreiben" }, "deputy");
    const fresh = describeBatchItem({ ...items[0], before: null, after: "Freigabe prüfen" }, "deputy");
    expect(kept).toBe("Schritt bleibt: „Entwurf schreiben“");
    expect(fresh).toBe("Nächster Schritt: „Freigabe prüfen“");
    expect(describeBatchItem(items[0], "week")).toBe("Frist 28.11.2026 → 05.12.2026");
  });

  it("Fremde Vorschau-Antworten werden verworfen", () => {
    expect(parseTaskBatchPreview(null)).toBeNull();
    expect(parseTaskBatchPreview({ action: "delete", items: [] })).toBeNull();
    const parsed = parseTaskBatchPreview({ action: "week", items });
    expect(parsed?.items).toHaveLength(3);
    expect(parsed?.skipped).toBe(2);
  });
});

describe("Wochenreview, Eskalation und Befehle", () => {
  const now = new Date(2026, 10, 7, 12);
  const old = new Date(2026, 9, 1, 9).toISOString();
  const fresh = new Date(2026, 10, 5, 9).toISOString();

  it("Büro ohne Person wird benannt statt persönlich zugerechnet", () => {
    expect(ballAssigneeLabel({ ball_owner: "office" })).toEqual({ owner: "office", label: "Büro (keine Person)", needsPerson: true });
    expect(ballAssigneeLabel({ ball_owner: "office", ball_assignee_id: "a" }, () => "Anna").label).toBe("Anna");
    expect(ballAssigneeLabel({ ball_owner: "external", ball_external_label: "Ministerium" }).label).toBe("Ministerium");
    expect(ballAssigneeLabel({ ball_owner: "deputy" }, () => undefined).needsPerson).toBe(false);
  });

  it("Stille Aufgaben und Eskalationsgrund", () => {
    expect(daysWaiting({ created_at: old }, now)).toBe(37);
    expect(isStalledTask({ created_at: old }, now)).toBe(true);
    expect(isStalledTask({ created_at: fresh }, now)).toBe(false);
    expect(escalationFor({ nudge_count: 2, nudged_at: now.toISOString() }, now)).toBe("2× angestupst, keine Reaktion");
    expect(escalationFor({ status: "completed", created_at: old }, now)).toBeNull();
    expect(escalationFor({ created_at: fresh }, now)).toBeNull();
  });

  it("Wochenreview sammelt fehlende Schritte, namenlose Bälle, Duplikate, Stille", () => {
    const tasks = [
      { id: "1", title: "Antrag zur Schulpolitik prüfen", next_action: null, created_at: old },
      { id: "2", title: "Antrag zur Schulpolitik prüfen", next_action: "Entwurf schreiben", created_at: old },
      { id: "3", title: "Kurz", next_action: "Anrufen", created_at: fresh, ball_owner: "office", ball_assignee_id: "a" },
      { id: "4", title: "Erledigte Sache", status: "completed", created_at: old },
    ];
    const review = weekReview(tasks, now);
    expect(review.noNextStep.map((task) => task.id)).toEqual(["1"]);
    expect(review.noBallPerson.map((task) => task.id)).toEqual(["1", "2"]);
    expect(review.stalled.map((task) => task.id)).toEqual(["1", "2"]);
    expect(review.duplicates).toHaveLength(1);
    expect(review.duplicates[0].tasks.map((task) => task.id)).toEqual(["1", "2"]);
    expect(review.escalate.map((entry) => entry.task.id)).toEqual(["1", "2"]);
  });

  it("SLA-Stufen: drei Tage fallen auf, sieben sind der Engpass", () => {
    expect([slaLevel(0), slaLevel(2), slaLevel(3), slaLevel(6), slaLevel(7)]).toEqual(["ok", "ok", "warn", "warn", "critical"]);
  });

  it("Einzeiler-Befehle werden erkannt", () => {
    expect(parseTaskCommand("frist +1w")).toEqual({ kind: "due", days: 7 });
    expect(parseTaskCommand("frist 3 Tage")).toEqual({ kind: "due", days: 3 });
    expect(parseTaskCommand("frist morgen")).toEqual({ kind: "due", days: 1 });
    expect(parseTaskCommand("an Max Mustermann")).toEqual({ kind: "assign", query: "Max Mustermann" });
    expect(parseTaskCommand("wartet auf Ministerium")).toEqual({ kind: "wait", text: "Ministerium" });
    expect(parseTaskCommand("prio hoch")).toEqual({ kind: "priority", priority: "high" });
    expect(parseTaskCommand("erledigt")).toEqual({ kind: "complete" });
    expect(parseTaskCommand("bitte irgendwas")).toBeNull();
    expect(parseTaskCommand("frist +500w")).toBeNull();
    expect(describeTaskCommand({ kind: "due", days: 7 })).toBe("Frist in 7 Tagen setzen");
    expect(describeTaskCommand({ kind: "assign", query: "Max" })).toBe("Ball an Max übergeben");
  });
});
