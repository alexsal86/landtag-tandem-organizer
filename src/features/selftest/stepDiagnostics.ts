/** Gespeichertes Schrittergebnis, wie es in `selftest_runs.steps` liegt. */
export interface StoredStepResult {
  id?: string;
  label?: string;
  status?: string;
  message?: string;
  details?: unknown;
}

export interface StepDiagnostic {
  /** Prüfpunkt mit Schritt-ID, z. B. "Archivierung (archive)". */
  point: string;
  /** PostgREST-/PostgreSQL-Code, falls der Fehler ihn geliefert hat. */
  code?: string;
  /** Kurzdetails für Listen; gekürzt, damit die Darstellung nicht umbricht. */
  summary?: string;
  /** Derselbe Text ungekürzt – für Stellen, die den vollen Fehler zeigen sollen. */
  fullSummary?: string;
}

const MAX_SUMMARY = 140;
const CODE = /\bCode ([A-Z0-9]{3,})\b/;

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const truncate = (value: string) => (value.length > MAX_SUMMARY ? `${value.slice(0, MAX_SUMMARY - 1)}…` : value);
const printable = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === undefined) return "fehlt";
  try { return JSON.stringify(value); } catch { return String(value); }
};

/** Soll/Ist-Abweichungen aus `expectFields` kurz benennen. */
function differenceSummary(details: unknown): string | undefined {
  if (!Array.isArray(details) || details.length === 0) return undefined;
  const items = details
    .map(record)
    .filter((entry): entry is Record<string, unknown> => entry !== undefined)
    .map((entry) => {
      const field = text(entry.field);
      return field ? `${field}: Soll ${printable(entry.expected)}, Ist ${printable(entry.actual)}` : undefined;
    })
    .filter((entry): entry is string => entry !== undefined);
  if (items.length === 0) return undefined;
  return `${details.length} Abweichung(en) — ${items.slice(0, 2).join(" · ")}${items.length > 2 ? " …" : ""}`;
}

/**
 * Fehlgeschlagene Teilprüfungen und die dabei beobachteten Fehlercodes aus
 * `details`, z. B. `{ staleVersionRejected: false, errors: { stale: "40001" } }`.
 * Workflow-Schritte liefern im Erfolgs- und im Fehlerfall dieselbe `message`;
 * ohne diesen Blick in die Details bliebe die Ursache unsichtbar.
 */
export function summarizeChecks(details: unknown): string | undefined {
  const entry = record(details);
  if (!entry) return undefined;
  const failed = Object.entries(entry)
    .filter(([key, value]) => key !== "errors" && value === false)
    .map(([key]) => key);
  const codes = Object.entries(record(entry.errors) ?? {})
    .map(([key, value]) => ({ key, code: text(value) }))
    .filter((item): item is { key: string; code: string } => item.code !== undefined);
  if (failed.length === 0 && codes.length === 0) return undefined;
  return [
    failed.length > 0 ? `Nicht erfüllt: ${failed.join(", ")}` : "",
    codes.length > 0 ? `Ist-Codes: ${codes.map((item) => `${item.key} ${item.code}`).join(", ")}` : "",
  ].filter(Boolean).join(" · ");
}

/** Ältere Meldungen tragen den Code als Text; er wird abgetrennt und separat ausgewiesen. */
function legacyMessage(message?: string): { code?: string; summary?: string } {
  if (!message) return {};
  const code = CODE.exec(message)?.[1];
  if (!code) return { summary: message };
  const rest = message.replace(CODE, "").split(" · ").map((part) => part.trim()).filter(Boolean);
  return { code, summary: rest.join(" · ") || undefined };
}

/**
 * Fasst einen fehlgeschlagenen Schritt so zusammen, dass Prüfpunkt, Fehlercode
 * und Kurzdetails direkt am Punkt lesbar sind — statt nur "fehlgeschlagen".
 * Nicht fehlgeschlagene Schritte liefern `null`.
 */
export function stepDiagnostic(step: StoredStepResult): StepDiagnostic | null {
  if (step.status !== "failed") return null;
  const label = text(step.label) ?? text(step.id) ?? "Schritt";
  const id = text(step.id);
  const error = record(record(step.details)?.error);
  const legacy = legacyMessage(text(step.message));
  const code = text(error?.code) ?? legacy.code;
  const summary = text(error?.details) ?? text(error?.hint) ?? differenceSummary(step.details)
    ?? text(error?.message) ?? summarizeChecks(step.details) ?? legacy.summary;
  return {
    point: id && id !== label ? `${label} (${id})` : label,
    code,
    summary: summary ? truncate(summary) : undefined,
    fullSummary: summary,
  };
}
