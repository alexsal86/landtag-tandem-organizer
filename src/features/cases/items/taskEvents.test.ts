import { describe, expect, it } from "vitest";
import { caseTaskEvents, type CaseTaskJournalRow } from "./taskEvents";

const row: CaseTaskJournalRow = {
  id: "event-1", subject: "Aufgabe erstellt", details: "Antwort senden · Frist: 20.11.2026",
  interaction_at: "2026-11-06T14:15:00Z", source_id: "task-1",
  payload: { origin: "case_step_task", responsible_name: "Rudolf", actor_name: "Alexander" },
};

describe("Aufgaben in der Vorgangschronik", () => {
  it("übernimmt Inhalt, zuständige Person, Zeitpunkt und Aufgabenlink", () => {
    expect(caseTaskEvents([row], ["task-1"])).toEqual([{
      id: "case-task-event-1", title: "Aufgabe erstellt", note: "Antwort senden · Frist: 20.11.2026",
      timestamp: "2026-11-06T14:15:00Z", actorName: "Rudolf", href: "/tasks?highlight=task-1",
    }]);
  });
  it("behält Lösch- und Erledigungsnachweise ohne einen kaputten Aufgabenlink", () => {
    const events = caseTaskEvents([row, { ...row, id: "event-2", subject: "Aufgabe erledigt" }, { ...row, id: "event-3", subject: "Aufgabe gelöscht" }], []);
    expect(events.map((event) => event.title)).toEqual(["Aufgabe erstellt", "Aufgabe erledigt", "Aufgabe gelöscht"]);
    expect(events.every((event) => event.href === undefined)).toBe(true);
    expect(events[2].note).toBe(row.details);
  });
  it("blendet fremde und ungültige Journaldaten aus", () => {
    expect(caseTaskEvents([{ ...row, payload: null }, { ...row, payload: [] }, { ...row, payload: { origin: "other" } }], [])).toEqual([]);
    expect(caseTaskEvents([{ ...row, payload: { origin: "case_step_task", actor_name: "Alexander" } }], ["task-1"])[0].actorName).toBe("Alexander");
  });
});
