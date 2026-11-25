import { describe, expect, it } from "vitest";
import { PULSE_AREAS, PULSE_GROUPS, areaLevel, gapSummary, latestRunDetails, latestRuns, latestRunSteps, type PulseArea } from "./pulse";

const area: PulseArea = { id: "a", title: "A", scenarios: ["s1", "s2"], tables: ["t"], workflows: [] };

describe("areaLevel", () => {
  it("ist grün, wenn alle Tests bestanden", () => expect(areaLevel(area, { runs: { s1: "ok", s2: "ok" } })).toBe("green"));
  it("ist rot bei fehlgeschlagenem Test", () => expect(areaLevel(area, { runs: { s1: "ok", s2: "failed" } })).toBe("red"));
  it("ist gelb, wenn ein Test noch fehlt", () => expect(areaLevel(area, { runs: { s1: "ok" } })).toBe("yellow"));
  it("ist grau, wenn nie geprüft", () => expect(areaLevel(area, { runs: {} })).toBe("grey"));
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

describe("latestRunSteps", () => {
  it("liest die Schritte des neuesten Laufs je Szenario", () => {
    expect(latestRunSteps([
      { scenario_id: "s1", status: "ok", created_at: "2026-11-20T10:00:00Z", steps: [{ id: "old", label: "Alt", status: "failed", message: "alt" }] },
      { scenario_id: "s1", status: "failed", created_at: "2026-11-22T10:00:00Z", steps: [
        { id: "create", label: "Anlegen", status: "ok", durationMs: 120 },
        { id: "check", label: "Prüfen", status: "failed", message: "Prüfung kaputt", durationMs: 35 },
      ] },
      { scenario_id: "s2", status: "ok", created_at: "2026-11-21T10:00:00Z" },
    ])).toEqual({
      s1: {
        create: { id: "create", status: "ok", message: undefined, durationMs: 120 },
        check: { id: "check", status: "failed", message: "Prüfung kaputt", durationMs: 35 },
      },
      s2: {},
    });
  });
  it("ignoriert unbrauchbare Schritt-Einträge", () => {
    expect(latestRunSteps([
      { scenario_id: "s1", status: "ok", created_at: "2026-11-20T10:00:00Z", steps: [null, "x", { id: 1 }, { id: "ok", status: "ok" }] },
    ])).toEqual({ s1: { ok: { id: "ok", status: "ok", message: undefined } } });
  });
});

describe("latestRunDetails", () => {
  it("liefert Name, Zeitpunkt, Dauer und Schrittzahlen des neuesten Laufs", () => {
    expect(latestRunDetails([
      { scenario_id: "s1", scenario_title: "Alter Name", status: "failed", created_at: "2026-11-20T10:00:00Z", duration_ms: 50, failed_steps: 2, total_steps: 5 },
      { scenario_id: "s1", scenario_title: "Kontakt-Lifecycle", status: "ok", created_at: "2026-11-22T10:00:00Z", duration_ms: 820, failed_steps: 0, total_steps: 7 },
      { scenario_id: "s2", status: "ok", created_at: "2026-11-21T10:00:00Z", duration_ms: null },
    ])).toEqual({
      s1: { status: "ok", createdAt: "2026-11-22T10:00:00Z", title: "Kontakt-Lifecycle", durationMs: 820, failedSteps: 0, totalSteps: 7 },
      s2: { status: "ok", createdAt: "2026-11-21T10:00:00Z", title: undefined, durationMs: undefined, failedSteps: undefined, totalSteps: undefined },
    });
  });
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
    for (const entry of PULSE_AREAS) expect(entry.scenarios.length).toBeGreaterThan(0);
  });
  it("führt kein Szenario in zwei Bereichen", () => {
    const seen = new Set<string>();
    for (const entry of PULSE_AREAS) for (const id of entry.scenarios) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
  it("enthält das Jour-fixe-Plattformszenario", () => {
    const meetings = PULSE_AREAS.find((entry) => entry.id === "meetings");
    expect(meetings?.scenarios).toContain("jour-fixe-platform-integration");
  });
  it("nennt für jeden Bereich Haupttabellen", () => {
    for (const entry of PULSE_AREAS) expect(entry.tables.length).toBeGreaterThan(0);
  });
  it("hinterlegt für jeden Bereich deklarierte Workflow-Schritte", () => {
    for (const entry of PULSE_AREAS) {
      expect(entry.workflows.length).toBeGreaterThan(0);
      for (const workflow of entry.workflows) expect(workflow.steps.length).toBeGreaterThan(0);
    }
  });
});

describe("PULSE_GROUPS", () => {
  it("gliedert die Kacheln in Vorgangsbetrieb, Termine und Wächter", () => {
    expect(PULSE_GROUPS.map((group) => group.title)).toEqual([
      "Vorgangs- & Mandatsbetrieb",
      "Termine & Repräsentanz",
      "Wächter: Zugriffsschutz (RLS)",
    ]);
  });
  it("ordnet jeden Bereich genau einer Gruppe zu", () => {
    const grouped = PULSE_GROUPS.flatMap((group) => group.areas);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(new Set(grouped)).toEqual(new Set(PULSE_AREAS.map((entry) => entry.id)));
  });
});
