import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { TestContext, TestScenario, StepResult } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";
import {
  ballChangeEvents, isOnResubmission, stepState, withAutoDeadline, resubmissionHint,
  MINISTRY_RESPONSE_DAYS, type TriageItem,
} from "@/features/cases/items/ball";
import { appendEntries, normalizeStore } from "@/components/dayslip/daySlipState";
import { parseTimelineEvents } from "@/components/my-work/cases/workspace/utils/timeline";

const tag = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;
const FIELDS = "ball_owner,next_action_label,next_action_due_at,next_action_assignee_id,intake_payload,status,pending_for_jour_fixe";
type Row = TriageItem & { intake_payload: Json | null; status: string; pending_for_jour_fixe: boolean };

async function load(id: string): Promise<Row> {
  const { data, error } = await supabase.from("case_items").select(FIELDS).eq("id", id).single();
  if (error || !data) throw new Error(describeError(error));
  return data as unknown as Row;
}

function events(row: Row) {
  return parseTimelineEvents((row.intake_payload ?? null) as Parameters<typeof parseTimelineEvents>[0]);
}

/** Schreibt Feld-Patch + daraus abgeleitete Verlaufseinträge — derselbe Pfad wie „Schritt festlegen“ in der UI. */
async function applyBallPatch(ctx: TestContext, patch: Partial<TriageItem>, now = new Date()): Promise<{ titles: string[] }> {
  const id = ctx.data.caseItemId as string;
  const prev = await load(id);
  const ev = ballChangeEvents(prev, patch, () => null, now);
  const payload = (prev.intake_payload ?? {}) as Record<string, unknown>;
  const existing = Array.isArray(payload.timeline_events) ? payload.timeline_events : [];
  const added = ev.map((e) => ({ id: crypto.randomUUID(), type: "system", title: e.title, note: e.note, actorName: "Selbsttest", timestamp: now.toISOString() }));
  const { error } = await supabase.from("case_items")
    .update({ ...patch, intake_payload: { ...payload, timeline_events: [...existing, ...added] } as unknown as Json })
    .eq("id", id);
  if (error) throw new Error(describeError(error));
  return { titles: ev.map((e) => e.title) };
}

const wrap = (fn: (ctx: TestContext) => Promise<StepResult>) => async (ctx: TestContext): Promise<StepResult> => {
  try { return await fn(ctx); } catch (e) { return { ok: false, message: e instanceof Error ? e.message : String(e) }; }
};

const inDays = (d: number) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + d, 12).toISOString(); };

export const caseItemLifecycleScenario: TestScenario = {
  id: "case-item-lifecycle",
  title: "Vorgangs-Lifecycle (Am Zug → Schritt → Wiedervorlage → Entscheidung → Tageszettel → Abschluss)",
  description:
    "Durchläuft einen Vorgang so, wie das Büro ihn bearbeitet: Interaktionen, „Wer ist am Zug?“, Schritt festlegen, Wiedervorlage, Ministeriumsfrist, Übergabe, Entscheidung mit Abstimmung, Tageszettel-Link, Jour fixe, Ortstermin, Schritt erledigt und Abschluss. Regel-Schritte prüfen die Logik ohne Datenbank.",
  touches: ["case_items", "case_item_interactions", "case_item_handover_log", "task_decisions", "task_decision_participants", "task_decision_responses", "appointment_requests", "day_slips"],
  features: ["case-items", "decisions", "dayslip", "appointment-requests"],
  writes: [
    { table: "case_items", columns: ["subject", "summary", "user_id", "tenant_id", "status", "ball_owner", "next_action_label", "next_action_due_at", "next_action_assignee_id", "intake_payload", "pending_for_jour_fixe", "completion_note", "completed_at", "resolution_summary"] },
    { table: "case_item_interactions", columns: ["case_item_id", "tenant_id", "interaction_type", "direction", "interaction_at", "summary", "visibility", "created_by"] },
    { table: "case_item_handover_log", columns: ["case_item_id", "tenant_id", "from_user_id", "to_user_id", "handed_over_by"] },
    { table: "task_decisions", columns: ["title", "description", "status", "created_by", "tenant_id", "case_item_id"] },
    { table: "appointment_requests", columns: ["title", "tenant_id", "requested_date", "channel", "notes"] },
    { table: "day_slips", columns: ["user_id", "tenant_id", "day_key", "data"] },
  ],
  links: (ctx) => ctx.data.caseItemId ? [{ label: "Vorgang öffnen", href: `/mywork?tab=cases&caseItemId=${ctx.data.caseItemId}` }] : [],
  steps: [
    {
      id: "rules", label: "Regeln prüfen: Schritt, Wiedervorlage, Fristen (ohne Datenbank)", kind: "logic", critical: false,
      run: async () => {
        const now = new Date(2026, 10, 6, 10);
        const fails: string[] = [];
        const tomorrow = new Date(2026, 10, 7, 12).toISOString();
        if (stepState({ next_action_label: "  " }) !== "none") fails.push("leerer Schritt gilt als festgelegt");
        if (!isOnResubmission({ next_action_label: "X", next_action_due_at: tomorrow }, now)) fails.push("Frist morgen ≠ Wiedervorlage");
        if (isOnResubmission({ next_action_label: "X", next_action_due_at: new Date(2026, 10, 6, 18).toISOString() }, now)) fails.push("Frist heute bleibt auf Wiedervorlage");
        if (isOnResubmission({ next_action_label: "", next_action_due_at: tomorrow }, now)) fails.push("ohne Schritt auf Wiedervorlage");
        if (!resubmissionHint({ next_action_label: "X", next_action_due_at: tomorrow, ball_owner: "authority" }, now)?.includes("Verwaltung")) fails.push("Hinweistext fehlt");
        const auto = withAutoDeadline<Partial<TriageItem>>({ ball_owner: "office" }, { ball_owner: "ministry" }, now);
        const days = Math.round((new Date(auto.next_action_due_at!).getTime() - new Date(2026, 10, 6, 12).getTime()) / 86400000);
        if (days !== MINISTRY_RESPONSE_DAYS) fails.push(`Ministeriumsfrist ${days} statt ${MINISTRY_RESPONSE_DAYS} Tage`);
        const ev = ballChangeEvents({ ball_owner: "office" }, { ball_owner: "authority" }, () => null, now);
        if (ev[0]?.title !== "Am Zug geändert") fails.push("Wechsel am Zug nicht im Verlauf");
        return fails.length ? { ok: false, message: fails.join(" · ") } : { ok: true, message: "7 Regeln bestanden." };
      },
    },
    {
      id: "create", label: "Vorgang anlegen + Standardwerte (Büro am Zug, kein Schritt)", critical: true,
      run: wrap(async (ctx) => {
        const insert = { subject: tag(ctx.runId, "Vorgang"), summary: `${SELFTEST_MARKER} Selbsttest`, user_id: ctx.userId, tenant_id: ctx.tenantId };
        // ID clientseitig: RETURNING würde die SELECT-Policy prüfen, bevor die Zeile sichtbar ist.
        const data = { id: crypto.randomUUID() };
        const { error } = await supabase.from("case_items").insert({ ...insert, id: data.id });
        if (error) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "case_items", id: data.id });
        ctx.data.caseItemId = data.id;
        const row = await load(data.id);
        if (stepState(row) !== "none" || isOnResubmission(row)) return { ok: false, message: "Neuer Vorgang hat bereits Schritt oder Wiedervorlage." };
        return expectFields("case_items", data.id, { ...insert, status: "neu", ball_owner: "office", pending_for_jour_fixe: false }, "Anlage");
      }),
    },
    {
      id: "interactions", label: "Interaktionen erfassen (Anruf, Mail, Treffen)",
      run: wrap(async (ctx) => {
        for (const t of ["phone", "email", "in_person"] as const) {
          const payload = { case_item_id: ctx.data.caseItemId as string, tenant_id: ctx.tenantId, interaction_type: t, direction: "in" as const, interaction_at: new Date().toISOString(), summary: `${SELFTEST_MARKER} ${t}`, visibility: "internal" as const, created_by: ctx.userId };
          const { data, error } = await supabase.from("case_item_interactions").insert(payload).select("id").single();
          if (error || !data) return { ok: false, message: `${t}: ${describeError(error)}` };
          ctx.created.push({ table: "case_item_interactions", id: data.id });
        }
        return { ok: true, message: "3 Interaktionen gespeichert." };
      }),
    },
    {
      id: "draft-no-resubmission", label: "Am Zug nur vorbereiten → keine Wiedervorlage", kind: "logic",
      run: wrap(async (ctx) => {
        // In der UI ist das ein lokaler Entwurf; gespeichert wird erst bei „Schritt festlegen“.
        const row = await load(ctx.data.caseItemId as string);
        const draft = withAutoDeadline(row, { ball_owner: "authority" });
        if (isOnResubmission(row)) return { ok: false, message: "Gespeicherter Stand ist bereits auf Wiedervorlage." };
        if (stepState({ ...row, ...draft }) === "set" && !row.next_action_label) {
          return { ok: true, message: "Entwurf enthält Vorschlag, gespeicherter Vorgang bleibt ohne Wiedervorlage." };
        }
        return { ok: true, message: "Gespeicherter Vorgang bleibt ohne Wiedervorlage." };
      }),
    },
    {
      id: "set-step", label: "Schritt festlegen mit Frist → Wiedervorlage + Verlauf",
      run: wrap(async (ctx) => {
        const { titles } = await applyBallPatch(ctx, { next_action_label: "Rückruf Bürger", next_action_due_at: inDays(7), next_action_assignee_id: ctx.userId });
        const row = await load(ctx.data.caseItemId as string);
        const miss = ["Schritt festgelegt", "Auf Wiedervorlage gelegt"].filter((t) => !titles.includes(t) || !events(row).some((e) => e.title === t));
        if (!isOnResubmission(row)) return { ok: false, message: "Vorgang liegt nicht auf Wiedervorlage." };
        return miss.length ? { ok: false, message: `Verlauf fehlt: ${miss.join(", ")}` } : { ok: true, message: "Wiedervorlage aktiv, 2 Verlaufseinträge." };
      }),
    },
    {
      id: "ministry", label: "Am Zug: Ministerium (21-Tage-Frist + Verlauf)",
      run: wrap(async (ctx) => {
        await applyBallPatch(ctx, { ball_owner: "ministry" });
        const row = await load(ctx.data.caseItemId as string);
        if (row.ball_owner !== "ministry") return { ok: false, message: `ball_owner = ${row.ball_owner}` };
        if (!events(row).some((e) => e.title === "Am Zug geändert")) return { ok: false, message: "Kein Verlaufseintrag „Am Zug geändert“." };
        const auto = withAutoDeadline<Partial<TriageItem>>({ ball_owner: "office" }, { ball_owner: "ministry" });
        const days = Math.round((new Date(auto.next_action_due_at!).getTime() - new Date(inDays(0)).getTime()) / 86400000);
        return days === MINISTRY_RESPONSE_DAYS ? { ok: true, message: "Ministerium am Zug, Frist 21 Tage, Verlauf geschrieben." } : { ok: false, message: `Frist ${days} Tage` };
      }),
    },
    {
      id: "handover", label: "Übergabe/Vertretung protokollieren", critical: false,
      run: wrap(async (ctx) => {
        const payload = { case_item_id: ctx.data.caseItemId as string, tenant_id: ctx.tenantId, from_user_id: ctx.userId, to_user_id: ctx.userId, handed_over_by: ctx.userId };
        const { data, error } = await supabase.from("case_item_handover_log").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: `${describeError(error)} (nur Abgeordnete/Büroleitung dürfen übergeben)` };
        ctx.created.push({ table: "case_item_handover_log", id: data.id });
        return expectFields("case_item_handover_log", data.id, payload, "Übergabe");
      }),
    },
    {
      id: "decision", label: "Entscheidung anfordern + abstimmen",
      run: wrap(async (ctx) => {
        const d = { title: tag(ctx.runId, "Vorgang-Entscheidung"), description: SELFTEST_MARKER, status: "active", created_by: ctx.userId, tenant_id: ctx.tenantId, case_item_id: ctx.data.caseItemId as string, visible_to_all: false };
        const { data, error } = await supabase.from("task_decisions").insert(d).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "task_decisions", id: data.id });
        const { data: p, error: pe } = await supabase.from("task_decision_participants").insert({ decision_id: data.id, user_id: ctx.userId }).select("id").single();
        if (pe || !p) return { ok: false, message: `Teilnehmer: ${describeError(pe)}` };
        ctx.created.push({ table: "task_decision_participants", id: p.id });
        const { data: r, error: re } = await supabase.from("task_decision_responses").insert({ decision_id: data.id, participant_id: p.id, response_type: "yes", comment: SELFTEST_MARKER }).select("id").single();
        if (re || !r) return { ok: false, message: `Stimme: ${describeError(re)}` };
        ctx.created.push({ table: "task_decision_responses", id: r.id });
        const { data: linked } = await supabase.from("task_decisions").select("id").eq("case_item_id", ctx.data.caseItemId as string);
        return linked?.length ? { ok: true, message: "Entscheidung verknüpft, Stimme abgegeben." } : { ok: false, message: "Entscheidung am Vorgang nicht auffindbar." };
      }),
    },
    {
      id: "dayslip", label: "Auf Tageszettel → Link übersteht erneutes Laden",
      run: wrap(async (ctx) => {
        const dayKey = "2099-12-30";
        const day = appendEntries({ html: "", plainText: "" }, [{ id: crypto.randomUUID(), text: "Rückruf Bürger", source: { type: "case", id: ctx.data.caseItemId as string } }]);
        await supabase.from("day_slips").delete().eq("user_id", ctx.userId).eq("day_key", dayKey);
        const { data, error } = await supabase.from("day_slips").insert({ user_id: ctx.userId, tenant_id: ctx.tenantId, day_key: dayKey, data: day as unknown as Json }).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "day_slips", id: data.id });
        const { data: back } = await supabase.from("day_slips").select("data").eq("id", data.id).single();
        const store = normalizeStore({ [dayKey]: back?.data });
        const links = Object.values(store[dayKey]?.sources ?? {});
        return links.some((s) => s.type === "case" && s.id === ctx.data.caseItemId)
          ? { ok: true, message: "Link zum Vorgang nach Neuladen vorhanden." }
          : { ok: false, message: "Link nach Neuladen verloren." };
      }),
    },
    {
      id: "jour-fixe", label: "Auf Jour fixe setzen",
      run: wrap(async (ctx) => {
        const id = ctx.data.caseItemId as string;
        const { error } = await supabase.from("case_items").update({ pending_for_jour_fixe: true }).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("case_items", id, { pending_for_jour_fixe: true }, "Jour fixe");
      }),
    },
    {
      id: "onsite", label: "Ortstermin anfragen (Eingang per: Vorgang)",
      run: wrap(async (ctx) => {
        const payload = { title: tag(ctx.runId, "Ortstermin"), tenant_id: ctx.tenantId, requested_date: inDays(10).slice(0, 10), channel: "case", notes: SELFTEST_MARKER };
        const { data, error } = await supabase.from("appointment_requests").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "appointment_requests", id: data.id });
        return expectFields("appointment_requests", data.id, { channel: "case", status: "pending" }, "Ortstermin");
      }),
    },
    {
      id: "step-done", label: "Schritt erledigt → Schritt leer, „Schritt festlegen“ erscheint wieder",
      run: wrap(async (ctx) => {
        const id = ctx.data.caseItemId as string;
        const prev = await load(id);
        const payload = (prev.intake_payload ?? {}) as Record<string, unknown>;
        const existing = Array.isArray(payload.timeline_events) ? payload.timeline_events : [];
        const done = { id: crypto.randomUUID(), type: "system", title: "Schritt erledigt", note: prev.next_action_label, actorName: "Selbsttest", timestamp: new Date().toISOString() };
        const { error } = await supabase.from("case_items").update({ next_action_label: null, next_action_due_at: null, intake_payload: { ...payload, timeline_events: [...existing, done] } as unknown as Json }).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        const row = await load(id);
        if (stepState(row) !== "none" || isOnResubmission(row)) return { ok: false, message: "Schritt nicht geleert oder noch auf Wiedervorlage." };
        return events(row).some((e) => e.title === "Schritt erledigt") ? { ok: true, message: "Schritt erledigt und im Verlauf." } : { ok: false, message: "Verlaufseintrag fehlt." };
      }),
    },
    {
      id: "complete", label: "Vorgang abschließen",
      run: wrap(async (ctx) => {
        const id = ctx.data.caseItemId as string;
        const update = { status: "erledigt" as const, completion_note: `${SELFTEST_MARKER} erledigt`, completed_at: new Date().toISOString(), resolution_summary: `${SELFTEST_MARKER} Lösung` };
        const { error } = await supabase.from("case_items").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("case_items", id, update, "Abschluss");
      }),
    },
  ],
};
