import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";

const tag = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

export const caseItemLifecycleScenario: TestScenario = {
  id: "case-item-lifecycle",
  title: "Vorgangs-Lifecycle (neu → in Klärung → Antwort ausstehend → erledigt)",
  description:
    "Erstellt einen Vorgang, loggt eine Interaktion, durchläuft die Status-Stufen, hängt eine Entscheidung an und schließt den Vorgang regelkonform ab (mit completion_note + completed_at).",
  touches: ["case_items", "case_item_interactions", "task_decisions"],
  features: ["case-items", "decisions"],
  steps: [
    {
      id: "create",
      label: "Vorgang anlegen (Status: neu)",
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("case_items")
          .insert({
            subject: tag(ctx.runId, "Vorgang"),
            summary: `${SELFTEST_MARKER} Selbsttest-Beschreibung`,
            source_channel: "email",
            status: "neu",
            priority: "medium",
            user_id: ctx.userId,
            tenant_id: ctx.tenantId,
            contains_personal_data: false,
            is_legal_relevant: false,
            is_political_relevant: false,
            pending_for_jour_fixe: false,
            visible_to_all: false,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert leer" };
        ctx.created.push({ table: "case_items", id: data.id });
        ctx.data.caseItemId = data.id;
        return { ok: true, message: `Vorgang ${data.id} angelegt.` };
      },
    },
    {
      id: "log-interaction",
      label: "Interaktion loggen",
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("case_item_interactions")
          .insert({
            case_item_id: ctx.data.caseItemId as string,
            tenant_id: ctx.tenantId,
            interaction_type: "email",
            direction: "in",
            interaction_at: new Date().toISOString(),
            summary: `${SELFTEST_MARKER} Eingehende E-Mail`,
            details: `${SELFTEST_MARKER} Details`,
            visibility: "internal",
            created_by: ctx.userId,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert leer" };
        ctx.created.push({ table: "case_item_interactions", id: data.id });
        return { ok: true, message: "Interaktion geloggt." };
      },
    },
    {
      id: "status-in-klaerung",
      label: "Status auf 'in_klaerung' setzen",
      run: async (ctx) => {
        const { error } = await supabase
          .from("case_items")
          .update({ status: "in_klaerung" })
          .eq("id", ctx.data.caseItemId as string);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "Status: in_klaerung" };
      },
    },
    {
      id: "status-antwort-ausstehend",
      label: "Status auf 'antwort_ausstehend' + Wiedervorlage",
      run: async (ctx) => {
        const followUp = new Date();
        followUp.setDate(followUp.getDate() + 1);
        const { error } = await supabase
          .from("case_items")
          .update({
            status: "antwort_ausstehend",
            follow_up_at: followUp.toISOString(),
          })
          .eq("id", ctx.data.caseItemId as string);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "Status: antwort_ausstehend." };
      },
    },
    {
      id: "attach-decision",
      label: "Entscheidung an Vorgang hängen",
      critical: false,
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("task_decisions")
          .insert({
            title: tag(ctx.runId, "Vorgang-Entscheidung"),
            description: `${SELFTEST_MARKER}`,
            status: "active",
            created_by: ctx.userId,
            tenant_id: ctx.tenantId,
            case_item_id: ctx.data.caseItemId as string,
            visible_to_all: false,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert leer" };
        ctx.created.push({ table: "task_decisions", id: data.id });
        return { ok: true, message: "Entscheidung verknüpft." };
      },
    },
    {
      id: "complete",
      label: "Vorgang abschließen (Status: erledigt)",
      run: async (ctx) => {
        const { error } = await supabase
          .from("case_items")
          .update({
            status: "erledigt",
            completion_note: `${SELFTEST_MARKER} erledigt`,
            completed_at: new Date().toISOString(),
            resolution_summary: `${SELFTEST_MARKER} Lösung dokumentiert`,
          })
          .eq("id", ctx.data.caseItemId as string);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "Vorgang erledigt." };
      },
    },
    {
      id: "verify",
      label: "Verifikation",
      run: async (ctx) => {
        const id = ctx.data.caseItemId as string;
        const [item, ints] = await Promise.all([
          supabase.from("case_items").select("status, completion_note, completed_at").eq("id", id).single(),
          supabase.from("case_item_interactions").select("id").eq("case_item_id", id),
        ]);
        if (item.error) return { ok: false, message: item.error.message };
        const ok =
          item.data?.status === "erledigt" &&
          !!item.data?.completion_note &&
          !!item.data?.completed_at &&
          (ints.data?.length ?? 0) >= 1;
        return {
          ok,
          message: ok ? "Vorgang vollständig." : "Verifikation fehlgeschlagen.",
          details: { status: item.data?.status, interactions: ints.data?.length ?? 0 },
        };
      },
    },
  ],
};
