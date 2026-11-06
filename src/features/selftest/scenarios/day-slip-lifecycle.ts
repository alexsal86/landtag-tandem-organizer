import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { TestScenario } from "../types";
import { describeError } from "../verify";
import { appendEntries, carryLines, collectCarryLines, normalizeStore, sourcePath } from "@/components/dayslip/daySlipState";
import type { DaySlipSource, DaySlipStore } from "@/components/dayslip/dayslipTypes";

const DAY1 = "2099-12-28";
const DAY2 = "2099-12-29";

export const daySlipLifecycleScenario: TestScenario = {
  id: "day-slip-lifecycle",
  title: "Tageszettel-Lifecycle (Links → Neuladen → Übernahme auf Folgetag)",
  description: "Schreibt einen Tageszettel mit verlinkten Zeilen (Notiz, Aufgabe, Vorgang, Entscheidung), lädt ihn neu, prüft die Sprungziele und überträgt offene Zeilen auf den Folgetag, ohne Links zu verlieren.",
  touches: ["day_slips"],
  features: ["dayslip"],
  writes: [{ table: "day_slips", columns: ["user_id", "tenant_id", "day_key", "data"] }],
  steps: [
    {
      id: "write", label: "Tageszettel mit 4 verlinkten Zeilen speichern", critical: true,
      run: async (ctx) => {
        const sources: DaySlipSource[] = (["note", "task", "case", "decision"] as const).map((type) => ({ type, id: crypto.randomUUID() }));
        ctx.data.sources = sources;
        const day = appendEntries({ html: "", plainText: "" }, sources.map((s) => ({ id: crypto.randomUUID(), text: `Zeile ${s.type}`, source: s })));
        await supabase.from("day_slips").delete().eq("user_id", ctx.userId).in("day_key", [DAY1, DAY2]);
        const { data, error } = await supabase.from("day_slips").insert({ user_id: ctx.userId, tenant_id: ctx.tenantId, day_key: DAY1, data: day as unknown as Json }).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "day_slips", id: data.id });
        return { ok: true, message: "Gespeichert." };
      },
    },
    {
      id: "reload", label: "Neuladen: alle Links + Sprungziele vorhanden",
      run: async (ctx) => {
        const { data } = await supabase.from("day_slips").select("data").eq("user_id", ctx.userId).eq("day_key", DAY1).single();
        const store = normalizeStore({ [DAY1]: data?.data });
        ctx.data.store = store;
        const kept = Object.values(store[DAY1]?.sources ?? {});
        const want = ctx.data.sources as DaySlipSource[];
        const missing = want.filter((w) => !kept.some((k) => k.type === w.type && k.id === w.id));
        if (missing.length) return { ok: false, message: `Verloren: ${missing.map((m) => m.type).join(", ")}` };
        const noPath = kept.filter((k) => !sourcePath(k));
        return noPath.length ? { ok: false, message: "Sprungziel fehlt." } : { ok: true, message: "4 Links mit Sprungziel." };
      },
    },
    {
      id: "carry", label: "Offene Zeilen auf Folgetag übernehmen (Links bleiben)",
      run: async (ctx) => {
        const store = ctx.data.store as DaySlipStore;
        const lines = collectCarryLines(store, DAY2);
        const next = carryLines(store, DAY2, lines);
        const { data, error } = await supabase.from("day_slips").insert({ user_id: ctx.userId, tenant_id: ctx.tenantId, day_key: DAY2, data: next[DAY2] as unknown as Json }).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "day_slips", id: data.id });
        const { data: back } = await supabase.from("day_slips").select("data").eq("id", data.id).single();
        const kept = Object.values(normalizeStore({ [DAY2]: back?.data })[DAY2]?.sources ?? {});
        return kept.length === 4 ? { ok: true, message: `${lines.length} Zeilen übernommen, 4 Links erhalten.` } : { ok: false, message: `Nur ${kept.length}/4 Links am Folgetag.` };
      },
    },
  ],
};
