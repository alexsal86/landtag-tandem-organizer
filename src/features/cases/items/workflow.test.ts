import { describe, expect, it } from "vitest";
import { decisionOutcome, meetingOutcome, newlyCompletedMeetingCases, workflowEvents, type WorkflowDecision } from "./workflow";

const itemId = "case-1";
const decision: WorkflowDecision = {
  id: "d1", title: "Freigabe", status: "active", created_at: "2026-11-06T10:00:00Z", updated_at: "2026-11-06T12:00:00Z",
  task_decision_participants: [{ id: "p1", task_decision_responses: [] }, { id: "p2", task_decision_responses: [] }],
};
const response = (id: string, response_type: string, created_at = "2026-11-06T11:00:00Z") => ({ id, response_type, comment: "Rückmeldung", created_at });

describe("Rückkopplung der Quick Actions", () => {
  it("behält Entscheidungen bei Teilantworten und Rückfragen offen", () => {
    const partial = { ...decision, task_decision_participants: [{ id: "p1", task_decision_responses: [response("r1", "yes")] }, decision.task_decision_participants[1]] };
    expect(decisionOutcome(partial)).toEqual({ completed: false, answered: 1, total: 2 });
    expect(decisionOutcome({ ...partial, task_decision_participants: [...partial.task_decision_participants.slice(0, 1), { id: "p2", task_decision_responses: [response("r2", "question")] }] }).completed).toBe(false);
    expect(decisionOutcome({ ...decision, task_decision_participants: [] }).completed).toBe(false);
  });

  it("setzt die Aktion erst nach allen Rückmeldungen oder Archivierung zurück", () => {
    expect(decisionOutcome({ ...decision, task_decision_participants: [{ id: "p1", task_decision_responses: [response("r1", "yes")] }, { id: "p2", task_decision_responses: [response("r2", "no")] }] }).completed).toBe(true);
    expect(decisionOutcome({ ...decision, status: "archived" }).completed).toBe(true);
  });

  it("wertet die neueste Rückmeldung aus", () => {
    expect(decisionOutcome({ ...decision, task_decision_participants: [{ id: "p1", task_decision_responses: [response("r1", "yes"), response("r2", "question", "2026-11-06T12:00:00Z")] }] }).completed).toBe(false);
  });

  it("berücksichtigt bearbeitete Antworten und datiert den Abschluss auf die Rückmeldung", () => {
    const current = { ...decision, task_decision_participants: [{ id: "p1", task_decision_responses: [{ ...response("r1", "yes"), updated_at: "2026-11-07T10:00:00Z" }, response("r2", "question", "2026-11-06T13:00:00Z")] }] };
    expect(decisionOutcome(current).completed).toBe(true);
    const completion = workflowEvents(itemId, [], [current], [], []).find((event) => event.title === "Entscheidungsanfrage abgeschlossen");
    expect(completion?.timestamp).toBe("2026-11-07T10:00:00Z");
  });

  it("erkennt nur ausdrücklich besprochene Jour-fixe-Punkte", () => {
    expect(meetingOutcome(JSON.stringify({ [itemId]: { completed: true, result: "Erledigt" } }), itemId)).toEqual({ completed: true, result: "Erledigt" });
    expect(meetingOutcome(JSON.stringify({ [itemId]: { completed: false, result: "Noch offen" } }), itemId).completed).toBe(false);
    expect(meetingOutcome(JSON.stringify({ [itemId]: "Protokollergebnis" }), itemId).completed).toBe(true);
    expect(meetingOutcome("ungültiges JSON", itemId).completed).toBe(false);
    expect(meetingOutcome(JSON.stringify({ other: { completed: true } }), itemId).completed).toBe(false);
  });

  it("verbraucht Jour-fixe-Vormerkungen nur beim erstmaligen Besprechen", () => {
    const id = "12345678-1234-1234-1234-123456789abc";
    const complete = JSON.stringify({ [id]: { completed: true, result: "Besprochen" } });
    const incomplete = JSON.stringify({ [id]: { completed: false, result: "Offen" } });
    expect(newlyCompletedMeetingCases(incomplete, complete)).toEqual([id]);
    expect(newlyCompletedMeetingCases(complete, complete)).toEqual([]);
    expect(newlyCompletedMeetingCases(complete, incomplete)).toEqual([]);
    expect(newlyCompletedMeetingCases(null, "Ungültig")).toEqual([]);
    expect(newlyCompletedMeetingCases(null, JSON.stringify({ invalid: { completed: true } }))).toEqual([]);
  });

  it("führt Anfrage und Bestätigung mit stabilen IDs im Verlauf", () => {
    const requests = [{ id: "r1", status: "accepted", requested_date: "2026-11-10", created_at: "2026-11-06T10:00:00Z", decided_at: "2026-11-06T11:00:00Z", appointment_id: "a1" }];
    const events = workflowEvents(itemId, requests, [], [], []);
    expect(events.map((event) => event.title)).toEqual(["Ortstermin angefragt", "Ortstermin bestätigt"]);
    expect(workflowEvents(itemId, requests, [], [], [])).toEqual(events);
    expect(workflowEvents(itemId, [{ ...requests[0], status: "open", decided_at: null }], [], [], []).map((event) => event.title)).toEqual(["Ortstermin angefragt"]);
  });

  it("dokumentiert Absagen, Rückfragen und konkrete Besprechungsergebnisse", () => {
    const events = workflowEvents(itemId, [{ id: "r1", status: "declined", requested_date: "2026-11-10", created_at: "2026-11-06T10:00:00Z", decided_at: "2026-11-06T11:00:00Z", appointment_id: null }],
      [{ ...decision, task_decision_participants: [{ id: "p1", task_decision_responses: [response("r2", "question")] }] }],
      [{ id: "m1", title: "Jour fixe", meeting_date: "2026-11-06", status: "planned", updated_at: "2026-11-06T12:00:00Z" }],
      [{ id: "ag1", meeting_id: "m1", result_text: JSON.stringify({ [itemId]: { completed: true, result: "Ortstermin zusagen" } }), updated_at: "2026-11-06T12:00:00Z" }]);
    expect(events.some((event) => event.title === "Ortstermin abgelehnt")).toBe(true);
    expect(events.some((event) => event.title === "Rückfrage zur Entscheidung")).toBe(true);
    expect(events.find((event) => event.title === "Im Jour fixe besprochen")?.note).toContain("Ortstermin zusagen");
  });
});
