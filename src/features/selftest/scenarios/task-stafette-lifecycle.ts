import { canNudge, checklistEvents, isNudgeActive, shiftDay, isReminderDue, groupByZone, isOnResubmission, parseTaskBatchPreview, parseTaskCommand, slaLevel, stafetteEvents, taskZone, weekReview, type StafetteTask } from "@/features/tasks/stafette";
import { TASK_TEMPLATES, buildTemplateRows, nextRecurrenceDate, subtaskProgress, taskTemplateFromAutomationRule, validateTaskTemplate } from "@/features/tasks/templates";
import { supabase } from "@/integrations/supabase/client";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError } from "../verify";
import type { TestScenario } from "../types";

const NOW = new Date(2026, 10, 7, 12);
const ME = "me";
const timelineTexts = (raw: unknown) => Array.isArray(raw) ? raw.map((entry) => String((entry as { text?: unknown }).text ?? "")) : [];

export const taskStafetteLifecycleScenario: TestScenario = {
  id: "task-stafette-lifecycle",
  title: "Aufgaben-Stafette (Am Zug, Wiedervorlage, Freigabe)",
  description: "Spielt den Weg einer Aufgabe durch: Schritt festlegen, Wiedervorlage, Freigabe vorlegen, Rückgabe, Abschluss, Mehrfachzuweisung, Vertretungsübergabe, Anstupsen mit Quittung sowie Archivieren und Wiederherstellen.",
  features: ["tasks"],
  touches: ["tasks", "task_assignees", "task_snoozes", "archived_tasks"],
  checks: [
    "Zonen Mein Zug / Wartet / Wiedervorlage",
    "Verlaufseinträge bei Übergaben und Erledigungen",
    "Sammelaktionen: Vorschau ohne erfundene Frist, ohne überschriebene Schritte, mit Rücknahme",
    "Wochenreview, Eskalationsgründe, Einzeiler-Befehle und SLA-Stufen als reine Regeln",
    "Mehrfachzuweisung hält task_assignees und assigned_to synchron",
    "Vertretungsübergabe verschiebt nur eigene Bälle und verweigert Selbstübergabe",
    "Anstupsen: 24-Stunden-Sperre in der Datenbank und Quittung im Verlauf",
    "Wiedervorlage kennt genau ein Ziel; Archivieren räumt sie mit ab, Wiederherstellen bringt die Aufgabe zurück",
  ],
  limitations: [
    "Regeln laufen ohne Datenbank; die Sammelaktionen werden zusätzlich über die RPCs geprüft.",
    "Die Vertretungsübergabe läuft positiv nur, wenn die gewählte Vertretung keine eigenen offenen Aufgaben hat; sonst prüft der Schritt nur die Sperren, damit keine fremden Bälle verschoben werden.",
    "Der stündliche Cron-Versand fälliger Erinnerungen wird nicht ausgelöst; geprüft wird die Datenbank-Quittung des Anstupsens.",
  ],
  writes: [
    { table: "tasks", columns: ["title", "description", "status", "priority", "tenant_id", "user_id", "ball_owner", "ball_assignee_id", "assigned_to", "next_action", "next_action_due", "timeline"] },
    { table: "task_assignees", columns: ["task_id", "user_id", "assigned_by"] },
    { table: "task_snoozes", columns: ["user_id", "task_id", "snoozed_until"] },
    { table: "archived_tasks", columns: ["task_id", "user_id", "title", "archived_at"] },
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
    {
      id: "nudge-boundary", label: "Anstupsen erreicht keine Aufgabe außerhalb des eigenen Büros", kind: "workflow",
      run: async () => {
        const { data, error } = await supabase.rpc("nudge_task", { _task_id: crypto.randomUUID(), _note: "Selbsttest" });
        const blocked = !data && !!error && /task not accessible/i.test(error.message);
        if (!blocked) return { ok: false, message: "Anstupsen einer fremden bzw. unbekannten Aufgabe war möglich.", details: { data, error } };
        return { ok: true, message: `Anstupsen ohne Zugriff auf die Aufgabe verweigert (${error.code ?? error.message}).` };
      },
    },
    {
      id: "multi-assign", label: "Mehrfachzuweisung hält task_assignees und assigned_to synchron", kind: "db",
      run: async (ctx) => {
        const created = await supabase.from("tasks").insert({
          title: `${SELFTEST_PREFIX} Mehrfachzuweisung (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "todo",
          priority: "medium",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          ball_owner: "office",
          ball_assignee_id: ctx.userId,
        }).select("id").single();
        if (created.error || !created.data) return { ok: false, message: describeError(created.error) };
        const id = created.data.id;
        ctx.trackRecord({ table: "tasks", id });
        ctx.data.multiTaskId = id;
        const peers = await supabase.from("profiles").select("user_id").eq("tenant_id", ctx.tenantId).neq("user_id", ctx.userId).limit(1);
        if (peers.error) return { ok: false, message: describeError(peers.error) };
        const second = peers.data?.[0]?.user_id;
        const wanted = second ? [ctx.userId, second] : [ctx.userId];
        const assignedTo = second ? `{${ctx.userId},${second}}` : `{${ctx.userId},${ctx.userId}}`;
        const updated = await supabase.from("tasks").update({ assigned_to: assignedTo }).eq("id", id).eq("tenant_id", ctx.tenantId);
        if (updated.error) return { ok: false, message: describeError(updated.error) };
        const rows = await supabase.from("task_assignees").select("user_id").eq("task_id", id);
        if (rows.error) return { ok: false, message: describeError(rows.error) };
        const synced = new Set((rows.data ?? []).map((row) => row.user_id));
        const read = await supabase.from("tasks").select("assigned_to").eq("id", id).single();
        const single = await supabase.from("tasks").update({ assigned_to: ctx.userId }).eq("id", id).eq("tenant_id", ctx.tenantId);
        const after = await supabase.from("task_assignees").select("user_id").eq("task_id", id);
        const legacy = read.data?.assigned_to ?? "";
        const remaining = after.data ?? [];
        const ok = !single.error
          && synced.size === wanted.length
          && wanted.every((user) => synced.has(user))
          && wanted.every((user) => legacy.includes(user))
          && remaining.length === 1
          && remaining[0].user_id === ctx.userId;
        return {
          ok,
          message: ok
            ? (second ? "Zwei Zugewiesene in task_assignees und im Altfeld; Entfernen lässt eine Person übrig." : "Ohne zweite Person bleibt die entdoppelte Einzelzuweisung konsistent.")
            : "Mehrfachzuweisung und task_assignees weichen voneinander ab.",
          details: { assignedTo, synced: [...synced], legacy, after: remaining },
        };
      },
    },
    {
      id: "deputy-handover", label: "Vertretungsübergabe: nur Leitung, nie an sich selbst, verschiebt den Ball", kind: "workflow",
      run: async (ctx) => {
        const id = ctx.data.multiTaskId as string;
        if (!id) return { ok: false, message: "Die Aufgabe aus der Mehrfachzuweisung fehlt." };
        const self = await supabase.rpc("handover_tasks_to_deputy", { p_tenant: ctx.tenantId, p_user: ctx.userId, p_deputy: ctx.userId });
        const selfBlocked = !!self.error && (self.error.code === "42501" || self.error.code === "22023" || /Ungültige Übergabe|Nur Leitung/i.test(self.error.message ?? ""));
        if (!selfBlocked) return { ok: false, message: "Die Übergabe an sich selbst wurde nicht verweigert.", details: self.error };
        const members = await supabase.from("user_tenant_memberships").select("user_id")
          .eq("tenant_id", ctx.tenantId).eq("is_active", true).neq("user_id", ctx.userId).limit(1);
        if (members.error) return { ok: false, message: describeError(members.error) };
        const deputy = members.data?.[0]?.user_id;
        if (!deputy) return { ok: true, message: "Keine zweite aktive Person im Büro; nur die Selbstübergabe-Sperre ist geprüft." };
        if (!["abgeordneter", "bueroleitung"].includes(ctx.role ?? "")) {
          return { ok: true, message: `Rolle ${ctx.role ?? "ohne Rolle"} darf nicht übergeben; die Sperre greift.` };
        }
        const occupied = await supabase.from("tasks").select("id")
          .eq("tenant_id", ctx.tenantId).eq("ball_assignee_id", deputy).not("status", "in", "(completed,archived)");
        if (occupied.error) return { ok: false, message: describeError(occupied.error) };
        if ((occupied.data ?? []).length > 0) {
          return { ok: true, message: "Übergabepfad nicht ausgeführt: Die Vertretung führt bereits eigene offene Aufgaben; ein Test würde fremde Bälle verschieben." };
        }
        const prepared = await supabase.from("tasks").update({ ball_assignee_id: deputy, assigned_to: deputy }).eq("id", id).eq("tenant_id", ctx.tenantId);
        if (prepared.error) return { ok: false, message: describeError(prepared.error) };
        const moved = await supabase.rpc("handover_tasks_to_deputy", { p_tenant: ctx.tenantId, p_user: deputy, p_deputy: ctx.userId });
        if (moved.error) return { ok: false, message: describeError(moved.error) };
        const task = await supabase.from("tasks").select("ball_assignee_id,assigned_to,next_action,timeline").eq("id", id).eq("tenant_id", ctx.tenantId).single();
        if (task.error || !task.data) return { ok: false, message: describeError(task.error) };
        const returns = await supabase.from("tasks").update({ ball_assignee_id: ctx.userId, assigned_to: ctx.userId }).eq("id", id).eq("tenant_id", ctx.tenantId);
        const ok = (moved.data ?? 0) >= 1
          && task.data.ball_assignee_id === ctx.userId
          && (task.data.assigned_to ?? "").includes(ctx.userId)
          && timelineTexts(task.data.timeline).some((text) => text.startsWith("Offboarding: Verantwortung an"))
          && !returns.error;
        return {
          ok,
          message: ok
            ? "Ball und Zuweisung sind bei der Vertretung angekommen; die Selbstübergabe bleibt gesperrt."
            : "Vertretungsübergabe hat den Ball nicht wie erwartet verschoben.",
          details: { moved: moved.data, task: task.data, selfError: self.error },
        };
      },
    },
    {
      id: "nudge-ack", label: "Anstupsen: 24-Stunden-Sperre der Datenbank und Quittung im Verlauf", kind: "workflow",
      run: async (ctx) => {
        const created = await supabase.from("tasks").insert({
          title: `${SELFTEST_PREFIX} Anstupsen (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "todo",
          priority: "medium",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          ball_owner: "office",
          ball_assignee_id: ctx.userId,
        }).select("id").single();
        if (created.error || !created.data) return { ok: false, message: describeError(created.error) };
        const id = created.data.id;
        ctx.trackRecord({ table: "tasks", id });
        const first = await supabase.rpc("nudge_task", { _task_id: id, _note: "Bitte prüfen" });
        if (first.error) return { ok: false, message: describeError(first.error) };
        const afterFirst = await supabase.from("tasks").select("nudged_at,nudged_by,nudge_seen_at,nudge_count,timeline").eq("id", id).single();
        if (afterFirst.error || !afterFirst.data) return { ok: false, message: describeError(afterFirst.error) };
        const second = await supabase.rpc("nudge_task", { _task_id: id, _note: "Nochmal" });
        const limited = !!second.error && /Heute bereits angestupst/i.test(second.error.message ?? "");
        const ack = await supabase.rpc("ack_task_nudge", { _task_id: id, _reply: "Erledigt" });
        if (ack.error) return { ok: false, message: describeError(ack.error) };
        const afterAck = await supabase.from("tasks").select("nudge_seen_at,nudged_at,timeline").eq("id", id).single();
        if (afterAck.error || !afterAck.data) return { ok: false, message: describeError(afterAck.error) };
        const seen = afterAck.data.nudge_seen_at;
        const acknowledged = !!seen && !!afterAck.data.nudged_at && seen >= afterAck.data.nudged_at;
        const ackAgain = await supabase.rpc("ack_task_nudge", { _task_id: id });
        const final = await supabase.from("tasks").select("timeline").eq("id", id).single();
        const texts = timelineTexts(final.data?.timeline);
        const ok = afterFirst.data.nudge_count === 1
          && afterFirst.data.nudge_seen_at === null
          && afterFirst.data.nudged_by === ctx.userId
          && limited
          && acknowledged
          && !ackAgain.error
          && texts.some((text) => text.startsWith("Angestupst"))
          && texts.includes("Antwort aufs Anstupsen: Erledigt")
          && texts.includes("Anstupsen gesehen");
        return {
          ok,
          message: ok
            ? "Zweiter Anstupsversuch innerhalb von 24 Stunden blockiert; Quittung und Antwort stehen im Verlauf."
            : "Anstupsen oder Quittung weicht ab.",
          details: { afterFirst: afterFirst.data, secondError: second.error, seen, texts },
        };
      },
    },
    {
      id: "snooze-rows", label: "Wiedervorlage: task_snoozes je Person, genau ein Ziel", kind: "db",
      run: async (ctx) => {
        const created = await supabase.from("tasks").insert({
          title: `${SELFTEST_PREFIX} Wiedervorlage (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "todo",
          priority: "low",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
        }).select("id").single();
        if (created.error || !created.data) return { ok: false, message: describeError(created.error) };
        const id = created.data.id;
        ctx.trackRecord({ table: "tasks", id });
        const until = new Date();
        until.setDate(until.getDate() + 2);
        const inserted = await supabase.from("task_snoozes")
          .insert({ user_id: ctx.userId, task_id: id, snoozed_until: until.toISOString() })
          .select("id,user_id,task_id,snoozed_until").single();
        if (inserted.error || !inserted.data) return { ok: false, message: describeError(inserted.error) };
        const ambiguous = await supabase.from("task_snoozes")
          .insert({ user_id: ctx.userId, task_id: null, subtask_id: null, snoozed_until: until.toISOString() });
        const cleared = await supabase.from("task_snoozes").delete().eq("id", inserted.data.id);
        const remaining = await supabase.from("task_snoozes").select("id").eq("task_id", id);
        const ok = inserted.data.user_id === ctx.userId
          && inserted.data.task_id === id
          && !!ambiguous.error
          && ambiguous.error.code === "23514"
          && !cleared.error
          && (remaining.data ?? []).length === 0;
        return {
          ok,
          message: ok
            ? "Rückstellung gehört der Person und verlangt genau eine Aufgabe oder Unteraufgabe."
            : "Wiedervorlage verletzt die Zielregel.",
          details: { inserted: inserted.data, ambiguousError: ambiguous.error, remaining: remaining.data },
        };
      },
    },
    {
      id: "archive-restore", label: "Archivieren entfernt Aufgabe und Wiedervorlage, Wiederherstellen holt sie zurück", kind: "workflow",
      run: async (ctx) => {
        const created = await supabase.from("tasks").insert({
          title: `${SELFTEST_PREFIX} Archiv (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "completed",
          priority: "low",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          completed_at: new Date().toISOString(),
        }).select("id").single();
        if (created.error || !created.data) return { ok: false, message: describeError(created.error) };
        const id = created.data.id;
        ctx.trackRecord({ table: "tasks", id });
        const until = new Date();
        until.setDate(until.getDate() + 3);
        const snooze = await supabase.from("task_snoozes")
          .insert({ user_id: ctx.userId, task_id: id, snoozed_until: until.toISOString() });
        if (snooze.error) return { ok: false, message: describeError(snooze.error) };
        const archived = await supabase.rpc("archive_completed_task", { p_task_id: id, p_user_id: ctx.userId });
        if (archived.error || !archived.data) return { ok: false, message: describeError(archived.error) };
        const gone = await supabase.from("tasks").select("id").eq("id", id).maybeSingle();
        const archivedRow = await supabase.from("archived_tasks").select("task_id,user_id,title,archived_at").eq("id", archived.data).maybeSingle();
        const snoozeGone = await supabase.from("task_snoozes").select("id").eq("task_id", id);
        const foreign = await supabase.rpc("archive_completed_task", { p_task_id: id, p_user_id: crypto.randomUUID() });
        const foreignBlocked = !!foreign.error && foreign.error.code === "42501";
        const restored = await supabase.rpc("restore_archived_task", { _archived_id: archived.data, _tenant_id: ctx.tenantId });
        if (restored.error) return { ok: false, message: describeError(restored.error) };
        const back = await supabase.from("tasks").select("status,timeline").eq("id", id).maybeSingle();
        const archivedGone = await supabase.from("archived_tasks").select("id").eq("id", archived.data).maybeSingle();
        const ok = gone.data === null
          && archivedRow.data?.task_id === id
          && archivedRow.data.user_id === ctx.userId
          && !!archivedRow.data.archived_at
          && (snoozeGone.data ?? []).length === 0
          && foreignBlocked
          && restored.data === 1
          && back.data?.status === "todo"
          && timelineTexts(back.data?.timeline).includes("Aus dem Archiv zurückgeholt")
          && archivedGone.data === null;
        return {
          ok,
          message: ok
            ? "Archivieren entfernt Aufgabe und Wiedervorlage; Wiederherstellen legt sie als offene Aufgabe mit Verlauf zurück."
            : "Archivieren oder Wiederherstellen weicht ab.",
          details: { archivedId: archived.data, archivedRow: archivedRow.data, snoozeGone: snoozeGone.data, foreignError: foreign.error, restored: restored.data, back: back.data },
        };
      },
    },
  ],
};
