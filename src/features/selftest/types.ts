export type StepStatus = "pending" | "running" | "ok" | "failed" | "skipped";

export interface CreatedRecord {
  table: string;
  id: string;
}

export interface StorageObject { bucket: string; path: string }

export interface TestContext {
  runId: string;
  tenantId: string;
  userId: string;
  /** Alle erzeugten Datensätze in chronologischer Reihenfolge — Cleanup arbeitet rückwärts. */
  created: CreatedRecord[];
  storageObjects: StorageObject[];
  role?: string;
  /** Sofort registrieren, damit auch ein unterbrochener Schritt aufräumbar bleibt. */
  trackRecord: (record: CreatedRecord) => void;
  trackStorage: (object: StorageObject) => void;
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
  /** "logic" = prüft reine Regeln ohne Datenbank; Standard "db". */
  kind?: "db" | "logic" | "workflow";
  run: (ctx: TestContext) => Promise<StepResult>;
}

export interface TestScenario {
  id: string;
  title: string;
  description: string;
  /** Tabellen, die das Szenario aktiv schreibt — für Coverage-Check. */
  touches: string[];
  /** Domänen-Tags für UI-Badges, z.B. "letters", "case-items". */
  features: string[];
  /** Tatsächlicher Prüfumfang, getrennt von einem erfolgreichen Testergebnis. */
  checks?: string[];
  limitations?: string[];
  requiredRoles?: string[];
  /** Von Triggern/Funktionen erzeugte Folgeobjekte auch bei Fehlern einsammeln. */
  collectArtifacts?: (ctx: TestContext) => Promise<void>;
  /** Spalten-Coverage pro Tabelle — vom Coverage-Script ausgewertet. */
  writes?: Array<{ table: string; columns: string[] }>;
  /** Optional: Deep-Links nach erfolgreichem Lauf (Demo-Modus zeigt sie an). */
  links?: (ctx: TestContext) => Array<{ label: string; href: string }>;
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
  runId: string;
  tenantId: string;
  userId: string;
  scenarioId: string;
  status: "idle" | "running" | "ok" | "failed" | "cancelled" | "blocked";
  message?: string;
  mode: "test" | "demo";
  records: CreatedRecord[];
  storageObjects: StorageObject[];
  steps: StepRunState[];
  startedAt?: number;
  finishedAt?: number;
  cleanup: { status: StepStatus; message?: string; remaining?: CreatedRecord[]; storageRemaining?: StorageObject[] };
  /** Im Demo-Modus gefüllt: Deep-Links zu den erzeugten Datensätzen. */
  links?: Array<{ label: string; href: string }>;
}
