import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ScenarioRunState } from "./types";

export interface HistoryStep {
  id: string; label: string; status: string; message?: string; durationMs?: number; details?: unknown;
  /** Gesetzt, wenn Details gekürzt wurden — die Struktur (Code, Hinweis, Soll/Ist) bleibt erhalten. */
  detailsTruncated?: boolean;
  /** Wie viele Listeneinträge bzw. Felder beim Kürzen wegfielen. */
  detailsOmitted?: number;
}
export interface HistoryRun {
  id: string; scenario_id: string; scenario_title: string; status: string; keep_data: boolean;
  duration_ms: number | null; failed_steps: number; total_steps: number; created_at: string;
  steps: HistoryStep[]; cleanup: { status: string; message?: string } | null;
}

const DETAIL_BUDGET = 4000;
const MAX_DEPTH = 4;

interface CompactLimits { items: number; text: number; keys: number }

/** Stufenweise strenger, bis die Details ins Budget passen; die Struktur bleibt in jeder Stufe. */
const COMPACT_LIMITS: CompactLimits[] = [
  { items: 20, text: 1000, keys: 40 },
  { items: 5, text: 300, keys: 20 },
  { items: 1, text: 120, keys: 12 },
];

interface CompactState { truncated: boolean; omitted: number }

/**
 * Kürzt Details, ohne ihre Form zu verlieren: Objekte bleiben Objekte, damit
 * `error.code`, `error.hint` und die Soll/Ist-Felder auch bei großen Fehlern
 * lesbar bleiben. Nur sehr lange Texte und überzählige Listen-/Objekteinträge
 * fallen weg.
 */
function compactValue(value: unknown, state: CompactState, limits: CompactLimits, depth = 0): unknown {
  if (typeof value === "string") {
    if (value.length <= limits.text) return value;
    state.truncated = true;
    return `${value.slice(0, limits.text)}…`;
  }
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) {
    state.truncated = true;
    return "[zu tief verschachtelt]";
  }
  if (Array.isArray(value)) {
    const kept = value.slice(0, limits.items).map((entry) => compactValue(entry, state, limits, depth + 1));
    if (value.length > limits.items) {
      state.truncated = true;
      state.omitted += value.length - limits.items;
    }
    return kept;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const keptEntries = entries.slice(0, limits.keys);
  if (entries.length > limits.keys) {
    state.truncated = true;
    state.omitted += entries.length - limits.keys;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of keptEntries) out[key] = compactValue(entry, state, limits, depth + 1);
  return out;
}

/** Kompaktiert Details bis sie in das Speicherbudget passen und meldet, was gekürzt wurde. */
export function compactDetails(details: unknown): { value: unknown; truncated: boolean; omitted: number } {
  let result: { value: unknown; truncated: boolean; omitted: number } = { value: details, truncated: false, omitted: 0 };
  for (const limits of COMPACT_LIMITS) {
    const state: CompactState = { truncated: false, omitted: 0 };
    const value = compactValue(details, state, limits);
    result = { value, truncated: state.truncated, omitted: state.omitted };
    let size = 0;
    try { size = JSON.stringify(value)?.length ?? 0; } catch { size = Number.POSITIVE_INFINITY; }
    if (size <= DETAIL_BUDGET) break;
    result.truncated = true;
  }
  return result;
}

/** Reduziert einen Lauf auf speicherbare Werte (Details strukturerhaltend gekürzt statt abgeschnitten). */
export function toHistoryPayload(state: ScenarioRunState) {
  const steps: HistoryStep[] = state.steps.map((s) => {
    const step: HistoryStep = { id: s.step.id, label: s.step.label, status: s.status, message: s.message, durationMs: s.durationMs };
    if (s.details !== undefined) {
      const compacted = compactDetails(s.details);
      step.details = compacted.value;
      if (compacted.truncated) step.detailsTruncated = true;
      if (compacted.omitted > 0) step.detailsOmitted = compacted.omitted;
    }
    return step;
  });
  return {
    status: state.status,
    duration_ms: state.startedAt && state.finishedAt ? state.finishedAt - state.startedAt : null,
    failed_steps: steps.filter((s) => s.status === "failed").length,
    total_steps: steps.length,
    steps,
    cleanup: { status: state.cleanup.status, message: state.cleanup.message },
  };
}

/** Vergleicht zwei Läufe schrittweise: was ist neu kaputt, was wurde repariert. */
export function compareRuns(prev: HistoryStep[], next: HistoryStep[]) {
  const before = new Map(prev.map((s) => [s.id, s.status]));
  const fixed: string[] = [];
  const broken: string[] = [];
  for (const s of next) {
    const was = before.get(s.id);
    if (was === "failed" && s.status === "ok") fixed.push(s.label);
    if (was === "ok" && s.status === "failed") broken.push(s.label);
  }
  return { fixed, broken };
}

export async function saveRun(state: ScenarioRunState, meta: { tenantId: string; userId: string; title: string; keepData: boolean }) {
  const p = toHistoryPayload(state);
  const { error } = await supabase.from("selftest_runs").insert({
    tenant_id: meta.tenantId, user_id: meta.userId, scenario_id: state.scenarioId, scenario_title: meta.title,
    keep_data: meta.keepData, status: p.status, duration_ms: p.duration_ms, failed_steps: p.failed_steps,
    total_steps: p.total_steps, steps: p.steps as unknown as Json, cleanup: p.cleanup as unknown as Json,
    app_version: import.meta.env.VITE_COMMIT_SHA ?? null,
  });
  if (error) console.warn("Selbsttest-Verlauf nicht gespeichert:", error.message);
}

export async function loadHistory(tenantId: string, limit = 200): Promise<HistoryRun[]> {
  const { data, error } = await supabase.from("selftest_runs")
    .select("id,scenario_id,scenario_title,status,keep_data,duration_ms,failed_steps,total_steps,created_at,steps,cleanup")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as HistoryRun[];
}
