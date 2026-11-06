import type { ScenarioRunState } from "./types";

export type RunReport = Omit<ScenarioRunState, "steps"> & {
  schemaVersion: 1;
  origin: string;
  buildVersion: string;
  steps: Array<Omit<ScenarioRunState["steps"][number], "step"> & {
    step: Pick<ScenarioRunState["steps"][number]["step"], "id" | "label" | "kind">;
  }>;
};
const key = (tenantId: string, userId: string) => `selftest:runs:v2:${tenantId}:${userId}`;

export function toReport(run: ScenarioRunState): RunReport {
  return { ...run, schemaVersion: 1, origin: window.location.origin, buildVersion: import.meta.env.VITE_COMMIT_SHA ?? "nicht hinterlegt",
    steps: run.steps.map(({ step, ...result }) => ({ ...result, step: { id: step.id, label: step.label, kind: step.kind } })) };
}

export function needsCleanup(run: RunReport): boolean {
  return (run.records.length > 0 || run.storageObjects.length > 0) && run.cleanup.status !== "ok";
}

export function readReports(tenantId: string, userId: string): RunReport[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(tenantId, userId)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((run): run is RunReport => run?.schemaVersion === 1 && run.tenantId === tenantId && run.userId === userId
      && ["idle", "running", "ok", "failed", "cancelled", "blocked"].includes(run.status) && ["test", "demo"].includes(run.mode)
      && typeof run.runId === "string" && typeof run.scenarioId === "string"
      && Array.isArray(run.steps) && run.steps.every((s: RunReport["steps"][number]) => s?.step && typeof s.step.label === "string")
      && run.cleanup && typeof run.cleanup.status === "string"
      && Array.isArray(run.records) && run.records.every((r: RunReport["records"][number]) => typeof r?.table === "string" && typeof r.id === "string")
      && Array.isArray(run.storageObjects) && run.storageObjects.every((o: RunReport["storageObjects"][number]) => typeof o?.bucket === "string" && typeof o.path === "string"));
  } catch { return []; }
}

export function saveReport(report: RunReport): boolean {
  const previous = readReports(report.tenantId, report.userId).filter(r => r.runId !== report.runId);
  // Noch aufzuräumende Läufe niemals durch eine Begrenzung der Historie verlieren.
  const reports = [report, ...previous];
  let completed = 0;
  const retained = reports.filter(r => needsCleanup(r) || ++completed <= 20);
  try {
    localStorage.setItem(key(report.tenantId, report.userId), JSON.stringify(retained));
    return true;
  } catch { return false; }
}

export function downloadReports(reports: RunReport[]) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), runs: reports }, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `selbsttests-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
