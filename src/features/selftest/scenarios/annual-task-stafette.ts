import { berlinCalendar, matchesRoutineFilter } from '@/features/automation/annualRoutinePresentation';
import { supabase } from "@/integrations/supabase/client";
import { annualDueDay, annualTaskStatus, canDelegateAnnualTask } from "@/features/timetracking/annualTaskRules";
import { describeError } from "../verify";
import type { TestScenario } from "../types";
import { validateAnnualRoutine } from "@/features/automation/annualRoutines";

export const annualTaskStafetteScenario: TestScenario = {
  id: "annual-task-stafette",
  title: "Jahresaufgabe → Büroaufgabe → Jahresabschluss",
  description: "Prüft die Übergabe einer Jahresaufgabe, Schutz vor Duplikaten, Abschluss und Wiederöffnen.",
  features: ["tasks", "automation"],
  touches: ["annual_tasks", "annual_task_completions", "tasks"],
  requiredRoles: ["abgeordneter", "bueroleitung"],
  checks: ["Exakte Stichtage", "System-Routinen nicht delegierbar", "Eine Aufgabe pro Jahr", "Abschluss und Wiederöffnung synchron", "Direkter Jahresabschluss gesperrt"],
  limitations: ["Die automatische Ausführung am tatsächlichen Stichtag und Personaländerungen werden nicht durch diesen Selbsttest ausgelöst."],
  steps: [
    {
      id: "annual-overview", label: "Jahresübersicht: Statusfilter und Berliner Tagesgrenze", kind: "logic",
      run: async () => {
        const date = berlinCalendar(new Date("2026-12-31T23:30:00Z"));
        const ok = date.year === 2027 && date.month === 1 && date.day === 1
          && matchesRoutineFilter("overdue", "open") && !matchesRoutineFilter("completed", "open")
          && matchesRoutineFilter("completed", "done") && !matchesRoutineFilter("upcoming", "done");
        return { ok, message: ok ? "Statusfilter und Berliner Kalenderdatum korrekt." : "Jahresübersicht weicht ab." };
      },
    },
    {
      id: "unified-routine", label: "Jahresroutine im gemeinsamen Regel-Assistenten prüfen", kind: "logic",
      run: async () => {
        const actions = [{ type: "run_annual_routine", systemFunction: "execute_reset_vacation_days" }];
        const ok = validateAnnualRoutine("schedule", { schedule_kind: "annual" }, actions) === null
          && validateAnnualRoutine("manual", { schedule_kind: "annual" }, actions) === null
          && validateAnnualRoutine("schedule", { schedule_kind: "monthly" }, actions) !== null
          && validateAnnualRoutine("schedule", { schedule_kind: "annual" }, [...actions, ...actions]) !== null;
        return { ok, message: ok ? "Jahreszyklus und Systemaktionen korrekt begrenzt." : "Jahresroutine-Regeln weichen ab." };
      },
    },
    {
      id: "rules", label: "Stichtage und System-Routinen prüfen", kind: "logic",
      run: async () => {
        const task = { due_month: 4, due_day: 1, is_system_task: false, execute_function: null };
        const ok = annualDueDay(task, 2027) === "2027-04-01"
          && annualDueDay({ due_month: 2, due_day: 29 }, 2027) === "2027-02-28"
          && annualTaskStatus(task, 2027, null, new Date(2027, 3, 2)) === "overdue"
          && canDelegateAnnualTask(task) && !canDelegateAnnualTask({ ...task, is_system_task: true });
        return { ok, message: ok ? "Stichtag und Typentrennung korrekt." : "Jahresaufgaben-Regel weicht ab." };
      },
    },
    {
      id: "create", label: "Organisatorische Jahresaufgabe anlegen", critical: true,
      run: async ctx => {
        const id = crypto.randomUUID();
        const { error } = await supabase.from("annual_tasks").insert({ id, tenant_id: ctx.tenantId, title: `[SELFTEST] Jahresaufgabe ${ctx.runId}`, description: "Jahresrückblick vorbereiten", category: "admin", due_month: 4, due_day: 1, is_system_task: false });
        if (error) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "annual_tasks", id });
        ctx.data.annualId = id;
        return { ok: true, message: "Jahresaufgabe angelegt." };
      },
    },
    {
      id: "delegate", label: "Übergeben: Stafette, Frist und Quelle lesen", critical: true, kind: "workflow",
      run: async ctx => {
        if (typeof ctx.data.annualId !== "string") return { ok: false, message: "Jahresaufgabe fehlt." };
        const { data: id, error } = await supabase.rpc("spawn_annual_task_to_stafette", { _annual_task_id: ctx.data.annualId, _year: 2027, _assignee: ctx.userId });
        if (error || !id) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "tasks", id });
        ctx.data.taskId = id;
        const completion = await supabase.from("annual_task_completions").select("id,linked_task_id,completed_at").eq("annual_task_id", ctx.data.annualId).eq("year", 2027).single();
        if (completion.data) { ctx.trackRecord({ table: "annual_task_completions", id: completion.data.id }); ctx.data.completionId = completion.data.id; }
        const task = await supabase.from("tasks").select("tenant_id,status,ball_owner,ball_assignee_id,assigned_to,next_action_due,source_type,source_id,timeline").eq("id", id).eq("tenant_id", ctx.tenantId).single();
        if (completion.error || task.error) return { ok: false, message: describeError(completion.error ?? task.error) };
        const t = task.data;
        const ok = completion.data?.linked_task_id === id && completion.data?.completed_at === null
          && t?.tenant_id === ctx.tenantId && t.status === "todo" && t.ball_owner === "office"
          && t.ball_assignee_id === ctx.userId && t.assigned_to === ctx.userId && t.next_action_due === "2027-04-01"
          && t.source_type === "annual_task" && t.source_id === completion.data?.id && Array.isArray(t.timeline) && t.timeline.length === 1;
        return { ok, message: ok ? "Stafette samt Jahresverknüpfung korrekt." : "Stafettenfelder weichen ab.", details: { task: t, completion: completion.data } };
      },
    },
    {
      id: "duplicate", label: "Erneute Übergabe liefert dieselbe Aufgabe", kind: "workflow",
      run: async ctx => {
        if (typeof ctx.data.annualId !== "string") return { ok: false, message: "Jahresaufgabe fehlt." };
        const repeated = await supabase.rpc("spawn_annual_task_to_stafette", { _annual_task_id: ctx.data.annualId, _year: 2027 });
        const rows = await supabase.from("tasks").select("id").eq("tenant_id", ctx.tenantId).eq("source_type", "annual_task").eq("source_id", String(ctx.data.completionId));
        if (repeated.error || rows.error) return { ok: false, message: describeError(repeated.error ?? rows.error) };
        return { ok: repeated.data === ctx.data.taskId && rows.data?.length === 1, message: `${rows.data?.length ?? 0} Büroaufgaben nach wiederholter Übergabe.` };
      },
    },
    {
      id: "guard", label: "Jahresabschluss außerhalb der Büroaufgabe blockiert",
      run: async ctx => {
        const result = await supabase.from("annual_task_completions").update({ completed_at: new Date().toISOString() }).eq("id", String(ctx.data.completionId));
        const read = await supabase.from("annual_task_completions").select("completed_at").eq("id", String(ctx.data.completionId)).single();
        return { ok: !!result.error && !read.error && read.data?.completed_at === null, message: result.error ? "Direkter Abschluss blockiert." : "Direkter Abschluss konnte umgangen werden." };
      },
    },
    ...(["completed", "todo"] as const).map(status => ({
      id: status === "completed" ? "complete" : "reopen",
      label: status === "completed" ? "Büroaufgabe erledigen → Jahresaufgabe erledigt" : "Wiederöffnen → Jahresaufgabe wieder offen",
      kind: "workflow" as const,
      run: async (ctx: Parameters<TestScenario["steps"][number]["run"]>[0]) => {
        const result = await supabase.from("tasks").update({ status }).eq("id", String(ctx.data.taskId)).eq("tenant_id", ctx.tenantId);
        if (result.error) return { ok: false, message: describeError(result.error) };
        const read = await supabase.from("annual_task_completions").select("completed_at,completed_by,linked_task_id").eq("id", String(ctx.data.completionId)).single();
        if (read.error) return { ok: false, message: describeError(read.error) };
        const ok = read.data?.linked_task_id === ctx.data.taskId && (status === "completed" ? !!read.data?.completed_at && read.data.completed_by === ctx.userId : read.data?.completed_at === null && read.data.completed_by === null);
        return { ok, message: ok ? "Jahresstatus synchron." : "Jahresstatus nicht synchron.", details: read.data };
      },
    })),
  ],
};