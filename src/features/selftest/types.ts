export type StepStatus = "pending" | "running" | "ok" | "failed" | "skipped";

export interface CreatedRecord {
  table: string;
  id: string;
}

export interface TestContext {
  runId: string;
  tenantId: string;
  userId: string;
  /** Alle erzeugten Datensätze in chronologischer Reihenfolge — Cleanup arbeitet rückwärts. */
  created: CreatedRecord[];
  /** Frei nutzbarer Speicher für Werte zwischen Steps. */
  data: Record<string, unknown>;
}

export interface StepResult {
  ok: boolean;
  message: string;
  details?: unknown;
}

export interface TestStep {
  id: string;
  label: string;
  /** Wenn true: Step muss erfolgreich sein, sonst werden weitere Steps übersprungen. */
  critical?: boolean;
  run: (ctx: TestContext) => Promise<StepResult>;
}

export interface TestScenario {
  id: string;
  title: string;
  description: string;
  steps: TestStep[];
}

export interface StepRunState {
  step: TestStep;
  status: StepStatus;
  message?: string;
  durationMs?: number;
  details?: unknown;
}

export interface ScenarioRunState {
  scenarioId: string;
  status: "idle" | "running" | "ok" | "failed";
  steps: StepRunState[];
  startedAt?: number;
  finishedAt?: number;
  cleanup: { status: StepStatus; message?: string; remaining?: CreatedRecord[] };
}
