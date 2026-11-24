import { describe, expect, it } from "vitest";
import { buildBlockedRanges, mergeTimeRanges, suggestPollSlots } from "./pollSlotSuggestion";

const BERLIN = "Europe/Berlin";

const base = {
  participants: ["a@example.com", "b@example.com"],
  busy: [],
  windowStart: "2026-11-25T00:00:00.000Z",
  windowEnd: "2026-11-27T00:00:00.000Z",
  durationMinutes: 60,
  bufferMinutes: 15,
  timeZone: BERLIN,
  limit: 1,
} as const;

describe("Slot-Vorschläge aus Frei/Gebucht", () => {
  it("normalisiert Adressen, fasst belegte Zeiten zusammen und respektiert den Puffer", () => {
    const merged = mergeTimeRanges([
      { start: 0, end: 10 },
      { start: 10, end: 20 },
      { start: 30, end: 40 },
    ]);
    expect(merged).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);

    const blocked = buildBlockedRanges(
      [{ email: " A@Example.com ", start: "2026-11-25T09:00:00.000Z", end: "2026-11-25T10:00:00.000Z" }],
      15,
    );
    expect(blocked.get("a@example.com")).toEqual([
      { start: Date.parse("2026-11-25T08:45:00.000Z"), end: Date.parse("2026-11-25T10:15:00.000Z") },
    ]);
  });

  it("schlägt den frühesten freien Slot in der Berliner Arbeitszeit vor", () => {
    const [suggestion] = suggestPollSlots({ ...base });
    expect(suggestion.start).toBe("2026-11-25T08:00:00.000Z");
    expect(suggestion.end).toBe("2026-11-25T09:00:00.000Z");
    expect(suggestion.fullyFree).toBe(true);
    expect(suggestion.freeEmails).toEqual(["a@example.com", "b@example.com"]);
  });

  it("sperrt mit Puffer auch angrenzende Slots und weicht nach hinten aus", () => {
    const suggestions = suggestPollSlots({
      ...base,
      limit: 40,
      maxPerDay: 40,
      busy: [{ email: "a@example.com", start: "2026-11-25T09:00:00.000Z", end: "2026-11-25T10:00:00.000Z" }],
    });

    const blockedNineOClock = suggestions.find((s) => s.start === "2026-11-25T08:00:00.000Z");
    expect(blockedNineOClock?.busyEmails).toEqual(["a@example.com"]);

    const afterBuffer = suggestions.find((s) => s.start === "2026-11-25T10:30:00.000Z");
    expect(afterBuffer?.fullyFree).toBe(true);
  });

  it("bevorzugt vollständig freie Slots und überspringt Wochenenden", () => {
    const weekendOnly = suggestPollSlots({
      ...base,
      windowStart: "2026-11-28T00:00:00.000Z",
      windowEnd: "2026-11-30T00:00:00.000Z",
    });
    expect(weekendOnly).toEqual([]);

    const [best] = suggestPollSlots({
      ...base,
      limit: 1,
      busy: [{ email: "b@example.com", start: "2026-11-25T08:00:00.000Z", end: "2026-11-25T09:00:00.000Z" }],
    });
    expect(best.start).not.toBe("2026-11-25T08:00:00.000Z");
    expect(best.fullyFree).toBe(true);
  });

  it("schlägt bereits vorhandene Slots nicht erneut vor", () => {
    const suggestions = suggestPollSlots({
      ...base,
      limit: 1,
      existingSlots: [{ start: "2026-11-25T08:00:00.000Z", end: "2026-11-25T09:00:00.000Z" }],
    });
    expect(suggestions[0]?.start).toBe("2026-11-25T09:00:00.000Z");
  });

  it("rechnet die Arbeitszeit auch über Zeitumstellungen korrekt um", () => {
    const spring = suggestPollSlots({
      ...base,
      windowStart: "2026-03-30T00:00:00.000Z",
      windowEnd: "2026-03-31T00:00:00.000Z",
    });
    expect(spring[0]?.start).toBe("2026-03-30T07:00:00.000Z");

    const autumn = suggestPollSlots({
      ...base,
      windowStart: "2026-10-26T00:00:00.000Z",
      windowEnd: "2026-10-27T00:00:00.000Z",
    });
    expect(autumn[0]?.start).toBe("2026-10-26T08:00:00.000Z");
  });

  it("kennzeichnet Teilnehmer ohne Frei/Gebucht-Daten, statt sie als frei zu zählen", () => {
    const [partial] = suggestPollSlots({
      ...base,
      participants: ["a@example.com", "b@example.com", "extern@example.com"],
      knownParticipants: ["a@example.com", "b@example.com"],
      limit: 1,
    });
    expect(partial.unknownEmails).toEqual(["extern@example.com"]);
    expect(partial.freeEmails).toEqual(["a@example.com", "b@example.com"]);
    expect(partial.fullyFree).toBe(false);

    const [complete] = suggestPollSlots({
      ...base,
      knownParticipants: ["b@example.com", "A@example.com"],
      limit: 1,
    });
    expect(complete.unknownEmails).toEqual([]);
    expect(complete.fullyFree).toBe(true);
  });

  it("liefert ohne Teilnehmer oder mit unmöglicher Dauer nichts", () => {
    expect(suggestPollSlots({ ...base, participants: [] })).toEqual([]);
    expect(suggestPollSlots({ ...base, durationMinutes: 600 })).toEqual([]);
    expect(suggestPollSlots({ ...base, windowEnd: base.windowStart })).toEqual([]);
  });
});
