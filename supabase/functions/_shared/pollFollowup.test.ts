import { describe, expect, it } from "vitest";
import { decidePollFollowup, selectFollowupRecipients } from "./pollFollowup";

const poll = {
  status: "active",
  createdAt: "2026-11-20T09:00:00.000Z",
  deadline: "2026-11-30T23:59:00.000Z",
  followupCount: 0,
  lastFollowupAt: null,
  participantCount: 4,
  respondingCount: 1,
} as const;

describe("Nachfassen bei Teilnehmenden ohne Antwort", () => {
  it("erinnert erst nach 24 Stunden", () => {
    expect(decidePollFollowup(poll, new Date("2026-11-21T08:59:00.000Z")).due).toBe(false);
    const due = decidePollFollowup(poll, new Date("2026-11-21T09:00:00.000Z"));
    expect(due.due).toBe(true);
    expect(due.attempt).toBe(1);
  });

  it("erinnert danach frühestens nach 48 Stunden und höchstens zweimal", () => {
    const afterFirst = { ...poll, followupCount: 1, lastFollowupAt: "2026-11-21T09:00:00.000Z" };
    expect(decidePollFollowup(afterFirst, new Date("2026-11-23T08:59:00.000Z")).due).toBe(false);
    expect(decidePollFollowup(afterFirst, new Date("2026-11-23T09:00:00.000Z"))).toMatchObject({
      due: true,
      attempt: 2,
    });

    const exhausted = { ...poll, followupCount: 2, lastFollowupAt: "2026-11-23T09:00:00.000Z" };
    const decision = decidePollFollowup(exhausted, new Date("2026-12-01T09:00:00.000Z"));
    expect(decision.due).toBe(false);
    expect(decision.reason).toContain("Limit");
  });

  it("fasst nicht nach, wenn alle geantwortet haben, die Frist vorbei oder die Abstimmung beendet ist", () => {
    expect(decidePollFollowup({ ...poll, respondingCount: 4 }, new Date("2026-11-25T09:00:00.000Z")).due).toBe(false);
    expect(decidePollFollowup({ ...poll, deadline: "2026-11-21T08:00:00.000Z" }, new Date("2026-11-25T09:00:00.000Z")).due).toBe(false);
    expect(decidePollFollowup({ ...poll, status: "completed" }, new Date("2026-11-25T09:00:00.000Z")).due).toBe(false);
    expect(decidePollFollowup({ ...poll, participantCount: 0, respondingCount: 0 }, new Date("2026-11-25T09:00:00.000Z")).due).toBe(false);
  });

  it("wählt nur offene Teilnehmende mit gültiger Adresse", () => {
    const recipients = selectFollowupRecipients([
      { id: "1", email: "offen@example.com", hasResponded: false },
      { id: "2", email: "antwort@example.com", hasResponded: true },
      { id: "3", email: "  ", hasResponded: false },
    ]);
    expect(recipients.map((participant) => participant.id)).toEqual(["1"]);
  });
});
