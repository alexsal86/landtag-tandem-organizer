import { describe, expect, it, vi } from "vitest";
import { readReports, saveReport, toReport, needsCleanup } from "./reports";
import type { ScenarioRunState } from "./types";

const run = (overrides: Partial<ScenarioRunState> = {}): ScenarioRunState => ({
  runId: crypto.randomUUID(), scenarioId: "workflow", tenantId: "office-a", userId: "user-a", status: "ok", mode: "test",
  steps: [{ step: { id: "step", label: "Prüfung", run: async () => ({ ok: true, message: "OK" }) }, status: "ok", details: { expected: 1, actual: 1 } }],
  cleanup: { status: "ok" }, records: [], storageObjects: [], ...overrides,
});
describe("Laufberichte", () => {
  it("speichert Ergebnisse und Soll/Ist ohne ausführbare Funktionen", () => {
    const report = toReport(run());
    expect(saveReport(report)).toBe(true);
    expect(readReports("office-a", "user-a")[0].steps[0]).toMatchObject({ details: { expected: 1, actual: 1 }, step: { id: "step" } });
    expect(JSON.stringify(report)).not.toContain('"run":');
  });
  it("trennt Historien nach Benutzer und Büro", () => {
    saveReport(toReport(run()));
    expect(readReports("office-b", "user-a")).toEqual([]); expect(readReports("office-a", "user-b")).toEqual([]);
  });
  it("übersteht beschädigte lokale Daten", () => {
    localStorage.setItem("selftest:runs:v2:office-a:user-a", '{"broken":true}');
    expect(readReports("office-a", "user-a")).toEqual([]);
    localStorage.setItem("selftest:runs:v2:office-a:user-a", "[null,3,{}]");
    expect(readReports("office-a", "user-a")).toEqual([]);
  });
  it("verliert bei begrenzter Historie keine unaufgeräumten Testdaten", () => {
    const pending = toReport(run({ status: "running", records: [{ table: "tasks", id: "leftover" }], cleanup: { status: "pending" } }));
    saveReport(pending);
    for (let i = 0; i < 25; i++) saveReport(toReport(run()));
    const reports = readReports("office-a", "user-a");
    expect(reports.filter(needsCleanup).map(r => r.runId)).toEqual([pending.runId]); expect(reports).toHaveLength(21);
  });
  it("meldet fehlenden Speicher, ohne den Testlauf zu werfen", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota"); });
    expect(saveReport(toReport(run()))).toBe(false); spy.mockRestore();
  });
});
