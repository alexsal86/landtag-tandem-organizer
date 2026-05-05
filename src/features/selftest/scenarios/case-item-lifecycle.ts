import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const tag = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

export const caseItemLifecycleScenario: TestScenario = {
  id: "case-item-lifecycle",
  title: "Vorgangs-Lifecycle (neu → in Klärung → Antwort ausstehend → erledigt)",
  description:
    "Erstellt einen Vorgang (mit reduzierten Pflichtfeldern, Defaults bleiben aktiv), loggt eine Interaktion, durchläuft alle Status, hängt eine Entscheidung an, schließt den Vorgang regelkonform ab und liest jedes geschriebene Feld zurück.",
  touches: ["case_items", "case_item_interactions", "task_decisions"],
  features: ["case-items", "decisions"],
  writes: [
    {
      table: "case_items",
      columns: [
        "subject", "summary", "user_id", "tenant_id", "status", "priority",
        "source_channel", "follow_up_at", "completion_note", "completed_at",
        "resolution_summary",
      ],
    },
    {
      table: "case_item_interactions",
      columns: [
        "case_item_id", "tenant_id", "interaction_type", "direction",
        "interaction_at", "summary", "details", "visibility", "created_by",
      ],
    },
    { table: "task_decisions", columns: ["title", "description", "status", "created_by", "tenant_id", "case_item_id"] },
  ],
  steps: [
    {
      id: "create",
      label: "Vorgang anlegen (Pflichtfelder + Defaults)",
      run: async (ctx) => {
        // Bewusst nur Pflichtfelder. Alle Booleans/Status/Priority kommen aus DB-Defaults.
        const insertPayload = {
          subject: tag(ctx.runId, "Vorgang"),
          summary: `${SELFTEST_MARKER} Selbsttest-Beschreibung`,
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
        };
        const { data, error } = await supabase
          .from("case_items")
          .insert(insertPayload)
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "case_items", id: data.id });
        ctx.data.caseItemId = data.id;

        // Re-Read: stellt sicher, dass alle Felder samt Defaults korrekt persistiert wurden.
        return expectFields("case_items", data.id, {
          subject: insertPayload.subject,
          summary: insertPayload.summary,
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          status: "neu",
          priority: "medium",
          source_channel: "other",
          contains_personal_data: false,
          is_legal_relevant: false,
          is_political_relevant: false,
          pending_for_jour_fixe: false,
          visible_to_all: false,
        }, "Anlage");
      },
    },
    {
      id: "log-interaction",
      label: "Interaktion loggen + Felder verifizieren",
      run: async (ctx) => {
        const payload = {
          case_item_id: ctx.data.caseItemId as string,
          tenant_id: ctx.tenantId,
          interaction_type: "email" as const,
          direction: "in" as const,
          interaction_at: new Date().toISOString(),
          summary: `${SELFTEST_MARKER} Eingehende E-Mail`,
          details: `${SELFTEST_MARKER} Details`,
          visibility: "internal" as const,
          created_by: ctx.userId,
        };
        const { data, error } = await supabase
          .from("case_item_interactions")
          .insert(payload)
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "case_item_interactions", id: data.id });
        return expectFields("case_item_interactions", data.id, payload, "Interaktion");
      },
    },
    {
      id: "status-in-klaerung",
      label: "Status: in_klaerung",
      run: async (ctx) => {
        const id = ctx.data.caseItemId as string;
        const { error } = await supabase.from("case_items").update({ status: "in_klaerung" }).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("case_items", id, { status: "in_klaerung" }, "in_klaerung");
      },
    },
    {
      id: "status-antwort-ausstehend",
      label: "Status: antwort_ausstehend + Wiedervorlage",
      run: async (ctx) => {
        const id = ctx.data.caseItemId as string;
        const followUp = new Date();
        followUp.setDate(followUp.getDate() + 1);
        const followUpIso = followUp.toISOString();
        const { error } = await supabase
          .from("case_items")
          .update({ status: "antwort_ausstehend", follow_up_at: followUpIso })
          .eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("case_items", id, {
          status: "antwort_ausstehend",
          follow_up_at: followUpIso,
        }, "Wiedervorlage");
      },
    },
    {
      id: "attach-decision",
      label: "Entscheidung an Vorgang hängen",
      critical: false,
      run: async (ctx) => {
        const payload = {
          title: tag(ctx.runId, "Vorgang-Entscheidung"),
          description: SELFTEST_MARKER,
          status: "active" as const,
          created_by: ctx.userId,
          tenant_id: ctx.tenantId,
          case_item_id: ctx.data.caseItemId as string,
          visible_to_all: false,
        };
        const { data, error } = await supabase
          .from("task_decisions")
          .insert(payload)
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "task_decisions", id: data.id });
        return expectFields("task_decisions", data.id, payload, "Entscheidung");
      },
    },
    {
      id: "complete",
      label: "Vorgang erledigen (mit completion_note + completed_at)",
      run: async (ctx) => {
        const id = ctx.data.caseItemId as string;
        const completedAt = new Date().toISOString();
        const update = {
          status: "erledigt" as const,
          completion_note: `${SELFTEST_MARKER} erledigt`,
          completed_at: completedAt,
          resolution_summary: `${SELFTEST_MARKER} Lösung dokumentiert`,
        };
        const { error } = await supabase.from("case_items").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("case_items", id, update, "Abschluss");
      },
    },
  ],
};
