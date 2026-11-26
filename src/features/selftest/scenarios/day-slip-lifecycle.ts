import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { TestScenario } from "../types";
import { describeError } from "../verify";
import { appendEntries, carryLines, collectCarryLines, normalizeStore, removeLineFromDay, restoreLineToDay, sourcePath } from "@/components/dayslip/daySlipState";
import { openLineCount, openPastDays, resolveDayView, shiftDayKey, snoozePresets } from "@/components/dayslip/daySlipNavigation";
import { parseDaySlipLine } from "@/components/dayslip/daySlipShorthand";
import { archiveNeighbours, buildArchiveEntry, matchesArchiveQuery } from "@/components/dayslip/daySlipArchive";
import type { DaySlipDayData, DaySlipSource, DaySlipStore } from "@/components/dayslip/dayslipTypes";
import { extractLinesFromHtml, toDayKey, toParagraphHtml, toRuleHtml } from "@/components/dayslip/dayslipTypes";
import { testDay } from "../fixtures";

export const daySlipLifecycleScenario: TestScenario = {
  id: "day-slip-lifecycle",
  title: "Tageszettel-Lifecycle (Links → Neuladen → Übernahme auf Folgetag)",
  description: "Schreibt einen Tageszettel mit verlinkten Zeilen (Notiz, Aufgabe, Vorgang, Entscheidung), lädt ihn neu, prüft die Sprungziele und überträgt offene Zeilen auf den Folgetag, ohne Links zu verlieren.",
  touches: ["day_slips"],
  features: ["dayslip"],
  checks: ["Speichern und erneutes Laden", "Link-Erhalt bei Übernahme", "Keine doppelte Übernahme", "Vortage ohne Abschluss bleiben lesbar", "Snooze-Vorschläge ohne doppeltes Ziel", "Löschen mit Rückgängig", "Getippte Kürzel ohne Automatik", "Archiv: erledigt/zugewiesen/offen, Suche, Datumsnachbarn"],
  limitations: [
    "Die verlinkten Ziele sind Test-IDs; ihre Bedienung wird nicht geprüft.",
    "Kürzel belegen die Zuordnung nur vor; erstellt wird erst mit dem Abschluss, und Mehrdeutiges bleibt Text.",
    "Vortage werden nur gelesen; abgeschlossen werden kann weiterhin ausschließlich der aktuelle Tag.",
  ],
  writes: [{ table: "day_slips", columns: ["user_id", "tenant_id", "day_key", "data"] }],
  steps: [
    {
      id: "write", label: "Tageszettel mit 4 verlinkten Zeilen speichern", critical: true,
      run: async (ctx) => {
        const DAY1 = testDay(ctx.runId);
        const sources: DaySlipSource[] = (["note", "task", "case", "decision"] as const).map((type) => ({ type, id: crypto.randomUUID() }));
        ctx.data.sources = sources;
        const day = appendEntries({ html: "", plainText: "" }, sources.map((s) => ({ id: crypto.randomUUID(), text: `Zeile ${s.type}`, source: s })));
        const { data, error } = await supabase.from("day_slips").insert({ user_id: ctx.userId, tenant_id: ctx.tenantId, day_key: DAY1, data: day as unknown as Json }).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "day_slips", id: data.id });
        return { ok: true, message: "Gespeichert." };
      },
    },
    {
      id: "reload", label: "Neuladen: alle Links + Sprungziele vorhanden",
      run: async (ctx) => {
        const DAY1 = testDay(ctx.runId);
        const { data, error } = await supabase.from("day_slips").select("data").eq("id", ctx.created.find(r => r.table === "day_slips")!.id).single();
        if (error) return { ok: false, message: describeError(error) };
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
        const DAY2 = testDay(ctx.runId, 1);
        const store = ctx.data.store as DaySlipStore;
        const lines = collectCarryLines(store, DAY2);
        const next = carryLines(store, DAY2, lines);
        ctx.data.carriedStore = next;
        const { data, error } = await supabase.from("day_slips").insert({ user_id: ctx.userId, tenant_id: ctx.tenantId, day_key: DAY2, data: next[DAY2] as unknown as Json }).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "day_slips", id: data.id });
        const { data: back } = await supabase.from("day_slips").select("data").eq("id", data.id).single();
        const kept = Object.values(normalizeStore({ [DAY2]: back?.data })[DAY2]?.sources ?? {});
        return kept.length === 4 ? { ok: true, message: `${lines.length} Zeilen übernommen, 4 Links erhalten.` } : { ok: false, message: `Nur ${kept.length}/4 Links am Folgetag.` };
      },
    },
    {
      id: "no-duplicate-carry", label: "Erneute Übernahme erzeugt keine doppelten Zeilen", kind: "logic",
      run: async (ctx) => {
        const lines = collectCarryLines(ctx.data.carriedStore as DaySlipStore, testDay(ctx.runId, 1));
        return { ok: lines.length === 0, message: `${lines.length} bereits übernommene Zeilen erneut angeboten.`, details: { expected: 0, actual: lines.length } };
      },
    },
    {
      id: "navigation-rules", label: "Vortage lesbar, Zukunft gesperrt", kind: "logic",
      run: async () => {
        const today = toDayKey(new Date());
        const openDay = shiftDayKey(today, -2);
        const completedDay = shiftDayKey(today, -5);
        const store: DaySlipStore = {
          [openDay]: { html: toParagraphHtml({ id: "open", text: "Noch offen" }), plainText: "Noch offen" },
          [completedDay]: { html: toParagraphHtml({ id: "done", text: "Abgeschlossen" }), plainText: "Abgeschlossen", completedAt: `${completedDay}T17:00:00.000Z` },
        };
        const todayView = resolveDayView(store, today);
        const pastView = resolveDayView(store, today, openDay);
        const futureView = resolveDayView(store, today, shiftDayKey(today, 1));
        const checks = {
          heuteBearbeitbar: todayView.isToday && !todayView.readOnly && !todayView.canGoNext,
          vortagSchreibgeschuetzt: pastView.isPast && pastView.readOnly && pastView.completedAt === undefined,
          rueckwegZuHeute: pastView.nextKey === today && pastView.canGoNext,
          fruehererTagErreichbar: pastView.previousKey === completedDay && pastView.canGoPrevious,
          zukunftGesperrt: futureView.key === today && !futureView.isPast,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return failed.length
          ? { ok: false, message: `Regeln verletzt: ${failed.join(", ")}`, details: checks }
          : { ok: true, message: "Vortage lesbar, Rückweg zu heute frei, Zukunft gesperrt.", details: checks };
      },
    },
    {
      id: "open-past-days", label: "Offene Vortage werden aufgelistet", kind: "logic",
      run: async () => {
        const today = toDayKey(new Date());
        const open = shiftDayKey(today, -1);
        const completed = shiftDayKey(today, -2);
        const store: DaySlipStore = {
          [open]: { html: toParagraphHtml({ id: "a", text: "Offen" }), plainText: "Offen" },
          [completed]: { html: toParagraphHtml({ id: "b", text: "Erledigt" }), plainText: "Erledigt", completedAt: `${completed}T17:00:00.000Z` },
        };
        const listed = openPastDays(store, today);
        const ok = listed.length === 1 && listed[0].dayKey === open && listed[0].openCount === 1 && openLineCount(store[completed]) === 1;
        return { ok, message: ok ? "Genau der unabgeschlossene Vortag mit offenem Punkt wird angeboten." : `Unerwartete Liste: ${JSON.stringify(listed)}`, details: { listed } };
      },
    },
    {
      id: "snooze-presets", label: "Snooze-Vorschläge ohne doppeltes Ziel", kind: "logic",
      run: async () => {
        const today = toDayKey(new Date());
        const presets = snoozePresets(today);
        const targets = presets.map(preset => preset.until);
        const ok = presets.length >= 3
          && new Set(targets).size === targets.length
          && targets.every(target => target > today)
          && targets.every((target, index) => index === 0 || target > targets[index - 1]);
        return { ok, message: ok ? `${presets.length} eindeutige Wiedervorlagen.` : `Doppelte oder ungültige Ziele: ${targets.join(", ")}`, details: { targets } };
      },
    },
    {
      id: "delete-undo", label: "Löschen mit Rückgängig erhält Reihenfolge und Verknüpfung", kind: "logic",
      run: async () => {
        const source = { type: "task" as const, id: "task-anchor" };
        const html = toRuleHtml("Block") + toParagraphHtml({ id: "first", text: "Erste Zeile" }) + toParagraphHtml({ id: "second", text: "Zweite Zeile", source });
        const day: DaySlipDayData = {
          html,
          plainText: "Erste Zeile\nZweite Zeile",
          struckLineIds: ["second"],
          sources: { second: source },
          lineTimestamps: { second: { addedAt: "2026-11-06T08:00:00.000Z", checkedAt: "2026-11-06T09:00:00.000Z" } },
          resolved: [{ lineId: "second", text: "Zweite Zeile", target: "task" }],
        };
        const { day: afterDelete, removed } = removeLineFromDay(day, "second");
        if (!removed) return { ok: false, message: "Die Zeile wurde nicht entfernt." };
        const restored = restoreLineToDay(afterDelete, removed);
        const checks = {
          entfernt: extractLinesFromHtml(afterDelete.html).map(line => line.id).join() === "first",
          reihenfolge: extractLinesFromHtml(restored.html).map(line => line.id).join() === "first,second",
          verknuepfung: restored.sources?.second?.id === source.id,
          abgehakt: restored.struckLineIds?.includes("second") === true,
          zeitstempel: restored.lineTimestamps?.second?.checkedAt === "2026-11-06T09:00:00.000Z",
          zuordnung: restored.resolved?.some(item => item.lineId === "second") === true,
          nichtDoppelt: restoreLineToDay(restored, removed) === restored,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return failed.length
          ? { ok: false, message: `Fehler: ${failed.join(", ")}`, details: checks }
          : { ok: true, message: "Löschen und Rückgängig erhalten Reihenfolge, Link, Status und Zeitstempel.", details: checks };
      },
    },
    {
      id: "line-shortcuts", label: "Getippte Kürzel werden erkannt und aufgelöst", kind: "logic",
      run: async () => {
        const today = toDayKey(new Date());
        const users = [
          { id: "user-1", name: "Joschka Fischer" },
          { id: "user-2", name: "Müller" },
          { id: "user-3", name: "Müller" },
        ];
        const task = parseDaySlipLine("+ Rückruf @Joschka >morgen", { todayKey: today, users });
        const note = parseDaySlipLine("~ Gesprächsnotiz", { todayKey: today, users });
        const decision = parseDaySlipLine("? Zustimmen?", { todayKey: today, users });
        const ambiguous = parseDaySlipLine("+ Termin @Müller", { todayKey: today, users });
        const phone = parseDaySlipLine("+49 30 123456", { todayKey: today, users });
        const checks = {
          aufgabe: task.kind === "task" && task.text === "Rückruf",
          person: task.person?.id === "user-1",
          faellig: task.dueDate === shiftDayKey(today, 1),
          notiz: note.kind === "note" && note.text === "Gesprächsnotiz",
          entscheidung: decision.kind === "decision" && decision.text === "Zustimmen?",
          mehrdeutig: ambiguous.kind === "task" && ambiguous.person === undefined && ambiguous.text === "Termin @Müller",
          telefon: phone.kind === undefined && phone.text === "+49 30 123456",
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return failed.length
          ? { ok: false, message: `Fehler: ${failed.join(", ")}`, details: checks }
          : { ok: true, message: "Aufgabe, Notiz, Entscheidung, Person und Fälligkeit werden erkannt; Mehrdeutiges bleibt Text.", details: checks };
      },
    },
    {
      id: "archive-status", label: "Archiv trennt erledigt von zugewiesen und bleibt durchsuchbar", kind: "logic",
      run: async () => {
        const day: DaySlipDayData = {
          html: '<p data-line-id="a">Offen</p><p data-line-id="b" data-done="true">Erledigt</p><p data-line-id="c">Zugewiesen</p>',
          plainText: "Offen",
          struckLineIds: [],
          resolved: [{ lineId: "c", text: "Zugewiesen", target: "task" }],
          completedAt: "2026-11-25T17:00:00.000Z",
        };
        const entry = buildArchiveEntry("2026-11-25", day);
        const older = buildArchiveEntry("2026-11-20", undefined);
        const status = (id: string) => entry.lines.find(line => line.id === id)?.status;
        const checks = {
          erledigtAusInhalt: status("b") === "done",
          zugewiesen: status("c") === "assigned",
          offen: status("a") === "open",
          summe: entry.counts.done === 1 && entry.counts.assigned === 1 && entry.counts.open === 1,
          suche: matchesArchiveQuery(entry, "zugewiesen") && !matchesArchiveQuery(entry, "fehlt"),
          nachbar: archiveNeighbours([entry, older], "2026-11-25").previousKey === "2026-11-20",
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return failed.length
          ? { ok: false, message: `Fehler: ${failed.join(", ")}`, details: checks }
          : { ok: true, message: "Archiv liest den Erledigt-Zustand aus dem Inhalt und trennt erledigt, zugewiesen und offen.", details: checks };
      },
    },
  ],
};
