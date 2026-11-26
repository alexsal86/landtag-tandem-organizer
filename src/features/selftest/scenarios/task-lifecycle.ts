import { supabase } from "@/integrations/supabase/client";
import { CORE_TASK_STATUS_KEYS, missingCoreTaskStatuses } from "@/components/tasks/types";
import { nextRecurrenceDate, subtaskProgress } from "@/features/tasks/templates";
import { changeDeadline } from "@/hooks/useDeadlineActions";
import type { DeadlineItem } from "@/types/dashboardDeadlines";
import { formatDeadlineDateLabel, getDeadlineStatus, getReviewableOverdueDeadlines, groupDeadlineItems } from "@/utils/deadlineFormatting";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const dueIn = (d: number) => { const n = new Date(); n.setDate(n.getDate() + d); return n.toISOString(); };
const dayIn = (d: number) => { const n = new Date(); n.setDate(n.getDate() + d); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };
const timelineTexts = (raw: unknown) => Array.isArray(raw) ? raw.map((entry) => String((entry as { text?: unknown }).text ?? "")) : [];

export const taskLifecycleScenario: TestScenario = {
  id: "task-lifecycle",
  title: "Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt)",
  description: "Prüft zuerst die Status-Registry, legt dann eine Aufgabe an, hängt ein Dokument an, prüft Unteraufgaben samt Fortschritt, weist sie zu, setzt eine Frist, prüft die Fristen-Gruppierung und das Verwerfen samt Rückgängig, erstellt daraus eine Entscheidung, markiert sie für den Jour fixe, schließt sie ab und prüft Erledigt-Stempel, Wiederholung und Ball-Rückgabe nach einem Votum.",
  touches: ["tasks", "task_documents", "task_decisions", "task_decision_participants", "task_decision_responses", "task_statuses"],
  features: ["tasks", "decisions"],
  checks: [
    "Status-Registry führt die fünf Kernstatus",
    "Dokument hängt an der Aufgabe, bleibt auf eigene Aufgaben beschränkt und lässt sich wieder lösen",
    "Unteraufgaben tragen parent_task_id, erscheinen nicht als eigene Hauptaufgabe und treiben den Fortschritt auf 50 bzw. 100 Prozent",
    "Fristen werden nach Berliner Tagen gruppiert; Verwerfen löscht nur die Frist und Rückgängig stellt sie wieder her",
    "Abschluss setzt completed_at, Wiederöffnen entfernt es",
    "Wiederholungsregel legt beim Abschluss genau eine Folgeaufgabe an",
    "Votum zu einer verknüpften Entscheidung holt den Ball zurück und erzeugt die Folgeaufgabe genau einmal",
  ],
  writes: [
    { table: "tasks", columns: ["title", "description", "status", "priority", "user_id", "tenant_id", "assigned_to", "due_date", "progress", "pending_for_jour_fixe", "completed_at", "recurrence_rule", "parent_task_id", "ball_owner", "ball_assignee_id", "next_action", "next_action_due", "timeline"] },
    { table: "task_documents", columns: ["task_id", "user_id", "file_name", "file_path", "file_type", "file_size"] },
    { table: "task_decisions", columns: ["title", "description", "status", "created_by", "tenant_id", "task_id"] },
  ],
  limitations: [
    "Die Dokumentdatei selbst wird nicht in den Storage-Bucket geladen; der Step prüft die Datenbank-Verknüpfung samt Zugriffssperre und das Wiederlösen.",
  ],
  steps: [
    {
      id: "status-registry", label: "Status-Registry führt die fünf Kernstatus", critical: true,
      run: async () => {
        const { data, error } = await supabase.from("task_statuses").select("name");
        if (error) return { ok: false, message: describeError(error) };
        const registered = (data ?? []).map((row) => row.name);
        const missing = missingCoreTaskStatuses(registered);
        if (missing.length > 0) {
          return {
            ok: false,
            message: `task_statuses führt nicht alle Kernstatus: ${missing.join(", ")}. Aufgaben mit diesem Status werden mit 22023 abgewiesen; Migration 20261126130000 anwenden und den Status aktivieren.`,
            details: { missing, registered: [...registered].sort() },
          };
        }
        return { ok: true, message: `Alle Kernstatus sind registriert (${CORE_TASK_STATUS_KEYS.join(", ")}).` };
      },
    },
    {
      id: "create", label: "Aufgabe anlegen", critical: true,
      run: async (ctx) => {
        const payload = { title: `${SELFTEST_PREFIX} Aufgabe (${ctx.runId})`, description: SELFTEST_MARKER, status: "todo", priority: "high", user_id: ctx.userId, tenant_id: ctx.tenantId };
        const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "tasks", id: data.id });
        ctx.data.taskId = data.id;
        return expectFields("tasks", data.id, payload, "Aufgabe");
      },
    },
    {
      id: "document-link", label: "Dokument an Aufgabe hängen und wieder lösen", kind: "db",
      run: async (ctx) => {
        const taskId = ctx.data.taskId as string;
        if (!taskId) return { ok: false, message: "Die Aufgabe aus dem Anlegen-Schritt fehlt." };
        const fileName = `${SELFTEST_PREFIX} Notiz (${ctx.runId}).pdf`;
        const filePath = `tasks/${taskId}/${ctx.runId}.pdf`;
        const linked = await supabase.from("task_documents").insert({
          task_id: taskId, user_id: ctx.userId, file_name: fileName, file_path: filePath,
          file_type: "application/pdf", file_size: 1024,
        }).select("id,task_id,user_id,file_name,file_path,file_type,file_size").single();
        if (linked.error || !linked.data) return { ok: false, message: describeError(linked.error) };
        ctx.trackRecord({ table: "task_documents", id: linked.data.id });
        const listed = await supabase.from("task_documents").select("id,file_name,file_path").eq("task_id", taskId);
        if (listed.error) return { ok: false, message: describeError(listed.error) };
        const attached = (listed.data ?? []).find((row) => row.id === linked.data.id);
        const foreign = await supabase.from("task_documents").insert({
          task_id: crypto.randomUUID(), user_id: ctx.userId,
          file_name: `${SELFTEST_PREFIX} Fremd (${ctx.runId}).pdf`, file_path: `tasks/fremd/${ctx.runId}.pdf`,
        });
        const blocked = !!foreign.error && (foreign.error.code === "42501" || foreign.error.code === "23503");
        const removed = await supabase.from("task_documents").delete().eq("id", linked.data.id);
        const remaining = await supabase.from("task_documents").select("id").eq("id", linked.data.id).maybeSingle();
        const ok = linked.data.task_id === taskId
          && linked.data.user_id === ctx.userId
          && linked.data.file_name === fileName
          && attached?.file_path === filePath
          && blocked
          && !removed.error
          && remaining.data === null;
        return {
          ok,
          message: ok
            ? "Dokument hängt an der Aufgabe, erscheint in der Ablage und lässt sich wieder lösen; fremde Aufgaben bleiben gesperrt."
            : "Dokumentverknüpfung weicht ab.",
          details: { linked: linked.data, attached, foreignError: foreign.error, removed: removed.error, remaining: remaining.data },
        };
      },
    },
    {
      id: "subtasks", label: "Unteraufgaben: Verknüpfung, Hauptliste und Fortschritt", kind: "workflow",
      run: async (ctx) => {
        const parent = await supabase.from("tasks").insert({
          title: `${SELFTEST_PREFIX} Hauptaufgabe (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "todo",
          priority: "medium",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
        }).select("id").single();
        if (parent.error || !parent.data) return { ok: false, message: describeError(parent.error) };
        const parentId = parent.data.id;
        ctx.trackRecord({ table: "tasks", id: parentId });
        const childBase = {
          description: SELFTEST_MARKER,
          priority: "medium",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          parent_task_id: parentId,
        };
        const inserted = await supabase.from("tasks").insert([
          { ...childBase, title: `${SELFTEST_PREFIX} Unteraufgabe A (${ctx.runId})`, status: "todo" },
          { ...childBase, title: `${SELFTEST_PREFIX} Unteraufgabe B (${ctx.runId})`, status: "completed", completed_at: new Date().toISOString() },
        ]).select("id,title,status,parent_task_id");
        if (inserted.error || !inserted.data) return { ok: false, message: describeError(inserted.error) };
        for (const child of inserted.data) ctx.trackRecord({ table: "tasks", id: child.id });
        const children = await supabase.from("tasks")
          .select("id,title,status,parent_task_id")
          .eq("parent_task_id", parentId).eq("tenant_id", ctx.tenantId);
        if (children.error) return { ok: false, message: describeError(children.error) };
        const first = (children.data ?? []).find((row) => row.status === "todo");
        if (!first) return { ok: false, message: "Die offene Unteraufgabe fehlt." };
        const root = await supabase.from("tasks").select("id")
          .is("parent_task_id", null).in("id", [parentId, ...(children.data ?? []).map((row) => row.id)]);
        if (root.error) return { ok: false, message: describeError(root.error) };
        const progress = subtaskProgress(children.data ?? []);
        const completed = await supabase.from("tasks").update({ status: "completed" }).eq("id", first.id).eq("tenant_id", ctx.tenantId);
        if (completed.error) return { ok: false, message: describeError(completed.error) };
        const refreshed = await supabase.from("tasks").select("id,status,parent_task_id").eq("parent_task_id", parentId).eq("tenant_id", ctx.tenantId);
        const progressAfter = subtaskProgress(refreshed.data ?? []);
        const allLinked = (children.data ?? []).length === 2
          && (children.data ?? []).every((row) => row.parent_task_id === parentId)
          && (refreshed.data ?? []).every((row) => row.parent_task_id === parentId);
        const ok = allLinked
          && (root.data ?? []).length === 1
          && root.data?.[0]?.id === parentId
          && progress.percent === 50
          && progress.done === 1 && progress.total === 2
          && progressAfter.percent === 100;
        return {
          ok,
          message: ok
            ? "Unteraufgaben hängen an der Hauptaufgabe, erscheinen nicht als eigene Hauptaufgabe und treiben den Fortschritt von 50 auf 100 Prozent."
            : "Unteraufgaben-Verknüpfung oder Fortschritt weicht ab.",
          details: { parentId, children: children.data, root: root.data, progress, progressAfter },
        };
      },
    },
    {
      id: "assign", label: "Aufgabe zuweisen + Frist setzen",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const update = { assigned_to: ctx.userId, due_date: dueIn(5), status: "in_progress", progress: 30 };
        const { error } = await supabase.from("tasks").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("tasks", id, update, "Zuweisung");
      },
    },
    {
      id: "deadline-review", label: "Fristen: Berliner Gruppierung, Verwerfen und Rückgängig", kind: "workflow",
      run: async (ctx) => {
        const now = new Date("2026-11-25T12:00:00Z");
        const items: DeadlineItem[] = [
          { id: "old", title: "Alt", dueDate: "2026-10-01", type: "task", canSnooze: true },
          { id: "high", title: "Wichtig", dueDate: "2026-11-20", type: "task", canSnooze: true, priority: 2 },
          { id: "today", title: "Heute", dueDate: "2026-11-25", type: "note", canSnooze: true },
          { id: "week", title: "Woche", dueDate: "2026-11-29", type: "task", canSnooze: true },
          { id: "later", title: "Später", dueDate: "2026-12-20", type: "decision", canSnooze: true },
        ];
        const grouped = groupDeadlineItems(items, now);
        const reviewable = getReviewableOverdueDeadlines(grouped.overdue, now);
        const groupingOk = grouped.overdue.map((item) => item.id).join(",") === "high,old"
          && grouped.today.map((item) => item.id).join(",") === "today"
          && grouped.thisWeek.map((item) => item.id).join(",") === "week"
          && grouped.later.map((item) => item.id).join(",") === "later"
          && reviewable.map((item) => item.id).join(",") === "old"
          && getDeadlineStatus("2026-11-29", now) === "soon"
          && getDeadlineStatus("2026-11-30", now) === "later"
          && formatDeadlineDateLabel("2026-11-25", now) === "Heute"
          && formatDeadlineDateLabel("2026-11-24", now) === "seit 1 Tag überfällig"
          && formatDeadlineDateLabel("2026-11-26", now) === "Morgen";

        const created = await supabase.from("tasks").insert({
          title: `${SELFTEST_PREFIX} Frist (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "todo",
          priority: "medium",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          due_date: dayIn(3),
        }).select("id,due_date,title").single();
        if (created.error || !created.data) return { ok: false, message: describeError(created.error) };
        const id = created.data.id;
        ctx.trackRecord({ table: "tasks", id });
        const item: DeadlineItem = { id, title: created.data.title, dueDate: created.data.due_date!, type: "task", canSnooze: true };
        let undo: (() => Promise<void>) | undefined;
        let actionError: string | null = null;
        try {
          undo = await changeDeadline(item, "discard");
        } catch (error) {
          actionError = error instanceof Error ? error.message : String(error);
        }
        if (actionError || !undo) return { ok: false, message: `Verwerfen der Frist fehlgeschlagen: ${actionError ?? "kein Rückgängig-Schritt"}` };
        const cleared = await supabase.from("tasks").select("due_date").eq("id", id).single();
        let undoFailed = false;
        try {
          await undo();
        } catch {
          undoFailed = true;
        }
        const restored = await supabase.from("tasks").select("due_date").eq("id", id).single();
        let forbidden = false;
        try {
          await changeDeadline({ ...item, canSnooze: false }, "discard");
        } catch {
          forbidden = true;
        }
        const ok = groupingOk
          && cleared.data?.due_date === null
          && !undoFailed
          && restored.data?.due_date === item.dueDate
          && forbidden;
        return {
          ok,
          message: ok
            ? "Fristen sind nach Berliner Tagen gruppiert; Verwerfen löscht nur die Frist, Rückgängig stellt sie wieder her."
            : "Fristen-Gruppierung oder Verwerfen weicht ab.",
          details: { grouped, reviewable: reviewable.map((entry) => entry.id), cleared: cleared.data, restored: restored.data, undoFailed, forbidden },
        };
      },
    },
    {
      id: "decision", label: "Entscheidung aus Aufgabe erstellen",
      run: async (ctx) => {
        const payload = { title: `${SELFTEST_PREFIX} Aufgaben-Entscheidung (${ctx.runId})`, description: SELFTEST_MARKER, status: "active", created_by: ctx.userId, tenant_id: ctx.tenantId, task_id: ctx.data.taskId as string, visible_to_all: false };
        const { data, error } = await supabase.from("task_decisions").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "task_decisions", id: data.id });
        return expectFields("task_decisions", data.id, payload, "Entscheidung");
      },
    },
    {
      id: "jour-fixe", label: "Für Jour fixe markieren",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const { error } = await supabase.from("tasks").update({ pending_for_jour_fixe: true }).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("tasks", id, { pending_for_jour_fixe: true }, "Jour fixe");
      },
    },
    {
      id: "complete", label: "Status → completed",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const { error } = await supabase.from("tasks").update({ status: "completed", progress: 100 }).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("tasks", id, { status: "completed", progress: 100 }, "completed");
      },
    },
    {
      id: "completion-stamp", label: "Abschluss stempelt completed_at, Wiederöffnen löscht den Stempel",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        const closed = await supabase.from("tasks").select("completed_at").eq("id", id).eq("tenant_id", ctx.tenantId).single();
        if (closed.error || !closed.data) return { ok: false, message: describeError(closed.error) };
        if (!closed.data.completed_at) return { ok: false, message: "Der Abschluss hat completed_at nicht gestempelt." };
        const reopened = await supabase.from("tasks").update({ status: "todo" }).eq("id", id).eq("tenant_id", ctx.tenantId);
        if (reopened.error) return { ok: false, message: describeError(reopened.error) };
        const afterReopen = await supabase.from("tasks").select("completed_at").eq("id", id).single();
        const reclosed = await supabase.from("tasks").update({ status: "completed" }).eq("id", id).eq("tenant_id", ctx.tenantId);
        if (reclosed.error) return { ok: false, message: describeError(reclosed.error) };
        const afterReclose = await supabase.from("tasks").select("completed_at").eq("id", id).single();
        const ok = afterReopen.data?.completed_at === null && !!afterReclose.data?.completed_at;
        return {
          ok,
          message: ok
            ? "completed_at folgt dem Status in beide Richtungen."
            : "completed_at folgt dem Status nicht.",
          details: { completed: closed.data.completed_at, reopened: afterReopen.data?.completed_at, reclosed: afterReclose.data?.completed_at },
        };
      },
    },
    {
      id: "recurrence-spawn", label: "Wiederholung legt beim Abschluss genau eine Folgeaufgabe an", kind: "workflow",
      run: async (ctx) => {
        const due = dayIn(5);
        const title = `${SELFTEST_PREFIX} Wiederholung (${ctx.runId})`;
        const created = await supabase.from("tasks").insert({
          title,
          description: SELFTEST_MARKER,
          status: "todo",
          priority: "medium",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          due_date: due,
          recurrence_rule: "weekly",
          ball_owner: "office",
          ball_assignee_id: ctx.userId,
        }).select("id").single();
        if (created.error || !created.data) return { ok: false, message: describeError(created.error) };
        ctx.trackRecord({ table: "tasks", id: created.data.id });
        const completed = await supabase.from("tasks").update({ status: "completed" }).eq("id", created.data.id).eq("tenant_id", ctx.tenantId);
        if (completed.error) return { ok: false, message: describeError(completed.error) };
        const spawned = await supabase.from("tasks").select("id,due_date,status,recurrence_rule,timeline").eq("tenant_id", ctx.tenantId).eq("title", title).neq("id", created.data.id);
        if (spawned.error) return { ok: false, message: describeError(spawned.error) };
        const child = spawned.data?.[0];
        if (child) ctx.trackRecord({ table: "tasks", id: child.id });
        const expected = nextRecurrenceDate(due, "weekly");
        const texts = timelineTexts(child?.timeline);
        const firstOk = spawned.data?.length === 1
          && child?.due_date === expected
          && child?.status === "todo"
          && child?.recurrence_rule === "weekly"
          && texts.includes("Wiederkehrende Aufgabe automatisch neu angelegt");
        const again = await supabase.from("tasks").update({ status: "completed" }).eq("id", created.data.id).eq("tenant_id", ctx.tenantId);
        const all = await supabase.from("tasks").select("id").eq("tenant_id", ctx.tenantId).eq("title", title);
        const exactlyOnce = !again.error && all.data?.length === 2;
        const ok = firstOk && exactlyOnce;
        return {
          ok,
          message: ok
            ? `Folgeaufgabe mit Frist ${expected} angelegt; erneutes Abschließen erzeugt keine zweite.`
            : "Wiederholung weicht ab.",
          details: { due, expected, spawned: spawned.data, repeatedCount: all.data?.length },
        };
      },
    },
    {
      id: "decision-ball", label: "Votum holt den Ball zurück; Folgeaufgabe entsteht genau einmal", kind: "workflow",
      run: async (ctx) => {
        const taskId = ctx.data.taskId as string;
        const decision = await supabase.from("task_decisions").insert({
          title: `${SELFTEST_PREFIX} Votum (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "active",
          created_by: ctx.userId,
          tenant_id: ctx.tenantId,
          task_id: taskId,
          visible_to_all: false,
        }).select("id").single();
        if (decision.error || !decision.data) return { ok: false, message: describeError(decision.error) };
        ctx.trackRecord({ table: "task_decisions", id: decision.data.id });
        const participant = await supabase.from("task_decision_participants")
          .insert({ decision_id: decision.data.id, user_id: ctx.userId }).select("id").single();
        if (participant.error || !participant.data) return { ok: false, message: describeError(participant.error) };
        ctx.trackRecord({ table: "task_decision_participants", id: participant.data.id });
        const response = await supabase.from("task_decision_responses")
          .insert({ decision_id: decision.data.id, participant_id: participant.data.id, response_type: "yes", comment: SELFTEST_MARKER })
          .select("id").single();
        if (response.error || !response.data) return { ok: false, message: describeError(response.error) };
        ctx.trackRecord({ table: "task_decision_responses", id: response.data.id });
        const task = await supabase.from("tasks")
          .select("ball_owner,ball_assignee_id,next_action,next_action_due,timeline")
          .eq("id", taskId).eq("tenant_id", ctx.tenantId).single();
        if (task.error || !task.data) return { ok: false, message: describeError(task.error) };
        const ballBack = task.data.ball_owner === "office"
          && task.data.ball_assignee_id === ctx.userId
          && task.data.next_action === "Freigabe umsetzen"
          && task.data.next_action_due === null
          && timelineTexts(task.data.timeline).some((text) => text.startsWith("Votum zu"));
        const generated = await supabase.rpc("create_decision_task", { p_decision_id: decision.data.id });
        if (generated.error || !generated.data) return { ok: false, message: describeError(generated.error) };
        ctx.trackRecord({ table: "tasks", id: generated.data });
        const followUp = await supabase.from("tasks")
          .select("source_type,source_id,status,assigned_to,title,description")
          .eq("id", generated.data).eq("tenant_id", ctx.tenantId).single();
        if (followUp.error || !followUp.data) return { ok: false, message: describeError(followUp.error) };
        const repeated = await supabase.rpc("create_decision_task", { p_decision_id: decision.data.id });
        const follow = followUp.data;
        const followUpOk = follow.source_type === "decision"
          && follow.source_id === decision.data.id
          && follow.status === "todo"
          && (follow.assigned_to ?? "").includes(ctx.userId)
          && (follow.description ?? "").includes("Angenommen");
        const ok = ballBack && followUpOk && !repeated.error && repeated.data === generated.data;
        return {
          ok,
          message: ok
            ? "Ball liegt wieder im Büro; die Folgeaufgabe entsteht nur einmal."
            : "Ball-Rückgabe oder Folgeaufgabe weicht ab.",
          details: { task: task.data, followUp: follow, repeated: repeated.data },
        };
      },
    },
    {
      id: "tenant-boundary", label: "Aufgabe lässt sich keinem fremden Büro zuordnen", kind: "workflow",
      run: async (ctx) => {
        const id = ctx.data.taskId as string;
        // Der Client-Schutz wirft teils, statt einen Fehler zurückzugeben; beides ist ein gültiger Abschlag.
        let error: { code?: string; message?: string } | null = null;
        try {
          const result = await supabase.from("tasks").update({ tenant_id: crypto.randomUUID() }).eq("id", id);
          error = result.error;
        } catch (thrown) {
          const message = thrown instanceof Error ? thrown.message : String(thrown);
          error = { code: "TENANT_SCOPE_CONFLICT", message };
        }
        if (!error) return { ok: false, message: "Die Aufgabe wurde in ein fremdes Büro umgehängt — Mandantensperre fehlt!" };
        const blocked = error.code === "42501" || error.code === "TENANT_SCOPE_CONFLICT"
          || /tenant reassignment|row-level security/i.test(error.message ?? "");
        if (!blocked) return { ok: false, message: `Unerwarteter Fehler statt Mandantensperre: ${describeError(error)}`, details: error };
        const unchanged = await expectFields("tasks", id, { tenant_id: ctx.tenantId }, "Büro nach abgewiesenem Umhängen");
        if (!unchanged.ok) return unchanged;
        return { ok: true, message: `Umhängen in ein fremdes Büro verweigert (${error.code ?? error.message}).` };
      },
    },
  ],
};
