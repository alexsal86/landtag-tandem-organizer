import { describe, expect, it } from "vitest";
import { canDecide, isUrgent, requestEnd, requestStart } from "../logic";

const today = new Date(2026, 10, 5); // 5 Nov 2026

describe("Terminanfragen – Eilbedürftigkeit", () => {
  it("ist eilig, wenn der Termin vor dem nächsten Jour fixe liegt", () => {
    expect(isUrgent({ requested_date: "2026-11-07", response_deadline: null, status: "open" }, "2026-11-09", today)).toBe(true);
  });
  it("ist eilig, wenn nur die Rückmeldefrist vor dem Jour fixe liegt", () => {
    expect(isUrgent({ requested_date: "2026-12-01", response_deadline: "2026-11-08", status: "open" }, "2026-11-09", today)).toBe(true);
  });
  it("wartet auf den Jour fixe, wenn Termin und Frist danach liegen", () => {
    expect(isUrgent({ requested_date: "2026-12-01", response_deadline: "2026-11-20", status: "open" }, "2026-11-09", today)).toBe(false);
  });
  it("nutzt 7 Tage, wenn kein Jour fixe geplant ist", () => {
    expect(isUrgent({ requested_date: "2026-11-12", response_deadline: null, status: "open" }, null, today)).toBe(true);
    expect(isUrgent({ requested_date: "2026-11-13", response_deadline: null, status: "open" }, null, today)).toBe(false);
  });
  it("entschiedene Anfragen sind nie eilig", () => {
    expect(isUrgent({ requested_date: "2026-11-06", response_deadline: null, status: "accepted" }, "2026-11-09", today)).toBe(false);
  });
});

describe("Terminanfragen – Entscheidungsrecht", () => {
  it("Abgeordnete und Büroleitung dürfen entscheiden, andere nicht", () => {
    expect(canDecide("abgeordneter")).toBe(true);
    expect(canDecide("bueroleitung")).toBe(true);
    expect(canDecide("mitarbeiter")).toBe(false);
    expect(canDecide("praktikant")).toBe(false);
  });
});

describe("Terminanfragen – Zeitraum", () => {
  it("ohne Uhrzeit beginnt der Platzhalter um 9 Uhr und dauert die angegebene Zeit", () => {
    const r = { requested_date: "2026-11-10", requested_time: null, duration_minutes: 90 };
    expect(requestStart(r).getHours()).toBe(9);
    expect(requestEnd(r).getHours()).toBe(10);
    expect(requestEnd(r).getMinutes()).toBe(30);
  });
});
