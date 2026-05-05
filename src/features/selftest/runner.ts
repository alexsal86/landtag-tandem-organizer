import { supabase } from "@/integrations/supabase/client";
import type {
  CreatedRecord,
  ScenarioRunState,
  StepRunState,
  TestContext,
  TestScenario,
} from "./types";

export const SELFTEST_PREFIX = "[SELFTEST]";
export const SELFTEST_MARKER = "__SELFTEST__";

function newRunId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** Tabellen in Reihenfolge: spezifischere zuerst, danach Eltern. */
const CLEANUP_ORDER = [
  "task_decision_participants",
  "task_decisions",
  "case_item_interactions",
  "case_items",
  "letter_attachments",
  "letters",
  "tasks",
  "meeting_agenda_documents",
  "meeting_agenda_items",
  "meeting_participants",
  "appointments",
  "meetings",
];

export async function cleanupCreated(
  records: CreatedRecord[],
): Promise<{ ok: boolean; remaining: CreatedRecord[]; message: string }> {
  const remaining: CreatedRecord[] = [];
  // Sortiere nach CLEANUP_ORDER, unbekannte Tabellen am Anfang
  const sorted = [...records].sort((a, b) => {
    const ai = CLEANUP_ORDER.indexOf(a.table);
    const bi = CLEANUP_ORDER.indexOf(b.table);
    return (ai === -1 ? -1 : ai) - (bi === -1 ? -1 : bi);
  });

  for (const rec of sorted) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(rec.table as any) as any)
        .delete()
        .eq("id", rec.id);
      if (error) {
        remaining.push(rec);
      }
    } catch {
      remaining.push(rec);
    }
  }

  return {
    ok: remaining.length === 0,
    remaining,
    message:
      remaining.length === 0
        ? `${records.length} Datensätze entfernt.`
        : `${records.length - remaining.length}/${records.length} entfernt, ${remaining.length} verblieben.`,
  };
}

export interface RunOptions {
  tenantId: string;
  userId: string;
  onUpdate: (state: ScenarioRunState) => void;
}

async function runPreflight(
  userId: string,
  tenantId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.access_token) {
      return { ok: false, message: "Keine aktive Session — bitte erneut anmelden." };
    }
    if (sess.session.user.id !== userId) {
      return {
        ok: false,
        message: `JWT-Drift: Session-User (${sess.session.user.id}) ≠ erwarteter User (${userId}).`,
      };
    }
    const { data: mem, error } = await supabase
      .from("user_tenant_memberships")
      .select("id, is_active")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) return { ok: false, message: `Membership-Check: ${error.message}` };
    if (!mem) {
      return {
        ok: false,
        message: "Keine aktive Tenant-Membership — INSERTs würden an RLS scheitern.",
      };
    }
    return { ok: true, message: "Preflight ok." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function runScenario(
  scenario: TestScenario,
  options: RunOptions,
): Promise<ScenarioRunState> {
  const ctx: TestContext = {
    runId: newRunId(),
    tenantId: options.tenantId,
    userId: options.userId,
    created: [],
    data: {},
  };

  const state: ScenarioRunState = {
    scenarioId: scenario.id,
    status: "running",
    startedAt: Date.now(),
    steps: scenario.steps.map<StepRunState>((step) => ({ step, status: "pending" })),
    cleanup: { status: "pending" },
  };

  const emit = () => options.onUpdate({ ...state, steps: state.steps.map((s) => ({ ...s })) });
  emit();

  let aborted = false;

  // Preflight: Session + aktive Tenant-Membership prüfen, sonst sofort abbrechen.
  const preflight = await runPreflight(options.userId, options.tenantId);
  if (!preflight.ok) {
    state.steps.forEach((s) => {
      s.status = "skipped";
      s.message = preflight.message;
    });
    state.cleanup.status = "ok";
    state.cleanup.message = "Nichts zu tun.";
    state.status = "failed";
    state.finishedAt = Date.now();
    emit();
    return state;
  }

  try {
    for (let i = 0; i < scenario.steps.length; i += 1) {
      const step = scenario.steps[i];
      const slot = state.steps[i];

      if (aborted) {
        slot.status = "skipped";
        emit();
        continue;
      }

      slot.status = "running";
      emit();
      const t0 = performance.now();
      try {
        const res = await step.run(ctx);
        slot.durationMs = Math.round(performance.now() - t0);
        slot.message = res.message;
        slot.details = res.details;
        slot.status = res.ok ? "ok" : "failed";
        if (!res.ok && step.critical !== false) aborted = true;
      } catch (err) {
        slot.durationMs = Math.round(performance.now() - t0);
        slot.message = err instanceof Error ? err.message : String(err);
        slot.status = "failed";
        if (step.critical !== false) aborted = true;
      }
      emit();
    }
  } finally {
    state.cleanup.status = "running";
    emit();
    const cleanupResult = await cleanupCreated(ctx.created);
    state.cleanup.status = cleanupResult.ok ? "ok" : "failed";
    state.cleanup.message = cleanupResult.message;
    state.cleanup.remaining = cleanupResult.remaining;

    state.finishedAt = Date.now();
    const allOk = state.steps.every((s) => s.status === "ok") && state.cleanup.status === "ok";
    state.status = allOk ? "ok" : "failed";
    emit();
  }

  return state;
}

/** Notfall-Cleanup: löscht alle Records mit SELFTEST-Marker im Tenant. */
export async function purgeAllSelftestData(tenantId: string): Promise<{
  ok: boolean;
  removed: Record<string, number>;
  message: string;
}> {
  const removed: Record<string, number> = {};
  const tables: Array<{ name: string; column: string; hasTenant: boolean }> = [
    { name: "task_decisions", column: "title", hasTenant: true },
    { name: "case_item_interactions", column: "summary", hasTenant: true },
    { name: "case_items", column: "subject", hasTenant: true },
    { name: "letter_attachments", column: "file_name", hasTenant: false },
    { name: "letters", column: "title", hasTenant: true },
    { name: "tasks", column: "title", hasTenant: true },
    { name: "meeting_agenda_documents", column: "file_name", hasTenant: false },
    { name: "meeting_agenda_items", column: "title", hasTenant: false },
    { name: "appointments", column: "title", hasTenant: true },
    { name: "meetings", column: "title", hasTenant: true },
  ];

  for (const t of tables) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase.from(t.name as any).delete({ count: "exact" })
        .ilike(t.column, `${SELFTEST_PREFIX}%`);
      if (t.hasTenant) query = query.eq("tenant_id", tenantId);
      const { count, error } = await query;
      if (error) throw error;
      removed[t.name] = count ?? 0;
    } catch (err) {
      removed[t.name] = -1;
      console.error("[selftest] purge failed", t.name, err);
    }
  }

  const failed = Object.values(removed).some((c) => c < 0);
  const total = Object.values(removed).filter((c) => c >= 0).reduce((a, b) => a + b, 0);
  return {
    ok: !failed,
    removed,
    message: failed
      ? "Beim Aufräumen sind Fehler aufgetreten. Bitte Konsole prüfen."
      : `${total} Test-Datensätze entfernt.`,
  };
}
