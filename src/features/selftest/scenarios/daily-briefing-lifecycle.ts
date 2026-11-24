import { dailyBriefingReadDayLabel, canReadDailyBriefing, dailyBriefingTargetLabel, isReadBriefingCollapsed, dailyBriefingReadLabel, briefingDateOptions } from "@/features/briefings/utils";
import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const title = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

const isoDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const dailyBriefingLifecycleScenario: TestScenario = {
  id: "daily-briefing-lifecycle",
  title: "Tages-Briefings (Vortag-Regel)",
  description:
    "Prüft, dass Briefings für heute abgelehnt werden, und legt zwei Briefings für morgen und übermorgen an, damit das Briefing-Widget inkl. Vortag-Regel sichtbar wird. Verifiziert alle Felder zurück.",
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
      id: 'relative-read-day', label: 'Lesebestätigung unterscheidet heute und gestern in Berlin', kind: 'logic',
      run: async () => ({
        ok: dailyBriefingReadDayLabel('2026-11-24T11:51:00Z', new Date('2026-11-24T12:00:00Z')) === 'Heute gelesen 12:51'
          && dailyBriefingReadDayLabel('2026-11-24T11:51:00Z', new Date('2026-11-25T09:00:00Z')) === 'Gestern gelesen 12:51'
          && dailyBriefingReadDayLabel('2026-11-23T23:30:00Z', new Date('2026-11-24T09:00:00Z')) === 'Heute gelesen 00:30'
          && dailyBriefingReadDayLabel('2026-11-22T11:51:00Z', new Date('2026-11-25T09:00:00Z')) === 'Am 22.11.2026 gelesen 12:51',
        message: 'Der Lesetag richtet sich nach Europe/Berlin und wechselt am nächsten Tag von heute zu gestern.',
      }),
    },
    {
      id: 'read-ahead', label: 'Vorliegende Tagesbriefings vorab lesen', kind: 'logic',
      run: async () => ({
        ok: canReadDailyBriefing('2026-11-25', '2026-11-24T12:00:00Z', '2026-11-24')
          && canReadDailyBriefing('2026-11-24', '2026-11-23T12:00:00Z', '2026-11-24')
          && !canReadDailyBriefing('2026-11-24', '2026-11-23T23:30:00Z', '2026-11-24')
          && !canReadDailyBriefing('2026-11-23', '2026-11-22T12:00:00Z', '2026-11-24')
          && dailyBriefingTargetLabel('2026-11-25', new Date('2026-11-24T12:00:00Z')) === 'für morgen',
        message: 'Gespeicherte zukünftige Briefings sind lesbar, ohne sie als heutiges Briefing auszugeben; die Berliner Vortag-Regel beim Erstellen bleibt erhalten.',
      }),
    },
    {
      id: 'collapse-read-briefing', label: 'Nur gelesene Tagesbriefings einklappen', kind: 'logic',
      run: async () => ({
        ok: isReadBriefingCollapsed(true, true) && !isReadBriefingCollapsed(false, true)
          && !isReadBriefingCollapsed(true, false),
        message: 'Gelesene Briefings lassen sich einklappen und wieder öffnen; ungelesene bleiben sichtbar.',
      }),
    },
    {
      id: 'read-receipt-time', label: 'Lesezeitpunkt als Berliner Uhrzeit anzeigen', kind: 'logic',
      run: async () => ({
        ok: dailyBriefingReadLabel('2026-11-24T11:51:00Z') === 'Gelesen 12:51'
          && dailyBriefingReadLabel('2026-07-24T10:51:00Z') === 'Gelesen 12:51'
          && dailyBriefingReadLabel(null) === 'Gelesen',
        message: 'Der Chip nutzt den gespeicherten Zeitpunkt und berücksichtigt Sommer- und Winterzeit.',
      }),
    },
    {
      id: "date-chips", label: "Morgen und übermorgen sind Berliner Kalendertage", kind: "logic",
      run: async () => {
        const friday = briefingDateOptions(new Date('2026-11-20T12:00:00Z'));
        const midnight = briefingDateOptions(new Date('2026-12-31T23:30:00Z'));
        const dst = briefingDateOptions(new Date('2026-03-28T12:00:00Z'));
        const ok = friday.tomorrow === '2026-11-21' && friday.dayAfter === '2026-11-22'
          && midnight.tomorrow === '2027-01-02' && midnight.dayAfter === '2027-01-03'
          && dst.tomorrow === '2026-03-29' && dst.dayAfter === '2026-03-30';
        return { ok, message: 'Datum-Chips berücksichtigen Wochenenden, Jahreswechsel und Sommerzeit.' };
      },
    },
    {
      id: "reject-today",
      label: "Vortag-Regel: Briefing für heute wird abgelehnt",
      run: async (ctx) => {
        const { error } = await supabase.from("daily_briefings").insert({
          tenant_id: ctx.tenantId, author_id: ctx.userId, briefing_date: isoDate(0),
          title: title(ctx.runId, "Briefing heute (muss scheitern)"), content: SELFTEST_MARKER,
        });
        if (!error) {
          const { data } = await supabase.from("daily_briefings").select("id").eq("tenant_id", ctx.tenantId).ilike("title", `%heute (muss scheitern) (${ctx.runId})%`);
          data?.forEach((r) => ctx.trackRecord({ table: "daily_briefings", id: r.id }));
          return { ok: false, message: "Briefing für heute wurde gespeichert — Vortag-Regel greift nicht." };
        }
        return { ok: true, message: "Abgelehnt wie erwartet." };
      },
    },
    {
      id: "create-yesterday",
      label: "Briefing für morgen anlegen",
      run: async (ctx) => {
        const payload = {
          tenant_id: ctx.tenantId,
          author_id: ctx.userId,
          briefing_date: isoDate(1),
          title: title(ctx.runId, "Briefing morgen"),
          content: `${SELFTEST_MARKER}\n\nGestern-Highlights: Ortsbesuch, Pressetermin, Bürgergespräche.`,
        };
        const { data, error } = await supabase.from("daily_briefings").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "daily_briefings", id: data.id });
        return expectFields("daily_briefings", data.id, payload, "Briefing morgen");
      },
    },
    {
      id: "create-today",
      label: "Briefing für übermorgen anlegen",
      run: async (ctx) => {
        const payload = {
          tenant_id: ctx.tenantId,
          author_id: ctx.userId,
          briefing_date: isoDate(2),
          title: title(ctx.runId, "Briefing übermorgen"),
          content: `${SELFTEST_MARKER}\n\nHeute: Ausschuss-Sitzung 10 Uhr, Mittagstermin mit Verband, Abendveranstaltung.`,
        };
        const { data, error } = await supabase.from("daily_briefings").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "daily_briefings", id: data.id });
        return expectFields("daily_briefings", data.id, payload, "Briefing übermorgen");
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
