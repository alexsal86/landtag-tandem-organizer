import { canNudge, checklistEvents, isNudgeActive, shiftDay, isReminderDue, groupByZone, isOnResubmission, parseTaskBatchPreview, parseTaskCommand, slaLevel, stafetteEvents, taskZone, weekReview, type StafetteTask } from "@/features/tasks/stafette";
import { TASK_TEMPLATES, buildTemplateRows, nextRecurrenceDate, subtaskProgress, taskTemplateFromAutomationRule, validateTaskTemplate } from "@/features/tasks/templates";
import { supabase } from "@/integrations/supabase/client";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError } from "../verify";
import type { TestScenario } from "../types";

const NOW = new Date(2026, 10, 7, 12);
const ME = "me";

export const taskStafetteLifecycleScenario: TestScenario = {
  id: "task-stafette-lifecycle",
  title: "Aufgaben-Stafette (Am Zug, Wiedervorlage, Freigabe)",
  description: "Spielt den Weg einer Aufgabe durch: Schritt festlegen, Wiedervorlage, Freigabe vorlegen, Rückgabe und Abschluss.",
  features: ["tasks"],
  touches: ["tasks"],
  checks: [
    "Zonen Mein Zug / Wartet / Wiedervorlage",
    "Verlaufseinträge bei Übergaben und Erledigungen",
    "Sammelaktionen: Vorschau ohne erfundene Frist, ohne überschriebene Schritte, mit Rücknahme",
    "Wochenreview, Eskalationsgründe, Einzeiler-Befehle und SLA-Stufen als reine Regeln",
  ],
  limitations: [
    "Regeln laufen ohne Datenbank; die Sammelaktionen werden zusätzlich über die RPCs geprüft.",
    "Weitere Speicherungen deckt der Aufgaben-Lebenszyklus ab.",
  ],
  writes: [
    { table: "tasks", columns: ["title", "description", "status", "priority", "tenant_id", "user_id", "ball_owner", "ball_assignee_id", "next_action", "next_action_due", "timeline"] },
  ],
  steps: [
    {
      id: "nudge", label: "Anstupsen: Empfänger sieht Aufgabe oben, 24h-Limit", kind: "logic",
      run: async () => {
        const t: StafetteTask = { ball_owner: "office", ball_assignee_id: ME, nudged_by: "kollegin", nudged_at: NOW.toISOString() };
        const ok = taskZone(t, ME, NOW) === "nudged" && isNudgeActive(t)
          && !canNudge({ ball_owner: "deputy", nudged_by: ME, nudged_at: NOW.toISOString() }, ME, NOW)
          && !canNudge({ ball_owner: "external" }, ME, NOW);
        return { ok, message: ok ? "Anstupsen korrekt." : "Anstupsen-Regel weicht ab." };
      },
    },
    {
      id: "checklist-batch", label: "Checkpunkt im Verlauf, Frist +1 Woche", kind: "logic",
      run: async () => {
        const ev = checklistEvents([{ id: "1", text: "Anrufen", done: false }], [{ id: "1", text: "Anrufen", done: true }]);
        const ok = ev.length === 1 && shiftDay("2026-11-28", 7) === "2026-12-05";
        return { ok, message: ok ? "Checkliste und Stapel-Frist korrekt." : "Abweichung.", details: ev };
      },
    },
    {
      id: "reminder", label: "Fällige Erinnerung holt wartende Aufgabe in Mein Zug", kind: "logic",
      run: async () => {
        const t: StafetteTask = { ball_owner: "external", ball_assignee_id: ME, reminder_at: new Date(2026, 10, 7, 9).toISOString() };
        const later: StafetteTask = { ball_owner: "external", ball_assignee_id: ME, reminder_at: new Date(2026, 10, 9, 9).toISOString() };
        const ok = isReminderDue(t, NOW) && taskZone(t, ME, NOW) === "mine" && taskZone(t, "andere-person", NOW) === "waiting" && taskZone(later, ME, NOW) === "waiting";
        const ev = stafetteEvents({ reminder_at: t.reminder_at }, { reminder_at: null }, { now: NOW }).map((e) => e.text);
        return { ok: ok && ev.includes("Erinnerung erledigt"), message: ok ? "Erinnerung korrekt." : "Erinnerung falsch eingeordnet.", details: ev };
      },
    },
    {
      id: "set-step", label: "Frist bleibt sichtbar; eine ausdrückliche Wiedervorlage verschiebt die Anzeige", kind: "logic",
      run: async () => {
        const t: StafetteTask = { ball_owner: "office", next_action: "Entwurf schreiben", next_action_due: "2026-11-14" };
        const deferred = { ...t, stafette_resume_on: "2026-11-14" };
        const ok = taskZone(t, ME, NOW) === "mine" && !isOnResubmission(t, NOW)
          && taskZone(deferred, ME, NOW) === "resubmission" && isOnResubmission(deferred, NOW)
          && taskZone(deferred, ME, new Date(2026, 10, 14, 9)) === "mine";
        return { ok, message: ok ? "Wiedervorlage und Rückkehr am Stichtag korrekt." : "Zone weicht ab." };
      },
    },
    {
      id: "handover", label: "Zur Freigabe vorlegen → Wartet auf andere + Verlauf", kind: "logic",
      run: async () => {
        const before: StafetteTask = { ball_owner: "office", next_action: "Entwurf schreiben" };
        const after: StafetteTask = { ball_owner: "deputy", ball_assignee_id: "abgeordneter", next_action: "Freigabe prüfen" };
        const ev = stafetteEvents(before, after, { now: NOW }).map((e) => e.text);
        const ok = taskZone(after, ME, NOW) === "waiting" && taskZone(after, "abgeordneter", NOW) === "mine" && ev.includes("Am Zug: Büro → Abgeordnete/r") && ev.some((t) => t.startsWith("Schritt erledigt"));
        return { ok, message: ok ? "Übergabe protokolliert." : "Übergabe fehlt im Verlauf.", details: ev };
      },
    },
    {
      id: "return", label: "Rückgabe ans Büro → wieder Mein Zug", kind: "logic",
      run: async () => {
        const back: StafetteTask = { ball_owner: "office", ball_assignee_id: ME, next_action: "Korrekturen einarbeiten" };
        const other: StafetteTask = { ball_owner: "office", ball_assignee_id: "kollegin" };
        const ok = taskZone(back, ME, NOW) === "mine" && taskZone(other, ME, NOW) === "waiting";
        return { ok, message: ok ? "Rückgabe korrekt zugeordnet." : "Rückgabe falsch zugeordnet." };
      },
    },
    {
      id: "complete", label: "Abschluss: verschwindet aus allen Zonen + Verlauf", kind: "logic",
      run: async () => {
        const done: StafetteTask = { status: "completed" };
        const g = groupByZone([done], ME, NOW);
        const ev = stafetteEvents({ status: "todo" }, done, { now: NOW }).map((e) => e.text);
        const ok = g.mine.length + g.waiting.length + g.resubmission.length === 0 && ev.includes("Aufgabe abgeschlossen");
        return { ok, message: ok ? "Abschluss korrekt." : "Abschluss weicht ab.", details: ev };
      },
    },
    {
      id: "recurrence", label: "Wiederholung: nächste Frist korrekt berechnet", kind: "logic",
      run: async () => {
        const ok = nextRecurrenceDate("2026-11-07", "weekly") === "2026-11-14" && nextRecurrenceDate("2026-11-07", "quarterly") === "2027-02-07";
        return { ok, message: ok ? "Wiederholungsregeln korrekt." : "Wiederholung weicht ab." };
      },
    },
    {
      id: "template-validation", label: "Aufgabenpakete: Fristen und Unteraufgaben verbindlich", kind: "logic",
      run: async () => {
        const template = TASK_TEMPLATES[0];
        const ok = validateTaskTemplate(template) === null
          && validateTaskTemplate({ ...template, dueInDays: 366 }) !== null
          && validateTaskTemplate({ ...template, subtasks: [{ title: "", offsetDays: 1 }] }) !== null;
        return { ok, message: ok ? "Paketregeln korrekt." : "Paketvalidierung weicht ab." };
      },
    },
    {
      id: "template-automation-rule", label: "Aufgabenpaket ist eine manuelle Automatisierungsregel", kind: "logic",
      run: async () => {
        const template = TASK_TEMPLATES[0];
        const converted = taskTemplateFromAutomationRule({
          id: "rule-1", name: template.title, description: template.description, module: "tasks", trigger_type: "manual", enabled: true,
          actions: [{ type: "create_task_package", payload: { title: template.title, description: template.description, first_step: template.firstStep, due_in_days: String(template.dueInDays), subtasks: JSON.stringify(template.subtasks) } }],
        });
        const scheduled = taskTemplateFromAutomationRule({
          id: "rule-2", name: template.title, description: template.description, module: "tasks", trigger_type: "schedule", enabled: true,
          actions: [{ type: "create_task_package", payload: { first_step: template.firstStep, due_in_days: String(template.dueInDays), subtasks: "[]" } }],
        });
        const ok = converted?.subtasks.length === template.subtasks.length && scheduled === null;
        return { ok, message: ok ? "Manuelle Paketregel korrekt erkannt; andere Auslöser bleiben der Administration vorbehalten." : "Regel-Paket-Zuordnung weicht ab." };
      },
    },
    {
      id: "template-subtasks", label: "Vorlage legt Hauptaufgabe mit verknüpften Unteraufgaben an", kind: "logic",
      run: async () => {
        const { parent, children } = buildTemplateRows(TASK_TEMPLATES[0], { userId: ME, tenantId: "t" });
        const prog = subtaskProgress([{ status: "completed" }, { status: "todo" }]);
        const ok = children.length > 0 && children.every((c) => c.parent_task_id === parent.id) && prog.percent === 50;
        return { ok, message: ok ? "Vorlage & Fortschritt korrekt." : "Vorlage weicht ab." };
      },
    },
    {
      id: "week-review", label: "Wochenreview findet fehlende Schritte, namenlose Bälle, Stille und Duplikate", kind: "logic",
      run: async () => {
        const review = weekReview([
          { id: "1", title: "Antrag zur Schulpolitik prüfen", next_action: null, created_at: new Date(2026, 9, 1).toISOString() },
          { id: "2", title: "Antrag zur Schulpolitik prüfen", next_action: "Entwurf", created_at: new Date(2026, 9, 1).toISOString() },
          { id: "3", title: "Erledigt", status: "completed" },
        ], NOW);
        const ok = review.noNextStep.length === 1
          && review.noBallPerson.length === 2
          && review.stalled.length === 2
          && review.duplicates.length === 1
          && review.escalate.length === 2;
        return { ok, message: ok ? "Review ordnet die Altlasten korrekt ein." : "Review-Zuordnung weicht ab.", details: review };
      },
    },
    {
      id: "task-command", label: "Einzeiler-Befehle und SLA-Stufen", kind: "logic",
      run: async () => {
        const due = parseTaskCommand("frist +1w");
        const ok = due?.kind === "due"
          && due.days === 7
          && parseTaskCommand("an Max")?.kind === "assign"
          && parseTaskCommand("wartet auf Ministerium")?.kind === "wait"
          && parseTaskCommand("erledigt")?.kind === "complete"
          && parseTaskCommand("kein Befehl") === null
          && slaLevel(7) === "critical" && slaLevel(3) === "warn" && slaLevel(0) === "ok";
        return { ok, message: ok ? "Befehle und SLA-Schwellen korrekt." : "Befehlsparser weicht ab." };
      },
    },
    {
      id: "batch-create", label: "Sammelaktion: Aufgabe ohne Frist wird übersprungen", kind: "db",
      run: async (ctx) => {
        const { data: created, error: createError } = await supabase.from("tasks").insert({
          title: `${SELFTEST_PREFIX} Sammelaktion (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "todo",
          priority: "medium",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          ball_owner: "office",
          ball_assignee_id: ctx.userId,
          next_action: "Entwurf schreiben",
          next_action_due: null,
        }).select("id").single();
        if (createError || !created) return { ok: false, message: describeError(createError) };
        ctx.trackRecord({ table: "tasks", id: created.id });
        ctx.data.batchTaskId = created.id;
        const { data, error } = await supabase.rpc("batch_task_stafette_preview", {
          _tenant_id: ctx.tenantId, _task_ids: [created.id], _action: "week",
        });
        if (error) return { ok: false, message: describeError(error) };
        const preview = parseTaskBatchPreview(data);
        const item = preview?.items[0];
        const ok = !!preview && preview.affected === 0 && preview.skipped === 1 && item?.reason === "keine Frist gesetzt";
        return { ok, message: ok ? "Aufgabe ohne Frist wird übersprungen statt mit einer erfundenen Frist versehen." : "Vorschau weicht ab.", details: preview };
      },
    },
    {
      id: "batch-keeps-step", label: "Sammelaktion: Freigabe behält den vorhandenen nächsten Schritt", kind: "db",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("batch_task_stafette_preview", {
          _tenant_id: ctx.tenantId, _task_ids: [ctx.data.batchTaskId as string], _action: "deputy",
        });
        if (error) return { ok: false, message: describeError(error) };
        const preview = parseTaskBatchPreview(data);
        const item = preview?.items[0];
        const ok = !!item && (!item.eligible ? item.reason === "kein Abgeordnetenprofil im Büro" : item.after === "Entwurf schreiben");
        return { ok, message: ok ? "Ein vorhandener nächster Schritt bleibt erhalten." : "Der nächste Schritt würde überschrieben.", details: preview };
      },
    },
    {
      id: "batch-undo", label: "Sammelaktion: Frist +1 Woche samt Rücknahme", kind: "db",
      run: async (ctx) => {
        const id = ctx.data.batchTaskId as string;
        const base = new Date();
        base.setDate(base.getDate() + 3);
        const dueDay = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
        const { error: setError } = await supabase.from("tasks").update({ next_action_due: dueDay }).eq("id", id);
        if (setError) return { ok: false, message: describeError(setError) };
        const { data, error } = await supabase.rpc("batch_task_stafette_action", {
          _tenant_id: ctx.tenantId, _task_ids: [id], _action: "week",
        });
        if (error) return { ok: false, message: describeError(error) };
        const result = data as { batch_id?: string | null; affected?: number; skipped?: number } | null;
        if (!result?.batch_id || result.affected !== 1) return { ok: false, message: "Sammelaktion hat nichts geändert.", details: result };
        const shifted = new Date(base);
        shifted.setDate(shifted.getDate() + 7);
        const expected = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`;
        const { data: shiftedRow } = await supabase.from("tasks").select("next_action_due,next_action").eq("id", id).single();
        const { data: restoredCount, error: undoError } = await supabase.rpc("undo_task_batch_action", { _batch_id: result.batch_id });
        if (undoError) return { ok: false, message: describeError(undoError) };
        const { data: restoredRow } = await supabase.from("tasks").select("next_action_due,next_action").eq("id", id).single();
        const ok = shiftedRow?.next_action_due === expected
          && shiftedRow?.next_action === "Entwurf schreiben"
          && restoredRow?.next_action_due === dueDay
          && restoredRow?.next_action === "Entwurf schreiben"
          && restoredCount === 1;
        return { ok, message: ok ? "Frist verschoben und vollständig zurückgenommen." : "Frist oder Rücknahme weicht ab.", details: { dueDay, expected, shiftedRow, restoredRow, restoredCount } };
      },
    },
  ],
};
