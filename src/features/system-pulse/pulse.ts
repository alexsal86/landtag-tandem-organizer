import artifact from "./generated/pulse-areas.json";

/** Reine Ampel-Logik für den System-Puls: aus Testläufen und Sicherheitslücken je Bereich einen Status ableiten. */
export type PulseLevel = "green" | "yellow" | "red" | "grey";

export interface PulseArea { id: string; title: string; scenarios: string[]; tables: string[] }

/**
 * Bereiche und ihre Szenarien kommen ausschließlich aus
 * `generated/pulse-areas.json`. `scripts/build-pulse-areas.mjs` leitet die
 * Szenarien aus den registrierten Selbsttest-Szenarien ab (erster Domänen-Tag)
 * und schlägt fehl, wenn eine Szenario-ID nicht existiert oder ein Bereich
 * leer bliebe.
 */
export const PULSE_AREAS: PulseArea[] = artifact.areas;

/** Geordneter Arbeitsablauf der Kacheln; zwischen Nachbarn zeichnet die Karte Pfeile. */
export const PULSE_FLOW: string[] = artifact.flow;

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
export interface FlowBox { x: number; y: number; w: number; h: number }

/** Verbindung zwischen zwei Kacheln: waagerecht in einer Zeile, sonst über die Zeilenschräge. */
export function flowPath(a: FlowBox, b: FlowBox): string {
  if (b.y >= a.y + a.h / 2) {
    const x1 = a.x + a.w / 2, y1 = a.y + a.h + 1;
    const x2 = b.x + b.w / 2, y2 = b.y - 8;
    const mid = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  }
  const x1 = a.x + a.w + 1, y1 = a.y + a.h / 2;
  const x2 = b.x - 8, y2 = b.y + b.h / 2;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

export interface PersistedRun { scenario_id: string; status: string; created_at: string }

/**
 * Neuester persistierter Lauf je Szenario. Die Abfrage liefert bereits
 * absteigend sortiert; der Vergleich macht die Ableitung unabhängig davon.
 */
export function latestRuns(rows: PersistedRun[]): Record<string, string> {
  const newest = new Map<string, PersistedRun>();
  for (const row of rows) {
    const current = newest.get(row.scenario_id);
    if (!current || row.created_at > current.created_at) newest.set(row.scenario_id, row);
  }
  return Object.fromEntries([...newest].map(([scenarioId, row]) => [scenarioId, row.status]));
}

export function gapSummary(gaps: Array<{ severity: string }>, state: GapsState): GapSummary {
  if (state !== "ready") return { level: "grey", critical: 0, warning: 0, unknown: true };
  const critical = gaps.filter((gap) => gap.severity === "critical").length;
  const warning = gaps.filter((gap) => gap.severity === "warning").length;
  const level: PulseLevel = critical > 0 ? "red" : warning > 0 ? "yellow" : "green";
  return { level, critical, warning, unknown: false };
}
