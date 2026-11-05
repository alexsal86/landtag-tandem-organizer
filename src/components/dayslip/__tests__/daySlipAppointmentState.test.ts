import { describe, expect, it } from "vitest";
import { splitDayEvents } from "../daySlipAppointmentState";

const at = (h: number, m = 0) => new Date(2026, 10, 5, h, m);
const now = at(12, 0);

const events = [
  { id: "a", date: at(8), endTime: at(9) },              // vorbei
  { id: "b", date: at(11, 30), endTime: at(12, 30) },    // läuft
  { id: "c", date: at(14), endTime: at(15) },            // als Nächstes
  { id: "d", date: at(0), endTime: at(0), is_all_day: true }, // ganztägig
  { id: "e", date: at(11), endTime: at(12) },            // endet genau jetzt -> vorbei
];

describe("Tageszettel – heutige Termine", () => {
  const r = splitDayEvents(events, now);
  it("blendet beendete Termine aus", () => {
    expect(r.past.map((e) => e.id).sort()).toEqual(["a", "e"]);
    expect(r.remaining.map((e) => e.id)).not.toContain("a");
  });
  it("behält ganztägige Termine den ganzen Tag", () => {
    expect(r.remaining.map((e) => e.id)).toContain("d");
  });
  it("erkennt den laufenden Termin", () => {
    expect([...r.runningIds]).toEqual(["b"]);
  });
  it("erkennt den nächsten Termin", () => {
    expect(r.next?.id).toBe("c");
  });
});
