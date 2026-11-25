import artifact from "./generated/pulse-areas.json";

/** Reine Ampel-Logik für den System-Puls: aus Testläufen und Sicherheitslücken je Bereich einen Status ableiten. */
export type PulseLevel = "green" | "yellow" | "red" | "grey";
export interface PulseStep { id: string; label: string }
export interface PulseWorkflow {
  scenario: string;
  title: string;
  description?: string;
  checks?: string[];
  tables?: string[];
  features: string[];
  steps: PulseStep[];
}
export interface PulseArea { id: string; title: string; scenarios: string[]; tables: string[]; workflows: PulseWorkflow[] }
export interface PulseGroup { id: string; title: string; areas: string[] }

/**
 * Bereiche, Gruppen, Beschreibungen und deklarierte Workflow-Schritte kommen
 * ausschließlich aus `generated/pulse-areas.json`. `scripts/build-pulse-areas.mjs`
 * leitet sie aus den registrierten Selbsttest-Szenarien ab (erster Domänen-Tag)
 * und schlägt fehl, wenn eine Szenario-ID nicht existiert, ein Bereich leer
 * bliebe oder ein Bereich keiner Gruppe zugeordnet ist.
 */
export const PULSE_AREAS: PulseArea[] = artifact.areas;

/** Fachliche Gruppen der Kacheln; die RLS-Kennzahl bleibt davon getrennt. */
export const PULSE_GROUPS: PulseGroup[] = artifact.groups;

const DAY_MS = 86_400_000;
/** Bis zu dieser Laufzeit gilt ein Lauf als aktuell. */
export const FRESH_MS = 7 * DAY_MS;
/** Danach gilt die Testlage als unbekannt statt nur als Prüfhinweis. */
export const EXPIRED_MS = 30 * DAY_MS;

export interface PulseInput {
  runs: Record<string, string | undefined>;
  details?: Record<string, RunDetails | undefined>;
  now?: number;
  currentVersion?: string;
}

export interface RunAssessment { level: PulseLevel; reason?: string }

export interface AreaAssessment { level: PulseLevel; reasons: string[]; covered: number; total: number }

const statusReason = (status: string) =>
  status === "failed" ? "Test fehlgeschlagen"
    : status === "blocked" ? "Voraussetzung fehlt"
      : status === "cancelled" ? "Test abgebrochen"
        : status === "running" ? "Test läuft noch"
          : `Status ${status}`;

/**
 * Bewertet einen einzelnen Lauf. Ein grüner Status allein genügt nicht:
 * Demo-Läufe mit behaltenen Daten, fehlgeschlagenes Aufräumen, eine andere
 * App-Version oder ein alter Lauf dürfen nicht als aktuell grün gelten.
 */
export function assessRun(
  run: RunDetails | undefined,
  options: { now?: number; currentVersion?: string } = {},
): RunAssessment {
  if (!run) return { level: "grey", reason: "noch nicht getestet" };
  if (run.status === "failed") return { level: "red", reason: statusReason(run.status) };
  if (run.status !== "ok") return { level: "yellow", reason: statusReason(run.status) };
  if (run.keepData) return { level: "yellow", reason: "Demo-Lauf mit behaltenen Daten" };
  if (run.cleanupStatus === "failed") return { level: "yellow", reason: "Aufräumen fehlgeschlagen" };
  if (run.cleanupStatus === "pending") return { level: "yellow", reason: "Aufräumen steht aus" };
  if (run.appVersion && options.currentVersion && run.appVersion !== options.currentVersion) {
    return { level: "yellow", reason: "andere App-Version" };
  }
  const created = Date.parse(run.createdAt);
  if (Number.isFinite(created)) {
    const age = (options.now ?? Date.now()) - created;
    if (age > EXPIRED_MS) {
      return { level: "grey", reason: `seit ${Math.floor(age / DAY_MS)} Tagen nicht getestet` };
    }
    if (age > FRESH_MS) {
      return { level: "yellow", reason: `seit ${Math.floor(age / DAY_MS)} Tagen nicht getestet` };
    }
  }
  return { level: "green" };
}

/**
 * Bewertet einen Bereich inklusive Abdeckung und Gründen. RLS-Befunde fließen
 * bewusst nicht ein; sie sind eine eigene Kennzahl (`gapSummary`).
 */
export function areaAssessment(area: PulseArea, input: PulseInput): AreaAssessment {
  const runs = area.scenarios.map((id) =>
    input.details?.[id] ?? (input.runs[id] ? { status: input.runs[id]!, createdAt: "" } : undefined));
  const assessments = runs.map((run) => assessRun(run, input));
  const levels = assessments.map((assessment) => assessment.level);

  let level: PulseLevel = "green";
  if (levels.includes("red")) level = "red";
  else if (levels.includes("yellow")) level = "yellow";
  else if (levels.length > 0 && levels.every((entry) => entry === "grey")) level = "grey";
  else if (levels.includes("grey")) level = "yellow";

  const tally = new Map<string, number>();
  for (const assessment of assessments) {
    if (!assessment.reason || assessment.level === "green") continue;
    tally.set(assessment.reason, (tally.get(assessment.reason) ?? 0) + 1);
  }
  const reasons = [...tally].map(([reason, count]) => count > 1 ? `${count}× ${reason}` : reason);

  return {
    level,
    reasons,
    covered: area.scenarios.filter((id) => input.details?.[id] !== undefined || input.runs[id] !== undefined).length,
    total: area.scenarios.length,
  };
}

export function areaLevel(area: PulseArea, input: PulseInput): PulseLevel {
  return areaAssessment(area, input).level;
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

export interface PersistedRun {
  scenario_id: string;
  scenario_title?: string;
  status: string;
  created_at: string;
  duration_ms?: number | null;
  failed_steps?: number;
  total_steps?: number;
  app_version?: string | null;
  keep_data?: boolean;
  cleanup?: { status?: string; message?: string } | null;
  steps?: unknown;
}
export interface PersistedStep { id: string; label?: string; status: string; message?: string; durationMs?: number }

export interface RunDetails {
  status: string;
  createdAt: string;
  title?: string;
  durationMs?: number;
  failedSteps?: number;
  totalSteps?: number;
  appVersion?: string;
  keepData?: boolean;
  cleanupStatus?: string;
}

export interface HistoryRun {
  scenario_id: string;
  status: string;
  created_at: string;
  duration_ms: number | null;
  failed_steps?: number;
  total_steps?: number;
}

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

/**
 * Live-Status gilt nur während eines laufenden Tests. Sobald ein gespeicherter
 * Lauf vorliegt, hat dieser Vorrang – auch wenn die Live-Anzeige später eintrifft.
 */
export function mergeRuns(
  stored: Record<string, string>,
  live: Record<string, string>,
): Record<string, string> {
  return { ...live, ...stored };
}

/**
 * Metadaten des neuesten Laufs je Szenario: gespeicherter Testname, Zeitpunkt,
 * Dauer, Schrittzahlen und Qualitätsmerkmale. Ältere RPC-Antworten ohne diese
 * Felder bleiben gültig.
 */
export function latestRunDetails(rows: PersistedRun[]): Record<string, RunDetails> {
  return Object.fromEntries([...newestByScenario(rows)].map(([scenarioId, row]) => [scenarioId, {
    status: row.status,
    createdAt: row.created_at,
    title: row.scenario_title,
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : undefined,
    failedSteps: typeof row.failed_steps === "number" ? row.failed_steps : undefined,
    totalSteps: typeof row.total_steps === "number" ? row.total_steps : undefined,
    appVersion: typeof row.app_version === "string" ? row.app_version : undefined,
    keepData: row.keep_data === true,
    cleanupStatus: typeof row.cleanup?.status === "string" ? row.cleanup.status : undefined,
  }]));
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
        label: typeof step.label === "string" ? step.label : undefined,
        status: step.status,
        message: typeof step.message === "string" ? step.message : undefined,
        durationMs: typeof step.durationMs === "number" ? step.durationMs : undefined,
      };
    }
    result[scenarioId] = steps;
  }
  return result;
}

/** Verlauf je Szenario, neuester Lauf zuerst. */
export function historyByScenario(rows: HistoryRun[]): Record<string, HistoryRun[]> {
  const grouped: Record<string, HistoryRun[]> = {};
  for (const row of rows) (grouped[row.scenario_id] ??= []).push(row);
  for (const runs of Object.values(grouped)) {
    runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return grouped;
}

/** Anzahl fehlgeschlagener Läufe direkt vor dem neuesten Lauf. */
export function consecutiveFailures(runs: HistoryRun[]): number {
  let count = 0;
  for (const run of runs) {
    if (run.status !== "failed") break;
    count += 1;
  }
  return count;
}

/** Dauervergleich des neuesten Laufs mit dem unmittelbar davor. */
export function durationTrend(runs: HistoryRun[]): { deltaPct: number; direction: "up" | "down" | "flat" } | null {
  const measured = runs.filter((run) => typeof run.duration_ms === "number" && run.duration_ms !== null);
  if (measured.length < 2) return null;
  const [latest, previous] = measured;
  if (!previous.duration_ms) return null;
  const deltaPct = Math.round(((latest.duration_ms! - previous.duration_ms) / previous.duration_ms) * 100);
  return { deltaPct, direction: deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "flat" };
}
