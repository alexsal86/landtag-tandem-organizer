import { describe, expect, it } from "vitest";
import {
  POLL_FOLLOWUP_MAX_SEND_ATTEMPTS,
  decidePollFollowup,
  isPollFollowupSendExhausted,
  nextPollFollowupSendAttemptAt,
  pollFollowupSendKey,
  selectFollowupRecipients,
} from "./pollFollowup";

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

  it("vergibt eindeutige Versandschlüssel je Abstimmung, Teilnehmer und Versuch", () => {
    const key = pollFollowupSendKey("poll-1", "participant-1", 2);
    expect(key).toBe("poll-1:participant-1:answer_followup:2");
    expect(pollFollowupSendKey("poll-1", "participant-1", 2)).toBe(key);
    expect(pollFollowupSendKey("poll-1", "participant-2", 2)).not.toBe(key);
    expect(pollFollowupSendKey("poll-1", "participant-1", 1)).not.toBe(key);
    expect(pollFollowupSendKey("poll-2", "participant-1", 2)).not.toBe(key);
  });

  it("wiederholt fehlgeschlagene Zustellungen mit wachsendem Abstand", () => {
    const base = new Date("2026-11-24T09:00:00.000Z");
    const minutes = (failed: number) =>
      (nextPollFollowupSendAttemptAt(failed, base).getTime() - base.getTime()) / 60_000;

    expect([minutes(1), minutes(2), minutes(3)]).toEqual([15, 30, 60]);
    expect(minutes(9)).toBe(120);
  });

  it("erklärt einen Auftrag erst nach allen Versuchen als gescheitert", () => {
    expect(POLL_FOLLOWUP_MAX_SEND_ATTEMPTS).toBeGreaterThan(1);
    expect(isPollFollowupSendExhausted(POLL_FOLLOWUP_MAX_SEND_ATTEMPTS - 1)).toBe(false);
    expect(isPollFollowupSendExhausted(POLL_FOLLOWUP_MAX_SEND_ATTEMPTS)).toBe(true);
    expect(isPollFollowupSendExhausted(0)).toBe(false);
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
