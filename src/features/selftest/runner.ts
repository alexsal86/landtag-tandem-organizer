import { supabase } from "@/integrations/supabase/client";
import type { CreatedRecord, ScenarioRunState, StorageObject, TestContext, TestScenario } from "./types";
import { recoverArtifacts } from "./artifacts";
import { selftestDatabase } from "./database";
import { errorMessage } from "./verify";

export const SELFTEST_PREFIX = "[SELFTEST]";
export const SELFTEST_MARKER = "__SELFTEST__";

// Fremdschlüssel: Antworten vor Teilnehmern, Anfragen vor Terminen, Kinder vor Eltern.
const CLEANUP_ORDER = [
  "task_decision_responses", "task_decision_participants", "task_decisions",
  "document_annotations", "letter_attachments", "documents", "letters", "quick_notes", "contact_activities", "contacts", "tasks",
  "case_item_interactions", "case_items", "day_slips", "appointment_requests",
  "meeting_agenda_documents", "meeting_agenda_items", "meeting_participants",
  "appointment_feedback", "appointment_preparations", "appointment_contacts",
  "appointments", "meetings", "event_planning_timeline_assignments",
  "event_planning_checklist_items", "event_planning_contacts", "event_planning_speakers",
  "event_planning_dates", "event_plannings", "daily_briefings",
] as const;

export async function cleanupCreated(records: CreatedRecord[], storageObjects: StorageObject[] = [], onDiscover?: (records: CreatedRecord[], objects: StorageObject[]) => void) {
  const recovered = await recoverArtifacts(records, storageObjects);
  records = recovered.records;
  storageObjects = recovered.storageObjects;
  onDiscover?.(records, storageObjects);
  const remaining: CreatedRecord[] = [];
  const storageRemaining: StorageObject[] = [];
  const errors: string[] = [...recovered.errors];
  for (const object of storageObjects) {
    try {
      if (object.bucket !== "documents" || !object.path) throw new Error("Unbekanntes Testdatei-Ziel.");
      const { error } = await supabase.storage.from(object.bucket).remove([object.path]);
      if (error) throw error;
    } catch (error) {
      storageRemaining.push(object);
      errors.push(errorMessage(error));
    }
  }
  const sorted = [...records].reverse().sort((a, b) =>
    CLEANUP_ORDER.indexOf(a.table as typeof CLEANUP_ORDER[number]) - CLEANUP_ORDER.indexOf(b.table as typeof CLEANUP_ORDER[number]));
  for (const record of sorted) {
    try {
      if (recovered.blocked.has(`${record.table}/${record.id}`)) { remaining.push(record); continue; }
      if (!(CLEANUP_ORDER as readonly string[]).includes(record.table)) throw new Error(`Kein Cleanup für ${record.table} definiert.`);
      const { error } = await selftestDatabase.from(record.table).delete().eq("id", record.id);
      if (error) throw error;
      // RLS kann DELETE ohne Fehler und ohne gelöschte Zeile beantworten.
      const check = await selftestDatabase.from(record.table).select("id").eq("id", record.id).maybeSingle();
      if (check.error) throw check.error;
      if (check.data) throw new Error(`${record.table}: Datensatz nach DELETE noch vorhanden.`);
    } catch (error) {
      remaining.push(record);
      errors.push(errorMessage(error));
    }
  }
  return {
    ok: remaining.length === 0 && storageRemaining.length === 0,
    remaining, storageRemaining, errors,
    message: `${records.length - remaining.length}/${records.length} Datensätze und ${storageObjects.length - storageRemaining.length}/${storageObjects.length} Dateien entfernt.`,
  };
}

export interface RunOptions {
  tenantId: string;
  userId: string;
  onUpdate: (state: ScenarioRunState) => void;
  keepData?: boolean;
  /** Stoppt nach dem laufenden Schritt; dessen Schreiboperationen werden abgewartet. */
  signal?: AbortSignal;
}

async function runPreflight(userId: string, tenantId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token || data.session.user.id !== userId) {
    throw new Error("Keine passende aktive Session — bitte erneut anmelden.");
  }
  const membership = await supabase.from("user_tenant_memberships")
    .select("id, role").eq("user_id", userId).eq("tenant_id", tenantId).eq("is_active", true).maybeSingle();
  if (membership.error) throw membership.error;
  if (!membership.data) throw new Error("Keine aktive Mitgliedschaft im gewählten Büro.");
  return membership.data.role;
}

export async function runScenario(scenario: TestScenario, options: RunOptions): Promise<ScenarioRunState> {
  const ctx: TestContext = {
    runId: crypto.randomUUID(), tenantId: options.tenantId, userId: options.userId,
    created: [], storageObjects: [], data: {},
    trackRecord: (record) => {
      if (!ctx.created.some(r => r.table === record.table && r.id === record.id)) ctx.created.push(record);
      emit();
    },
    trackStorage: (object) => {
      if (!ctx.storageObjects.some(o => o.bucket === object.bucket && o.path === object.path)) ctx.storageObjects.push(object);
      emit();
    },
  };
  const state: ScenarioRunState = {
    runId: ctx.runId, tenantId: ctx.tenantId, userId: ctx.userId, scenarioId: scenario.id,
    mode: options.keepData ? "demo" : "test", status: "running", startedAt: Date.now(),
    records: [], storageObjects: [], steps: scenario.steps.map(step => ({ step, status: "pending" })),
    cleanup: { status: "pending" },
  };
  const emit = () => options.onUpdate({ ...state,
    steps: state.steps.map(s => ({ ...s })), cleanup: { ...state.cleanup },
    records: [...ctx.created], storageObjects: [...ctx.storageObjects],
  });
  emit();
  let failedDependency = false;
  try {
    if (scenario.steps.some(step => step.kind !== "logic")) {
      try {
        ctx.role = await runPreflight(options.userId, options.tenantId);
        if (scenario.requiredRoles && (!ctx.role || !scenario.requiredRoles.includes(ctx.role))) {
          throw new Error(`Erforderliche Rolle: ${scenario.requiredRoles.join(" oder ")}. Aktuell: ${ctx.role}.`);
        }
      } catch (error) {
        state.status = "blocked";
        state.message = errorMessage(error);
        return state;
      }
    }
    for (const slot of state.steps) {
      if (options.signal?.aborted || failedDependency) {
        slot.status = "skipped";
        slot.message = options.signal?.aborted ? "Lauf abgebrochen." : "Vorheriger notwendiger Schritt fehlgeschlagen.";
        emit();
        continue;
      }
      slot.status = "running";
      emit();
      const started = performance.now();
      try {
        const result = await slot.step.run(ctx);
        slot.status = result.ok ? "ok" : "failed";
        slot.message = result.message;
        slot.details = result.details;
      } catch (error) {
        slot.status = "failed";
        slot.message = errorMessage(error);
      }
      slot.durationMs = Math.round(performance.now() - started);
      if (slot.status === "failed" && slot.step.critical !== false) failedDependency = true;
      emit();
    }
  } finally {
    let discoveryError: string | undefined;
    if (scenario.collectArtifacts && ctx.created.length > 0) {
      try { await scenario.collectArtifacts(ctx); }
      catch (error) { discoveryError = `Folgedaten konnten nicht vollständig ermittelt werden: ${error instanceof Error ? error.message : String(error)}`; }
    }
    const stepsOk = state.steps.length > 0 && state.steps.every(s => s.status === "ok");
    if (state.status === "blocked") {
      state.steps.forEach(s => { s.status = "skipped"; s.message = state.message; });
    }
    if (options.keepData && stepsOk && !discoveryError && !options.signal?.aborted) {
      state.cleanup = { status: "skipped", message: "Demo-Daten behalten. Über diesen Lauf gezielt aufräumbar." };
      state.links = scenario.links?.(ctx);
    } else {
      state.cleanup.status = "running";
      emit();
      const result = await cleanupCreated(ctx.created, ctx.storageObjects, (records, objects) => {
        records.forEach(record => ctx.trackRecord(record));
        objects.forEach(object => ctx.trackStorage(object));
      });
      state.cleanup = { status: result.ok && !discoveryError ? "ok" : "failed", message: [result.message, ...result.errors, discoveryError].filter(Boolean).join(" "),
        remaining: result.remaining, storageRemaining: result.storageRemaining };
    }
    if (state.status !== "blocked") {
      state.status = state.cleanup.status === "failed" || state.steps.some(s => s.status === "failed") ? "failed"
        : options.signal?.aborted ? "cancelled" : stepsOk ? "ok" : "failed";
    }
    state.records = [...ctx.created];
    state.storageObjects = [...ctx.storageObjects];
    state.finishedAt = Date.now();
    emit();
  }
  return state;
}

/** Szenarien laufen nacheinander. Ein Fehler hält unabhängige Szenarien nicht auf. */
export async function runSuite(scenarios: TestScenario[], options: RunOptions) {
  const results: ScenarioRunState[] = [];
  for (const scenario of scenarios) {
    if (options.signal?.aborted) break;
    results.push(await runScenario(scenario, options));
  }
  return results;
}
