import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const title = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

const isoDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

export const dailyBriefingLifecycleScenario: TestScenario = {
  id: "daily-briefing-lifecycle",
  title: "Tages-Briefings (heute + gestern)",
  description:
    "Legt zwei daily_briefings an (heute und gestern), damit das Briefing-Widget inkl. Vortag-Regel sichtbar wird. Verifiziert alle Felder zurück.",
  touches: ["daily_briefings"],
  features: ["briefings"],
  writes: [
    {
      table: "daily_briefings",
      columns: ["tenant_id", "author_id", "briefing_date", "title", "content"],
    },
  ],
  links: () => [
    { label: "Dashboard öffnen (Briefing-Widget)", href: "/" },
  ],
  steps: [
    {
      id: "create-yesterday",
      label: "Briefing für gestern anlegen",
      run: async (ctx) => {
        const payload = {
          tenant_id: ctx.tenantId,
          author_id: ctx.userId,
          briefing_date: isoDate(-1),
          title: title(ctx.runId, "Briefing gestern"),
          content: `${SELFTEST_MARKER}\n\nGestern-Highlights: Ortsbesuch, Pressetermin, Bürgergespräche.`,
        };
        const { data, error } = await supabase.from("daily_briefings").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "daily_briefings", id: data.id });
        return expectFields("daily_briefings", data.id, payload, "Briefing gestern");
      },
    },
    {
      id: "create-today",
      label: "Briefing für heute anlegen",
      run: async (ctx) => {
        const payload = {
          tenant_id: ctx.tenantId,
          author_id: ctx.userId,
          briefing_date: isoDate(0),
          title: title(ctx.runId, "Briefing heute"),
          content: `${SELFTEST_MARKER}\n\nHeute: Ausschuss-Sitzung 10 Uhr, Mittagstermin mit Verband, Abendveranstaltung.`,
        };
        const { data, error } = await supabase.from("daily_briefings").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "daily_briefings", id: data.id });
        return expectFields("daily_briefings", data.id, payload, "Briefing heute");
      },
    },
    {
      id: "verify-list",
      label: "Beide Briefings für Tenant lesbar",
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("daily_briefings")
          .select("id, briefing_date, title")
          .eq("tenant_id", ctx.tenantId)
          .ilike("title", `${SELFTEST_PREFIX}%${ctx.runId}%`);
        if (error) return { ok: false, message: describeError(error) };
        const found = data?.length ?? 0;
        return {
          ok: found === 2,
          message: found === 2 ? "Beide Briefings sichtbar." : `Nur ${found}/2 sichtbar.`,
          details: data,
        };
      },
    },
  ],
};
