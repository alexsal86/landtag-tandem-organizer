import { describe, expect, it } from "vitest";
import { SELFTEST_SCENARIOS } from "@/features/selftest/registry";
import {
  PULSE_AREAS, PULSE_GROUPS, areaAssessment, areaLevel, assessRun, consecutiveFailures,
  durationTrend, gapSummary, historyByScenario, latestRunDetails, latestRuns, latestRunSteps, mergeRuns,
  type HistoryRun, type PulseArea,
} from "./pulse";

const area: PulseArea = { id: "a", title: "A", scenarios: ["s1", "s2"], tables: ["t"], workflows: [] };

const NOW = Date.parse("2026-11-25T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const detail = (overrides: Partial<Parameters<typeof assessRun>[0]> = {}) =>
  ({ status: "ok", createdAt: daysAgo(1), ...overrides });

describe("areaLevel", () => {
  it("ist grün, wenn alle Tests bestanden", () => expect(areaLevel(area, { runs: { s1: "ok", s2: "ok" } })).toBe("green"));
  it("ist rot bei fehlgeschlagenem Test", () => expect(areaLevel(area, { runs: { s1: "ok", s2: "failed" } })).toBe("red"));
  it("ist gelb, wenn ein Test noch fehlt", () => expect(areaLevel(area, { runs: { s1: "ok" } })).toBe("yellow"));
  it("ist grau, wenn nie geprüft", () => expect(areaLevel(area, { runs: {} })).toBe("grey"));
});

describe("assessRun", () => {
  it("ist grün für einen frischen, sauberen Erfolg", () => {
    expect(assessRun(detail(), { now: NOW })).toEqual({ level: "green" });
  });
  it("ist rot bei fehlgeschlagenem Lauf", () => {
    expect(assessRun(detail({ status: "failed" }), { now: NOW }).level).toBe("red");
  });
  it("ist gelb bei abgebrochenem oder blockiertem Lauf", () => {
    expect(assessRun(detail({ status: "cancelled" }), { now: NOW }).reason).toBe("Test abgebrochen");
    expect(assessRun(detail({ status: "blocked" }), { now: NOW }).reason).toBe("Voraussetzung fehlt");
  });
  it("ist gelb für Demo-Läufe mit behaltenen Daten", () => {
    expect(assessRun(detail({ keepData: true }), { now: NOW })).toEqual({ level: "yellow", reason: "Demo-Lauf mit behaltenen Daten" });
  });
  it("ist gelb, wenn das Aufräumen fehlschlägt oder aussteht", () => {
    expect(assessRun(detail({ cleanupStatus: "failed" }), { now: NOW }).reason).toBe("Aufräumen fehlgeschlagen");
    expect(assessRun(detail({ cleanupStatus: "pending" }), { now: NOW }).reason).toBe("Aufräumen steht aus");
  });
  it("ist gelb bei einer anderen App-Version", () => {
    expect(assessRun(detail({ appVersion: "alt" }), { now: NOW, currentVersion: "neu" }))
      .toEqual({ level: "yellow", reason: "andere App-Version" });
  });
  it("ist nach sieben Tagen gelb und nach dreißig Tagen grau", () => {
    expect(assessRun(detail({ createdAt: daysAgo(8) }), { now: NOW })).toEqual({ level: "yellow", reason: "seit 8 Tagen nicht getestet" });
    expect(assessRun(detail({ createdAt: daysAgo(31) }), { now: NOW }).level).toBe("grey");
  });
  it("ist grau ohne Lauf", () => {
    expect(assessRun(undefined, { now: NOW })).toEqual({ level: "grey", reason: "noch nicht getestet" });
  });
});

describe("areaAssessment", () => {
  it("zählt geprüfte Szenarien und nennt den Grund", () => {
    expect(areaAssessment(area, {
      runs: { s1: "ok" },
      details: { s1: detail() },
      now: NOW,
    })).toEqual({ level: "yellow", reasons: ["noch nicht getestet"], covered: 1, total: 2 });
  });
  it("ist grau, wenn kein Szenario geprüft wurde", () => {
    expect(areaAssessment(area, { runs: {}, now: NOW })).toEqual({ level: "grey", reasons: ["2× noch nicht getestet"], covered: 0, total: 2 });
  });
  it("lässt einen veralteten Erfolg nicht grün werden", () => {
    expect(areaAssessment(area, {
      runs: { s1: "ok", s2: "ok" },
      details: { s1: detail({ createdAt: daysAgo(9) }), s2: detail() },
      now: NOW,
    }).level).toBe("yellow");
  });
  it("bleibt rot, auch wenn andere Szenarien fehlen", () => {
    expect(areaAssessment(area, { runs: { s2: "failed" }, now: NOW }).level).toBe("red");
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
  it("lässt einen gespeicherten Lauf Vorrang vor einem lokalen Live-Status", () => {
    expect(mergeRuns({ s1: "failed" }, { s1: "ok" })).toEqual({ s1: "failed" });
    expect(mergeRuns({}, { s2: "ok" })).toEqual({ s2: "ok" });
  });
});

describe("latestRunDetails", () => {
  it("liefert Name, Zeitpunkt, Dauer, Schrittzahlen und Qualitätsmerkmale", () => {
    expect(latestRunDetails([
      { scenario_id: "s1", scenario_title: "Alter Name", status: "failed", created_at: "2026-11-20T10:00:00Z", duration_ms: 50, failed_steps: 2, total_steps: 5 },
      {
        scenario_id: "s1", scenario_title: "Kontakt-Lifecycle", status: "ok", created_at: "2026-11-22T10:00:00Z",
        duration_ms: 820, failed_steps: 0, total_steps: 7, app_version: "abc", keep_data: true, cleanup: { status: "failed" },
      },
      { scenario_id: "s2", status: "ok", created_at: "2026-11-21T10:00:00Z", duration_ms: null },
    ])).toEqual({
      s1: {
        status: "ok", createdAt: "2026-11-22T10:00:00Z", title: "Kontakt-Lifecycle", durationMs: 820,
        failedSteps: 0, totalSteps: 7, appVersion: "abc", keepData: true, cleanupStatus: "failed",
      },
      s2: {
        status: "ok", createdAt: "2026-11-21T10:00:00Z", title: undefined, durationMs: undefined,
        failedSteps: undefined, totalSteps: undefined, appVersion: undefined, keepData: false, cleanupStatus: undefined,
      },
    });
  });
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
        create: { id: "create", label: "Anlegen", status: "ok", message: undefined, durationMs: 120 },
        check: { id: "check", label: "Prüfen", status: "failed", message: "Prüfung kaputt", durationMs: 35 },
      },
      s2: {},
    });
  });
  it("ignoriert unbrauchbare Schritt-Einträge", () => {
    expect(latestRunSteps([
      { scenario_id: "s1", status: "ok", created_at: "2026-11-20T10:00:00Z", steps: [null, "x", { id: 1 }, { id: "ok", status: "ok" }] },
    ])).toEqual({ s1: { ok: { id: "ok", status: "ok", message: undefined, durationMs: undefined, label: undefined } } });
  });
});

describe("Verlauf", () => {
  const history: HistoryRun[] = [
    { scenario_id: "s1", status: "failed", created_at: "2026-11-24T10:00:00Z", duration_ms: 900 },
    { scenario_id: "s1", status: "failed", created_at: "2026-11-23T10:00:00Z", duration_ms: 1000 },
    { scenario_id: "s1", status: "ok", created_at: "2026-11-22T10:00:00Z", duration_ms: 500 },
    { scenario_id: "s2", status: "ok", created_at: "2026-11-22T10:00:00Z", duration_ms: null },
  ];

  it("gruppiert je Szenario mit dem neuesten Lauf zuerst", () => {
    const grouped = historyByScenario(history);
    expect(grouped.s1.map((run) => run.created_at)).toEqual([
      "2026-11-24T10:00:00Z", "2026-11-23T10:00:00Z", "2026-11-22T10:00:00Z",
    ]);
    expect(grouped.s2).toHaveLength(1);
  });
  it("zählt nur unmittelbar aufeinanderfolgende Fehlschläge", () => {
    expect(consecutiveFailures(historyByScenario(history).s1)).toBe(2);
    expect(consecutiveFailures([{ scenario_id: "s2", status: "ok", created_at: "", duration_ms: null }])).toBe(0);
  });
  it("vergleicht die Dauer mit dem unmittelbaren Vorlauf", () => {
    expect(durationTrend(historyByScenario(history).s1)).toEqual({ deltaPct: -10, direction: "down" });
    expect(durationTrend([{ scenario_id: "s2", status: "ok", created_at: "", duration_ms: 100 }])).toBeNull();
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
  it("führt Haupttabellen als Liste und nennt sie für schreibende Bereiche", () => {
    for (const entry of PULSE_AREAS) expect(Array.isArray(entry.tables)).toBe(true);
    expect(PULSE_AREAS.some((entry) => entry.tables.length > 0)).toBe(true);
  });
  it("bildet alle registrierten Szenarien genau einmal ab", () => {
    expect(PULSE_AREAS.reduce((sum, entry) => sum + entry.scenarios.length, 0)).toBe(SELFTEST_SCENARIOS.length);
  });
  it("hinterlegt für jeden Bereich deklarierte Workflow-Schritte", () => {
    for (const entry of PULSE_AREAS) {
      expect(entry.workflows.length).toBeGreaterThan(0);
      for (const workflow of entry.workflows) expect(workflow.steps.length).toBeGreaterThan(0);
    }
  });
  it("übernimmt Beschreibung und Prüfumfang aus der Registry", () => {
    for (const entry of PULSE_AREAS) {
      for (const workflow of entry.workflows) {
        expect(workflow.description?.length ?? 0).toBeGreaterThan(0);
        expect(Array.isArray(workflow.checks)).toBe(true);
      }
    }
  });
});

describe("PULSE_GROUPS", () => {
  it("gliedert die Kacheln in Vorgangsbetrieb, Termine und Wächter", () => {
    expect(PULSE_GROUPS.map((group) => group.title)).toEqual([
      "Vorgangs- & Mandatsbetrieb",
      "Termine & Repräsentanz",
      "Dokumente & Wissen",
      "Wahlen & Analyse",
      "Organisation & Personal",
      "Geschäftsregeln",
      "Wächter: Zugriffsschutz (RLS)",
    ]);
  });
  it("ordnet jeden Bereich genau einer Gruppe zu", () => {
    const grouped = PULSE_GROUPS.flatMap((group) => group.areas);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(new Set(grouped)).toEqual(new Set(PULSE_AREAS.map((entry) => entry.id)));
  });
});
