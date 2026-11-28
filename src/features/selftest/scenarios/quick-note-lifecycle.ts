import { formatDictatedText, parseSpeechInput } from '@/lib/speechCommandUtils';
import { buildQuickNoteHref } from "@/lib/appTargets";
import { buildDeepLinkPath } from "@/utils/notificationDeepLinks";
import { LEGACY_TAB_MAP, MY_WORK_TABS } from "@/components/my-work/myWorkTabs";
import type { Notification } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

export const quickNoteLifecycleScenario: TestScenario = {
  id: "quick-note-lifecycle",
  title: "Notizen-Lifecycle (Anlegen → Priorität → Anheften → Aufgabe → Archiv)",
  description: "Legt eine Notiz mit Priorität, Farbe und Schlagworten an, heftet sie an, macht daraus eine Aufgabe und archiviert sie. Jeder Schritt liest seine Felder zurück.",
  touches: ["quick_notes", "tasks", "task_decisions", "task_decision_participants"],
  features: ["quick-notes", "tasks"],
  writes: [
    { table: "quick_notes", columns: ["title", "content", "user_id", "tenant_id", "priority_level", "color", "category", "tags", "is_pinned", "task_id", "is_archived", "archived_at"] },
    { table: "tasks", columns: ["title", "description", "user_id", "tenant_id", "status", "priority"] },
  ],
  links: () => [{ label: "Notizen öffnen", href: "/notes" }],
  steps: [
    {
      id: "dictation-commands", label: "Notizen: Diktatbefehle und Rechtszitate erkennen", kind: "logic",
      run: async () => {
        const commands = [
          ["Letzten Satz markieren", "select-last-sentence"],
          ["Ans Ende springen", "go-to-end"],
          ["Notiz speichern", "save-note"],
          ["Checkliste starten", "insert-checklist"],
          ["Auswahl als Aufgabe übernehmen", "draft-task-from-selection"],
        ];
        const missed = commands.filter(([phrase, type]) => parseSpeechInput(phrase).command?.type !== type);
        const citation = formatDictatedText("nach paragraf 3 absatz zwei");
        const quote = formatDictatedText("anführungszeichen unten ja anführungszeichen oben");
        const ok = missed.length === 0 && citation === "Nach § 3 Abs. 2" && quote === "„Ja“";
        return { ok, message: ok ? "Diktatbefehle, Rechtszitat und Anführungszeichen erkannt." : "Diktatphrase falsch verarbeitet.", details: { missed, citation, quote } };
      },
    },
    {
      id: "note-deep-links", label: "Notizen: Deep Links zeigen auf die eigene Notizseite", kind: "logic",
      run: async () => {
        const asNotification = (typeName: string) => ({
          id: "selftest-deep-link",
          notification_types: { name: typeName },
          data: { noteId: "note-1", note_id: "note-1" },
        }) as unknown as Notification;
        const paths = ["note_follow_up", "quick_note_shared", "topic_mention"].map((typeName) => buildDeepLinkPath(asNotification(typeName)));
        const expected = "/notes?highlight=note-1";
        const captureTabStays = MY_WORK_TABS.some((tab) => tab.value === "capture");
        const legacyTabMapsToCapture = LEGACY_TAB_MAP.notes === "capture";
        const ok = buildQuickNoteHref("note-1") === expected
          && buildQuickNoteHref() === "/notes"
          && paths.every((path) => path === expected)
          && captureTabStays
          && legacyTabMapsToCapture;
        return {
          ok,
          message: ok
            ? "Benachrichtigungen verlinken auf /notes; der Quick-Notes-Reiter in Meine Arbeit bleibt erreichbar."
            : "Notiz-Deep-Link oder Quick-Notes-Einstieg weicht von /notes ab.",
          details: { paths, expected, captureTabStays, legacyTabMapsToCapture },
        };
      },
    },
    {
      id: "notification-types", label: "Notiz-Meldungstypen sind für den Mandanten geseedet",
      run: async (ctx) => {
        const required = ["note_follow_up", "quick_note_shared"];
        // Die SELECT-Policy zeigt nur aktive Typen des eigenen Mandanten; ein fehlender
        // Treffer bedeutet daher „nicht vorhanden oder inaktiv“.
        const { data, error } = await supabase
          .from("notification_types")
          .select("name")
          .eq("tenant_id", ctx.tenantId)
          .in("name", required);
        if (error) return { ok: false, message: describeError(error) };
        const rows = data ?? [];
        const missing = required.filter((name) => !rows.some((row) => row.name === name));
        const ok = missing.length === 0;
        return {
          ok,
          message: ok
            ? "Wiedervorlage- und Freigabe-Meldungen haben je Mandant einen aktiven Typ."
            : "Meldungstypen fehlen oder sind inaktiv; create_notification würde NULL liefern und der /notes-Deep-Link liefe ins Leere.",
          details: { required, missing },
        };
      },
    },
    {
      id: "share-notification-tenant", label: "Notiz-Freigabe meldet im Mandanten der Notiz",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("quick_note_share_notification_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const result = data as { ok?: boolean; skipped?: string; message?: string; delivered?: number } | null;
        if (result?.skipped) return { ok: true, message: result.skipped };
        const ok = result?.ok === true;
        return {
          ok,
          message: ok
            ? "Freigabe-Meldung landet genau einmal im Mandanten der Notiz."
            : result?.message ?? `Freigabe-Meldung fehlt oder liegt im falschen Mandanten (${result?.delivered ?? 0} Treffer).`,
          details: { delivered: result?.delivered },
        };
      },
    },
    {
      id: "create", label: "Notiz mit Priorität, Farbe und Schlagworten anlegen", critical: true,
      run: async (ctx) => {
        const payload = { title: `${SELFTEST_PREFIX} Notiz (${ctx.runId})`, content: `<p>${SELFTEST_MARKER} Rückruf Bürgerin wegen Lärmschutz</p>`, user_id: ctx.userId, tenant_id: ctx.tenantId, priority_level: 2, color: "#f59e0b", category: "general", tags: ["selbsttest", "lärmschutz"] };
        const { data, error } = await supabase.from("quick_notes").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "quick_notes", id: data.id });
        ctx.data.noteId = data.id;
        return expectFields("quick_notes", data.id, { ...payload, is_pinned: false, is_archived: false }, "Notiz");
      },
    },
    {
      id: "pin", label: "Anheften + Priorität erhöhen",
      run: async (ctx) => {
        const id = ctx.data.noteId as string;
        const update = { is_pinned: true, priority_level: 3 };
        const { error } = await supabase.from("quick_notes").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("quick_notes", id, update, "Anheften");
      },
    },
    {
      id: "to-task", label: "Aus Notiz eine Aufgabe machen (verknüpft)",
      run: async (ctx) => {
        const id = ctx.data.noteId as string;
        const { data: taskId, error } = await supabase.rpc("create_note_work", { p_note_id: id, p_kind: "task" });
        if (error || !taskId) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "tasks", id: taskId });
        const retry = await supabase.rpc("create_note_work", { p_note_id: id, p_kind: "task" });
        if (retry.error || retry.data !== taskId) return { ok: false, message: "Wiederholung erzeugt eine andere Aufgabe" };
        const result = await expectFields("quick_notes", id, { task_id: taskId }, "Atomare Verknüpfung");
        const unlink = await supabase.from("quick_notes").update({ task_id: null }).eq("id", id);
        if (unlink.error) return { ok: false, message: describeError(unlink.error) };
        const preserved = await expectFields("tasks", taskId, { source_id: id, source_type: "quick_note" }, "Aufgabe nach Entknüpfen erhalten");
        return result.ok ? preserved : result;
      },
    },
    {
      id: "decision-links", label: "Entscheidung atomar verknüpfen und Folgeaufgabe mit Herkunft erzeugen", kind: "workflow",
      run: async ctx => {
        const id = crypto.randomUUID();
        const result = await supabase.rpc("create_work_decision", { p_id: id, p_data: { title: `${SELFTEST_PREFIX} Entscheidung`, tenant_id: ctx.tenantId }, p_participants: [ctx.userId], p_note_id: ctx.data.noteId as string });
        if (result.error) return { ok: false, message: describeError(result.error) };
        ctx.trackRecord({ table: "task_decisions", id });
        const task = await supabase.rpc("create_decision_task", { p_decision_id: id });
        if (task.error || !task.data) return { ok: false, message: describeError(task.error) };
        ctx.trackRecord({ table: "tasks", id: task.data });
        const retry = await supabase.rpc("create_decision_task", { p_decision_id: id });
        if (retry.error || retry.data !== task.data) return { ok: false, message: "Folgeaufgabe nicht idempotent" };
        const unlink = await supabase.from("quick_notes").update({ decision_id: null }).eq("id", ctx.data.noteId as string);
        if (unlink.error) return { ok: false, message: describeError(unlink.error) };
        return expectFields("tasks", task.data, { source_type: "decision", source_id: id }, "Herkunft erhalten");
      },
    },
    {
      id: "archive", label: "Archivieren",
      run: async (ctx) => {
        const id = ctx.data.noteId as string;
        const update = { is_archived: true, archived_at: new Date().toISOString(), is_pinned: false };
        const { error } = await supabase.from("quick_notes").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("quick_notes", id, update, "Archiv");
      },
    },
  ],
};
