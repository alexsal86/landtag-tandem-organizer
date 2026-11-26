import { describe, expect, it } from "vitest";
import { matchAssignee, parseDaySlipLine, parseDueDate, SHORTCUT_HELP } from "../daySlipShorthand";

const users = [
  { id: "user-joschka", name: "Joschka Fischer" },
  { id: "user-mueller-1", name: "Müller" },
  { id: "user-mueller-2", name: "Müller" },
];
const today = "2026-11-26";

describe("Tageszettel-Kürzel", () => {
  it("liest die Zielmarker am Zeilenanfang und entfernt sie aus dem Text", () => {
    expect(parseDaySlipLine("+ Rückruf Joschka", { todayKey: today })).toMatchObject({ kind: "task", text: "Rückruf Joschka" });
    expect(parseDaySlipLine("~ Gesprächsnotiz", { todayKey: today })).toMatchObject({ kind: "note", text: "Gesprächsnotiz" });
    expect(parseDaySlipLine("? Zustimmen?", { todayKey: today })).toMatchObject({ kind: "decision", text: "Zustimmen?" });
    expect(parseDaySlipLine("+", { todayKey: today })).toMatchObject({ kind: "task", text: "" });
  });

  it("lässt Telefonnummern und Marker mitten in der Zeile unangetastet", () => {
    expect(parseDaySlipLine("+49 30 123456", { todayKey: today })).toEqual({ text: "+49 30 123456", person: undefined, dueDate: undefined });
    expect(parseDaySlipLine("Anruf +49 30 123456", { todayKey: today }).kind).toBeUndefined();
    expect(parseDaySlipLine("  Zwei  Leerzeichen  ", { todayKey: today }).text).toBe("Zwei  Leerzeichen");
  });

  it("löst @Name exakt oder eindeutig per Vornamen auf und behält Unbekanntes im Text", () => {
    expect(parseDaySlipLine("+ Rückruf @Joschka", { todayKey: today, users })).toMatchObject({
      kind: "task", text: "Rückruf", person: { id: "user-joschka" },
    });
    expect(parseDaySlipLine("+ Rückruf @Joschka Fischer", { todayKey: today, users }).person?.id).toBe("user-joschka");
    expect(parseDaySlipLine("+ Termin @Müller", { todayKey: today, users })).toMatchObject({
      text: "Termin @Müller", person: undefined,
    });
    expect(parseDaySlipLine("+ Termin @Unbekannt", { todayKey: today, users }).text).toBe("Termin @Unbekannt");
    expect(parseDaySlipLine("+ Termin @Joschka", { todayKey: today }).text).toBe("Termin @Joschka");
    expect(matchAssignee("  joschka  ", users)?.id).toBe("user-joschka");
  });

  it("versteht Fälligkeiten als heute/morgen/+N, ISO und deutsches Datum mit Jahreslogik", () => {
    expect(parseDueDate("heute", today)).toBe("2026-11-26");
    expect(parseDueDate("morgen", today)).toBe("2026-11-27");
    expect(parseDueDate("übermorgen", today)).toBe("2026-11-28");
    expect(parseDueDate("+3", today)).toBe("2026-11-29");
    expect(parseDueDate("2026-12-01", today)).toBe("2026-12-01");
    expect(parseDueDate("3.3.", today)).toBe("2027-03-03");
    expect(parseDueDate("01.12.2026", today)).toBe("2026-12-01");
    expect(parseDueDate("31.02.", today)).toBeUndefined();
    expect(parseDueDate("bald", today)).toBeUndefined();
  });

  it("kombiniert Aufgabe, Person und Fälligkeit und normalisiert nur dann den Text", () => {
    expect(parseDaySlipLine("+  Unterlagen  prüfen @Joschka >3.3.", { todayKey: today, users })).toEqual({
      kind: "task",
      text: "Unterlagen prüfen",
      person: { id: "user-joschka", name: "Joschka Fischer" },
      dueDate: "2027-03-03",
    });
    expect(parseDaySlipLine("~ Notiz @Joschka >morgen", { todayKey: today, users })).toMatchObject({
      kind: "note", text: "Notiz @Joschka >morgen",
    });
    // Too many tokens for one line: only the first recognised person and date count, the rest stays text.
    expect(parseDaySlipLine("+ Termin @Joschka @Müller >1.12. >2.12.", { todayKey: today, users })).toMatchObject({
      text: "Termin @Müller >2.12.", person: { id: "user-joschka" }, dueDate: "2026-12-01",
    });
  });

  it("beschreibt jedes Kürzel für den Hilfe-Tooltip", () => {
    expect(SHORTCUT_HELP.map(entry => entry.marker)).toEqual(["+ Aufgabe", "~ Notiz", "? Entscheidung", "@Name", ">3.3."]);
  });
});
