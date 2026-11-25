import artifact from "./generated/pulse-areas.json";

/** Reine Ampel-Logik für den System-Puls: aus Testläufen und Sicherheitslücken je Bereich einen Status ableiten. */
export type PulseLevel = "green" | "yellow" | "red" | "grey";

export interface PulseStep { id: string; label: string }

export interface PulseWorkflow { scenario: string; title: string; features: string[]; steps: PulseStep[] }

export interface PulseArea { id: string; title: string; scenarios: string[]; tables: string[]; workflows: PulseWorkflow[] }

export interface PulseGroup { id: string; title: string; areas: string[] }

/**
 * Bereiche, Gruppen und deklarierte Workflow-Schritte kommen ausschließlich aus
 * `generated/pulse-areas.json`. `scripts/build-pulse-areas.mjs` leitet die
 * Szenarien aus den registrierten Selbsttest-Szenarien ab (erster Domänen-Tag)
 * und schlägt fehl, wenn eine Szenario-ID nicht existiert, ein Bereich leer
 * bliebe oder ein Bereich keiner Gruppe zugeordnet ist.
 */
export const PULSE_AREAS: PulseArea[] = artifact.areas;

/** Fachliche Gruppen der Kacheln; die RLS-Kennzahl bleibt davon getrennt. */
export const PULSE_GROUPS: PulseGroup[] = artifact.groups;

export interface PulseInput { runs: Record<string, "ok" | "failed" | string | undefined> }

/**
 * Bewertet ausschließlich funktionale Selbsttests. RLS-Befunde fließen
 * bewusst nicht ein; sie sind eine eigene Kennzahl (`gapSummary`).
 */
export function areaLevel(area: PulseArea, input: PulseInput): PulseLevel {
  const statuses = area.scenarios.map((id) => input.runs[id]);
  if (statuses.includes("failed")) return "red";
  if (statuses.every((s) => s === undefined)) return "grey";
  if (statuses.some((s) => s !== "ok")) return "yellow";
  return "green";
}

export type GapsState = "loading" | "error" | "ready";

export interface GapSummary { level: PulseLevel; critical: number; warning: number; unknown: boolean }

/**
 * Sicherheitsbefunde getrennt von den Funktions-Selbsttests. Solange die
 * Lückenabfrage lädt oder fehlschlägt, ist die Lage unbekannt (grau) – nie grün.
 */
export function gapSummary(gaps: Array<{ severity: string }>, state: GapsState): GapSummary {
  if (state !== "ready") return { level: "grey", critical: 0, warning: 0, unknown: true };
  const critical = gaps.filter((gap) => gap.severity === "critical").length;
  const warning = gaps.filter((gap) => gap.severity === "warning").length;
  const level: PulseLevel = critical > 0 ? "red" : warning > 0 ? "yellow" : "green";
  return { level, critical, warning, unknown: false };
}

export interface PersistedRun { scenario_id: string; status: string; created_at: string; steps?: unknown }

export interface PersistedStep { id: string; status: string; message?: string }

function newestByScenario(rows: PersistedRun[]): Map<string, PersistedRun> {
  const newest = new Map<string, PersistedRun>();
  for (const row of rows) {
    const current = newest.get(row.scenario_id);
    if (!current || row.created_at > current.created_at) newest.set(row.scenario_id, row);
  }
  return newest;
}

/**
 * Neuester persistierter Lauf je Szenario. Die Abfrage liefert bereits
 * absteigend sortiert; der Vergleich macht die Ableitung unabhängig davon.
 */
export function latestRuns(rows: PersistedRun[]): Record<string, string> {
  return Object.fromEntries([...newestByScenario(rows)].map(([scenarioId, row]) => [scenarioId, row.status]));
}

/** Schritt-Ergebnisse des neuesten Laufs je Szenario, nach Schritt-ID. */
export function latestRunSteps(rows: PersistedRun[]): Record<string, Record<string, PersistedStep>> {
  const result: Record<string, Record<string, PersistedStep>> = {};
  for (const [scenarioId, row] of newestByScenario(rows)) {
    const steps: Record<string, PersistedStep> = {};
    for (const raw of Array.isArray(row.steps) ? row.steps : []) {
      if (!raw || typeof raw !== "object") continue;
      const step = raw as Record<string, unknown>;
      if (typeof step.id !== "string" || typeof step.status !== "string") continue;
      steps[step.id] = {
        id: step.id,
        status: step.status,
        message: typeof step.message === "string" ? step.message : undefined,
      };
    }
    result[scenarioId] = steps;
  }
  return result;
}
