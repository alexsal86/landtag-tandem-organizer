import { describe, expect, it } from "vitest";
import { PULSE_AREAS, PULSE_FLOW, areaLevel, flowPath, gapSummary, latestRuns, type PulseArea } from "./pulse";

const area: PulseArea = { id: "a", title: "A", scenarios: ["s1", "s2"], tables: ["t"] };

describe("areaLevel", () => {
  it("ist grün, wenn alle Tests bestanden", () => expect(areaLevel(area, { runs: { s1: "ok", s2: "ok" } })).toBe("green"));
  it("ist rot bei fehlgeschlagenem Test", () => expect(areaLevel(area, { runs: { s1: "ok", s2: "failed" } })).toBe("red"));
  it("ist gelb, wenn ein Test noch fehlt", () => expect(areaLevel(area, { runs: { s1: "ok" } })).toBe("yellow"));
  it("ist grau, wenn nie geprüft", () => expect(areaLevel(area, { runs: {} })).toBe("grey"));
});

describe("flowPath", () => {
  it("verbindet Kacheln derselben Zeile von rechts nach links", () => {
    const d = flowPath({ x: 0, y: 0, w: 100, h: 50 }, { x: 120, y: 0, w: 100, h: 50 });
    expect(d.startsWith("M 101 25")).toBe(true);
    expect(d.endsWith("112 25")).toBe(true);
  });
  it("verbindet einen Zeilenumbruch von unten nach oben", () => {
    const d = flowPath({ x: 200, y: 0, w: 100, h: 50 }, { x: 0, y: 80, w: 100, h: 50 });
    expect(d.startsWith("M 250 51")).toBe(true);
    expect(d.endsWith("50 72")).toBe(true);
  });
});

describe("latestRuns", () => {
  it("nimmt je Szenario den neuesten Lauf, unabhängig von der Reihenfolge", () => {
    expect(latestRuns([
      { scenario_id: "s1", status: "ok", created_at: "2026-11-20T10:00:00Z" },
      { scenario_id: "s2", status: "failed", created_at: "2026-11-21T10:00:00Z" },
      { scenario_id: "s1", status: "failed", created_at: "2026-11-22T10:00:00Z" },
      { scenario_id: "s2", status: "ok", created_at: "2026-11-19T10:00:00Z" },
    ])).toEqual({ s1: "failed", s2: "failed" });
  });
  it("ist leer ohne Läufe", () => expect(latestRuns([])).toEqual({}));
});

describe("gapSummary", () => {
  it("ist unbekannt, solange die Abfrage lädt", () => expect(gapSummary([], "loading")).toEqual({ level: "grey", critical: 0, warning: 0, unknown: true }));
  it("ist unbekannt, wenn die Abfrage fehlschlägt", () => expect(gapSummary([], "error")).toEqual({ level: "grey", critical: 0, warning: 0, unknown: true }));
  it("zählt kritische Lücken und wird rot", () => expect(gapSummary([{ severity: "critical" }, { severity: "warning" }, { severity: "ok" }], "ready")).toEqual({ level: "red", critical: 1, warning: 1, unknown: false }));
  it("wird gelb bei Warnungen ohne kritische Lücke", () => expect(gapSummary([{ severity: "warning" }], "ready").level).toBe("yellow"));
  it("ist grün ohne Befund", () => expect(gapSummary([{ severity: "ok" }], "ready").level).toBe("green"));
});

describe("PULSE_AREAS", () => {
  it("führt je Bereich mindestens ein Szenario", () => {
    for (const area of PULSE_AREAS) expect(area.scenarios.length).toBeGreaterThan(0);
  });
  it("führt kein Szenario in zwei Bereichen", () => {
    const seen = new Set<string>();
    for (const area of PULSE_AREAS) for (const id of area.scenarios) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
  it("enthält das Jour-fixe-Plattformszenario", () => {
    const meetings = PULSE_AREAS.find((area) => area.id === "meetings");
    expect(meetings?.scenarios).toContain("jour-fixe-platform-integration");
  });
  it("führt die Fachbereiche im geforderten Arbeitsablauf", () => {
    expect(PULSE_FLOW).toEqual(["contacts", "appointments", "cases", "tasks", "decisions", "meetings"]);
  });
  it("nennt für jeden Bereich Haupttabellen", () => {
    for (const area of PULSE_AREAS) expect(area.tables.length).toBeGreaterThan(0);
  });
});
