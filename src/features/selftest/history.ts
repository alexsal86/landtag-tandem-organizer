import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ScenarioRunState } from "./types";

export interface HistoryStep { id: string; label: string; status: string; message?: string; durationMs?: number; details?: unknown }
export interface HistoryRun {
  id: string; scenario_id: string; scenario_title: string; status: string; keep_data: boolean;
  duration_ms: number | null; failed_steps: number; total_steps: number; created_at: string;
  steps: HistoryStep[]; cleanup: { status: string; message?: string } | null;
}

/** Reduziert einen Lauf auf speicherbare Werte (Details gekürzt, damit nichts Riesiges in der DB landet). */
export function toHistoryPayload(state: ScenarioRunState) {
  const steps: HistoryStep[] = state.steps.map((s) => {
    let details: unknown = undefined;
    if (s.details !== undefined) {
      const raw = JSON.stringify(s.details);
      details = raw.length > 4000 ? `${raw.slice(0, 4000)}…` : JSON.parse(raw);
    }
    return { id: s.step.id, label: s.step.label, status: s.status, message: s.message, durationMs: s.durationMs, details };
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
