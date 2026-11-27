import { describe, it, expect } from "vitest";
import { compareRuns, toHistoryPayload } from "./history";
import type { ScenarioRunState } from "./types";

function runState(details: unknown): ScenarioRunState {
  return {
    runId: "run-1", tenantId: "tenant-1", userId: "user-1", scenarioId: "demo", status: "failed", mode: "test",
    records: [], storageObjects: [], startedAt: 1000, finishedAt: 1500,
    cleanup: { status: "ok" },
    steps: [{ step: { id: "step-1", label: "Schritt 1", run: async () => ({ ok: true, message: "" }) }, status: "failed", message: "fehlgeschlagen", durationMs: 5, details }],
  };
}

describe("toHistoryPayload", () => {
  it("keeps small details unchanged and marks nothing as truncated", () => {
    const details = { step: { id: "step-1" }, error: { message: "RLS verweigert", code: "42501", hint: "Policy fehlt" } };
    const p = toHistoryPayload(runState(details));
    expect(p.steps[0].details).toEqual(details);
    expect(p.steps[0].detailsTruncated).toBeUndefined();
  });

  it("keeps error code, hint and the leading Soll/Ist entries when details exceed the budget", () => {
    const mismatches = Array.from({ length: 200 }, (_, i) => ({ field: `feld_${i}`, expected: "a".repeat(40), actual: "b".repeat(40) }));
    const details = {
      step: { id: "step-1", label: "Schritt 1" },
      error: { message: "Prüfung fehlgeschlagen", code: "42501", details: "D".repeat(6000), hint: "Policy für tenant_id prüfen" },
      mismatches,
    };
    expect(JSON.stringify(details).length).toBeGreaterThan(4000);

    const p = toHistoryPayload(runState(details));
    const stored = p.steps[0].details as {
      step: { id: string };
      error: { message: string; code: string; details: string; hint: string };
      mismatches: Array<{ field: string; expected: string; actual: string }>;
    };

    expect(JSON.stringify(stored).length).toBeLessThanOrEqual(4000);
    expect(stored.step.id).toBe("step-1");
    expect(stored.error.code).toBe("42501");
    expect(stored.error.hint).toBe("Policy für tenant_id prüfen");
    expect(stored.error.details.endsWith("…")).toBe(true);
    expect(stored.mismatches[0]).toEqual({ field: "feld_0", expected: "a".repeat(40), actual: "b".repeat(40) });
    expect(p.steps[0].detailsTruncated).toBe(true);
    expect(p.steps[0].detailsOmitted).toBeGreaterThan(0);
  });

  it("keeps the leading mismatches as objects when expectFields returns a bare list", () => {
    const mismatches = Array.from({ length: 120 }, (_, i) => ({ field: `feld_${i}`, expected: i, actual: null }));
    const p = toHistoryPayload(runState(mismatches));
    const stored = p.steps[0].details as Array<{ field: string; expected: number; actual: unknown }>;

    expect(Array.isArray(stored)).toBe(true);
    expect(stored[0]).toEqual({ field: "feld_0", expected: 0, actual: null });
    expect(stored.length).toBeLessThan(mismatches.length);
    expect(p.steps[0].detailsTruncated).toBe(true);
  });

  it("does not try to store details for steps that never produced any", () => {
    const p = toHistoryPayload({ ...runState(undefined), status: "ok" });
    expect(p.steps[0].details).toBeUndefined();
    expect(p.steps[0].detailsTruncated).toBeUndefined();
  });
});

describe("compareRuns", () => {
  it("reports a step that went from failed to ok as fixed", () => {
    const r = compareRuns([{ id: "a", label: "A", status: "failed" }], [{ id: "a", label: "A", status: "ok" }]);
    expect(r.fixed).toEqual(["A"]);
    expect(r.broken).toEqual([]);
  });
  it("reports a step that went from ok to failed as broken", () => {
    const r = compareRuns([{ id: "a", label: "A", status: "ok" }], [{ id: "a", label: "A", status: "failed" }]);
    expect(r.broken).toEqual(["A"]);
  });
});
