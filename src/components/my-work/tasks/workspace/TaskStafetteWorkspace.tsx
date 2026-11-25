import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { MyWorkTask } from "@/hooks/useMyWorkTasksData";
import { notify } from "@/lib/notify";
import { EmptyState } from "@/components/ui-patterns";
import { Command as CommandIcon, Gauge, Inbox, ListChecks, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { checklistEvents, parseChecklist, groupByZone, isTaskReminderFor, parseTaskTimeline, shiftDay, stafetteEvents, type StafetteEvent, parseTaskBatchPreview, taskBatchPreview, TASK_BATCH_LIMIT, type TaskBatchAction, type TaskBatchItem, type TaskBatchPreview, type TaskCommand } from "@/features/tasks/stafette";
import { TaskTriageList } from "./TaskTriageList";
import { TaskBatchDialog } from "./TaskBatchDialog";
import { TaskCommandPalette } from "./TaskCommandPalette";
import { TaskIntakeDialog } from "./TaskIntakeDialog";
import { TaskReviewDialog } from "./TaskReviewDialog";
import { TaskSlaDialog } from "./TaskSlaDialog";
import { TaskDetailView, type TaskPatch } from "./TaskDetailView";

interface Props {
  userId?: string;
  tasks: MyWorkTask[];
  profiles: Array<{ user_id: string; display_name: string | null }>;
  onReload: () => void | Promise<void>;
  onComplete: (taskId: string) => Promise<void> | void;
  onDecision: (taskId: string) => void;
  onJourFixe: (taskId: string) => void;
  onCreate: () => void;
  modeControls: ReactNode;
  snoozes: Record<string, string>;
}

const taskFilters = [
  { id: "mine", label: "Mein Zug", zones: ["nudged", "mine", "resubmission"] },
  { id: "waiting", label: "Wartet", zones: ["waiting"] },
  { id: "all", label: "Alle", zones: ["nudged", "mine", "waiting", "resubmission"] },
] as const;

export function TaskStafetteWorkspace({ userId, tasks, profiles, onReload, onComplete, onDecision, onJourFixe, onCreate, modeControls, snoozes }: Props) {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [filter, setFilter] = useState<(typeof taskFilters)[number]>(taskFilters[0]);
  const [resubmissionsOpen, setResubmissionsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Partial<MyWorkTask>>>({});
  const shortcuts = useRef<{ stepDone: () => void; daySlip: () => void; openOwner: () => void } | null>(null);

  const merged = useMemo(() => tasks.map((t) => ({ ...t, ...local[t.id] })), [tasks, local]);
  const zones = useMemo(() => {
    const grouped = groupByZone(merged, userId, clock);
    for (const zone of ["nudged", "mine", "waiting", "resubmission"] as const) {
      for (const task of [...grouped[zone]]) {
        if (!snoozes[task.id] || new Date(snoozes[task.id]).getTime() <= new Date().setHours(23, 59, 59, 999) || zone === "resubmission") continue;
        grouped[zone] = grouped[zone].filter((entry) => entry.id !== task.id);
        grouped.resubmission.push(task);
      }
    }
    return grouped;
  }, [merged, userId, snoozes, clock]);
  const ordered = useMemo(() => filter.zones.flatMap((zone) => zone === "resubmission" && !resubmissionsOpen ? [] : zones[zone]), [filter, zones, resubmissionsOpen]);
  const selected = ordered.find((t) => t.id === selectedId) ?? ordered[0] ?? null;

  const remindedOnce = useRef(false);
  useEffect(() => {
    if (remindedOnce.current || tasks.length === 0) return;
    remindedOnce.current = true;
    const due = tasks.filter((t) => t.status !== "completed" && isTaskReminderFor(t, userId));
    if (due.length === 1) notify.info(`Erinnerung: ${due[0].title}`);
    else if (due.length > 1) notify.info(`${due.length} Erinnerungen fällig – sie stehen oben unter „Mein Zug“.`);
  }, [tasks, userId]);

  const taskIds = useMemo(() => tasks.map((t) => t.id).sort(), [tasks]);
  const { data: decisions } = useQuery({
    queryKey: ["task-stafette-decisions", taskIds.join(",")],
    enabled: taskIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("task_decisions").select("id, task_id, status, title, response_options").in("task_id", taskIds);
      return data ?? [];
    },
  });

  const openDecisionIds = useMemo(() => (decisions ?? []).filter((d) => d.status === "active" || d.status === "open").map((d) => d.id).sort(), [decisions]);
  const { data: myVotes, refetch: refetchVotes } = useQuery({
    queryKey: ["task-stafette-my-votes", userId, openDecisionIds.join(",")],
    enabled: !!userId && openDecisionIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: parts } = await supabase.from("task_decision_participants").select("id, decision_id").eq("user_id", userId!).in("decision_id", openDecisionIds);
      const ids = (parts ?? []).map((p) => p.id);
      const { data: resp } = ids.length ? await supabase.from("task_decision_responses").select("participant_id").in("participant_id", ids) : { data: [] };
      const answered = new Set((resp ?? []).map((r) => r.participant_id));
      return (parts ?? []).filter((p) => !answered.has(p.id));
    },
  });

  const pendingVoteFor = useCallback((taskId: string) => {
    const d = decisions?.find((x) => x.task_id === taskId && myVotes?.some((v) => v.decision_id === x.id));
    if (!d) return null;
    const part = myVotes!.find((v) => v.decision_id === d.id)!;
    const raw = Array.isArray(d.response_options) ? (d.response_options as Array<{ key?: string; label?: string; requires_comment?: boolean }>) : [];
    const options = raw.filter((o) => o.key && o.label).map((o) => ({ key: o.key!, label: o.label!, requiresComment: !!o.requires_comment }));
    return { decisionId: d.id, participantId: part.id, title: d.title, options: options.length ? options : [{ key: "yes", label: "Ja", requiresComment: false }, { key: "no", label: "Nein", requiresComment: false }] };
  }, [decisions, myVotes]);

  const vote = async (participantId: string, decisionId: string, key: string, comment: string) => {
    const { error } = await supabase.from("task_decision_responses").insert({ decision_id: decisionId, participant_id: participantId, response_type: key, comment: comment || null });
    if (error) { notify.error("Abstimmung fehlgeschlagen"); return; }
    notify.success("Abgestimmt");
    void refetchVotes();
    void onReload();
  };

  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [batchRequest, setBatchRequest] = useState<{ action: TaskBatchAction; ids: string[]; preview: TaskBatchPreview } | null>(null);
  const [batchPending, setBatchPending] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [slaOpen, setSlaOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const toggleSelect = (id: string) => setSelection((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const tenantGroups = (ids: string[]) => {
    const groups = new Map<string, string[]>();
    for (const id of ids) {
      const tenantId = merged.find((task) => task.id === id)?.tenant_id;
      if (!tenantId) continue;
      groups.set(tenantId, [...(groups.get(tenantId) ?? []), id]);
    }
    return [...groups.entries()];
  };

  // Die Vorschau kommt aus derselben Datenbankregel wie die Ausführung (task_batch_plan).
  const requestBatch = async (action: TaskBatchAction) => {
    const ids = [...selection];
    if (ids.length === 0) return;
    if (ids.length > TASK_BATCH_LIMIT) {
      notify.error(`Höchstens ${TASK_BATCH_LIMIT} Aufgaben pro Sammelaktion`);
      return;
    }
    const items: TaskBatchItem[] = [];
    for (const [tenantId, taskIds] of tenantGroups(ids)) {
      const { data, error } = await supabase.rpc("batch_task_stafette_preview", { _tenant_id: tenantId, _task_ids: taskIds, _action: action });
      if (error) { notify.error("Vorschau fehlgeschlagen", { description: error.message }); return; }
      const preview = parseTaskBatchPreview(data);
      if (!preview) { notify.error("Vorschau konnte nicht gelesen werden"); return; }
      items.push(...preview.items);
    }
    setBatchRequest({ action, ids, preview: taskBatchPreview(action, items) });
  };

  const undoBatch = async (batchIds: string[]) => {
    let restored = 0;
    for (const batchId of batchIds) {
      const { data, error } = await supabase.rpc("undo_task_batch_action", { _batch_id: batchId });
      if (error) { notify.error("Rücknahme nicht möglich", { description: error.message }); return; }
      restored += typeof data === "number" ? data : 0;
    }
    notify.success(`${restored} ${restored === 1 ? "Aufgabe" : "Aufgaben"} zurückgesetzt`);
    void onReload();
  };

  const applyBatch = async () => {
    if (!batchRequest) return;
    setBatchPending(true);
    const batches: string[] = [];
    let affected = 0;
    let skipped = 0;
    try {
      for (const [tenantId, taskIds] of tenantGroups(batchRequest.ids)) {
        const { data, error } = await supabase.rpc("batch_task_stafette_action", { _tenant_id: tenantId, _task_ids: taskIds, _action: batchRequest.action });
        if (error) { notify.error("Sammelaktion fehlgeschlagen", { description: error.message }); return; }
        const result = data as { batch_id?: string | null; affected?: number; skipped?: number } | null;
        if (result?.batch_id) batches.push(result.batch_id);
        affected += result?.affected ?? 0;
        skipped += result?.skipped ?? 0;
      }
      setSelection(new Set());
      setBatchRequest(null);
      notify.success(
        `${affected} ${affected === 1 ? "Aufgabe" : "Aufgaben"} aktualisiert${skipped > 0 ? `, ${skipped} übersprungen` : ""}`,
        batches.length ? { action: { label: "Rückgängig", onClick: () => { void undoBatch(batches); } } } : undefined,
      );
      void onReload();
    } finally {
      setBatchPending(false);
    }
  };

  const decisionLabel = useCallback((taskId: string) => {
    const d = decisions?.filter((x) => x.task_id === taskId) ?? [];
    if (d.length === 0) return null;
    const open = d.filter((x) => x.status === "active" || x.status === "open").length;
    return open > 0 ? "Entscheidung offen" : "Entscheidung getroffen";
  }, [decisions]);

  const nameOf = useCallback(
    (id: string | null | undefined) => (id ? profiles.find((p) => p.user_id === id)?.display_name ?? undefined : undefined),
    [profiles],
  );

  const save = async (task: MyWorkTask, patch: TaskPatch) => {
    const { note } = patch;
    const fields: Partial<MyWorkTask> = {};
    if ("stafette_resume_on" in patch) fields.stafette_resume_on = patch.stafette_resume_on;
    if ("ball_accepted_at" in patch) fields.ball_accepted_at = patch.ball_accepted_at;
    if ("priority" in patch) fields.priority = patch.priority;
    if ("due_date" in patch) fields.due_date = patch.due_date;
    if ("description" in patch) fields.description = patch.description;
    if ("ball_owner" in patch) fields.ball_owner = patch.ball_owner;
    const externalLabel = patch.ball_owner && patch.ball_owner !== "external" ? null : patch.ball_external_label;
    if (externalLabel !== undefined && externalLabel !== (task.ball_external_label ?? null)) {
      fields.ball_external_label = externalLabel;
    }
    if ("ball_assignee_id" in patch) fields.ball_assignee_id = patch.ball_assignee_id;
    if ("next_action" in patch) fields.next_action = patch.next_action;
    if ("next_action_due" in patch) fields.next_action_due = patch.next_action_due;
    if ("reminder_at" in patch) fields.reminder_at = patch.reminder_at;
    if ("reminder_note" in patch) fields.reminder_note = patch.reminder_note;
    if ("checklist" in patch) fields.checklist = patch.checklist;
    const after = { ...task, ...fields };
    const events: StafetteEvent[] = stafetteEvents(task, after, { actorName: nameOf(userId), nameOf: (id) => nameOf(id) });
    if ("checklist" in patch) {
      const at = new Date().toISOString();
      checklistEvents(parseChecklist(task.checklist), parseChecklist(patch.checklist)).forEach((text, i) =>
        events.push({ id: `${at}-c${i}`, type: "system", at, actorName: nameOf(userId), text }));
    }
    if (note) events.push({ id: `${Date.now()}-n`, type: "note", at: new Date().toISOString(), actorName: nameOf(userId), text: note });
    const timeline = [...parseTaskTimeline(task.timeline), ...events];
    const { checklist, ...rest } = fields;
    const handover = "ball_owner" in fields || "ball_assignee_id" in fields || "ball_accepted_at" in fields;
    const update = {
      ...rest,
      ...(checklist !== undefined ? { checklist: checklist as Json } : {}),
      ...(!handover && events.length ? { timeline: timeline as unknown as Json } : {}),
    };
    setLocal((l) => ({ ...l, [task.id]: { ...l[task.id], ...fields, timeline } }));
    const request = supabase.from("tasks").update(update).eq("id", task.id);
    if ("ball_accepted_at" in fields && task.ball_handed_at) request.eq("ball_handed_at", task.ball_handed_at);
    const { data, error } = await request.select("ball_assignee_id,ball_handed_at,ball_handed_by,ball_accepted_at,stafette_resume_on,reminder_at,reminder_note,nudge_seen_at,timeline").single();
    if (error) {
      notify.error("Speichern fehlgeschlagen");
      setLocal((l) => { const n = { ...l }; delete n[task.id]; return n; });
      return false;
    }
    setLocal((l) => ({ ...l, [task.id]: { ...l[task.id], ...data } }));
    if (fields.ball_owner === "deputy" && task.ball_owner !== "deputy") notify.success("Zur Freigabe vorgelegt");
    try {
      await onReload();
    } finally {
      setLocal((l) => { const n = { ...l }; delete n[task.id]; return n; });
    }
    return true;
  };

  const nudge = async (task: MyWorkTask, note: string) => {
    const { error } = await supabase.rpc("nudge_task", { _task_id: task.id, _note: note || null });
    if (error) { notify.error(error.message.includes("bereits") ? "Heute schon angestupst" : "Anstupsen fehlgeschlagen"); return; }
    notify.success("Angestupst");
    void onReload();
  };
  const escalateTask = async (taskId: string, note: string) => {
    // Der RPC nimmt eine optionale Notiz; die Datenbank behandelt NULL und
    // „nicht übergeben“ gleich, der Typ kennt nur string | undefined.
    const { error } = await supabase.rpc("escalate_task", { _task_id: taskId, _note: note || undefined });
    if (error) { notify.error("Eskalation fehlgeschlagen", { description: error.message }); return; }
    notify.success("Büroleitung informiert");
    void onReload();
  };

  const runTaskCommand = async (command: TaskCommand) => {
    const task = selected;
    if (!task) { notify.error("Bitte zuerst eine Aufgabe auswählen"); return; }
    if (command.kind === "complete") { await onComplete(task.id); return; }
    if (command.kind === "due") { await save(task, { next_action_due: shiftDay(task.next_action_due, command.days) }); return; }
    if (command.kind === "priority") { await save(task, { priority: command.priority }); return; }
    if (command.kind === "wait") {
      await save(task, { ball_owner: "external", ball_external_label: command.text, ball_assignee_id: task.ball_assignee_id ?? userId ?? null });
      return;
    }
    const needle = command.query.trim().toLocaleLowerCase("de");
    const person = profiles.find((profile) => (profile.display_name ?? "").toLocaleLowerCase("de").includes(needle));
    if (!person) { notify.error(`Niemand gefunden für „${command.query}“`); return; }
    await save(task, { ball_owner: "office", ball_assignee_id: person.user_id });
  };

  const ackNudge = async (task: MyWorkTask, reply: string) => {
    setLocal((l) => ({ ...l, [task.id]: { ...l[task.id], nudge_seen_at: new Date().toISOString() } }));
    const { error } = await supabase.rpc("ack_task_nudge", { _task_id: task.id, _reply: reply || null });
    if (error) notify.error("Speichern fehlgeschlagen");
    void onReload();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || el?.closest('[role="dialog"], [role="menu"]')) return;
      const idx = selected ? ordered.findIndex((t) => t.id === selected.id) : -1;
      if (e.key === "j" || e.key === "ArrowDown") { const n = ordered[Math.min(idx + 1, ordered.length - 1)]; if (n) setSelectedId(n.id); e.preventDefault(); }
      else if (e.key === "k" || e.key === "ArrowUp") { const n = ordered[Math.max(idx - 1, 0)]; if (n) setSelectedId(n.id); e.preventDefault(); }
      else if (selected && e.key.toLowerCase() === "a") { shortcuts.current?.openOwner(); e.preventDefault(); }
      else if (selected && e.key === "e") shortcuts.current?.stepDone();
      else if (selected && e.key === "t") shortcuts.current?.daySlip();
      else if (e.key === "c") { onCreate(); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered, selected, onCreate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "j" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b px-4 py-2">
        <h2 className="text-base font-semibold">Aufgaben</h2>
        <div role="group" aria-label="Aufgaben filtern" className="flex flex-wrap items-center gap-1">
          {taskFilters.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant="ghost"
              aria-pressed={filter.id === option.id}
              className={cn("h-10 gap-1 rounded-xl", filter.id === option.id ? "bg-[#f0f0ed] font-semibold dark:bg-muted" : "text-muted-foreground")}
              onClick={() => {
                if (filter.id === option.id) return;
                setFilter(option);
                setSelection(new Set());
              }}
            >
              {option.label}
              <span className="font-normal text-muted-foreground">
                {option.zones.reduce((count, zone) => count + (zone === "resubmission" ? 0 : zones[zone].length), 0)}
              </span>
            </Button>
          ))}
        </div>
        {modeControls}
        <div role="group" aria-label="Aufgabenwerkzeuge" className="flex items-center gap-1">
          {[
            { label: "Posteingang → Aufgabe", Icon: Inbox, action: () => setIntakeOpen(true) },
            { label: "Wochenreview", Icon: ListChecks, action: () => setReviewOpen(true) },
            { label: "Freigabe-SLA", Icon: Gauge, action: () => setSlaOpen(true) },
            { label: "Befehlspalette (Strg+J)", Icon: CommandIcon, action: () => setPaletteOpen(true) },
          ].map(({ label, Icon, action }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="rounded-xl" aria-label={label} onClick={action}><Icon /></Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 lg:auto-rows-auto lg:grid-cols-[minmax(260px,1fr)_minmax(0,3fr)]">
        <div className="flex min-h-0 min-w-0 flex-col">
            <div className="h-80 min-h-0 lg:h-auto lg:flex-1">
              <TaskTriageList resubmissionsOpen={resubmissionsOpen} onResubmissionsOpenChange={setResubmissionsOpen} snoozes={snoozes} onCreate={onCreate} onComplete={onComplete} zones={zones} visibleZones={filter.zones} selectedId={selected?.id ?? null} onSelect={setSelectedId} decisionLabel={decisionLabel} nameOf={nameOf} selection={selection} onToggleSelect={toggleSelect} onSelectAll={(ids) => setSelection(new Set(ids))} onClearSelection={() => setSelection(new Set())} onBatch={requestBatch} />
            </div>
          </div>
          <div className="min-h-0 min-w-0 flex flex-col">
            {!selected && <EmptyState icon={ListTodo} title="Keine Aufgaben in dieser Ansicht" />}
            {selected && (
              <TaskDetailView
                key={selected.id}
                task={selected}
                profiles={profiles}
                decisionLabel={decisionLabel(selected.id)}
                nameOf={nameOf}
                meId={userId}
                pendingVote={pendingVoteFor(selected.id)}
                onVote={(key, comment) => { const pv = pendingVoteFor(selected.id); return pv ? vote(pv.participantId, pv.decisionId, key, comment) : Promise.resolve(); }}
                onNudge={(n) => nudge(selected, n)}
                onAckNudge={(r) => ackNudge(selected, r)}
                onSave={async (p) => { await save(selected, p); }}
                onComplete={async () => {
                  const evts = stafetteEvents(selected, { ...selected, status: "completed" }, { actorName: nameOf(userId) });
                  await supabase.from("tasks").update({ timeline: [...parseTaskTimeline(selected.timeline), ...evts] as unknown as Json }).eq("id", selected.id);
                  await onComplete(selected.id);
                }}
                onDecision={() => onDecision(selected.id)}
                onJourFixe={() => onJourFixe(selected.id)}
                registerShortcuts={(h) => { shortcuts.current = h; }}
              />
            )}
          </div>
        </div>
      <TaskBatchDialog
        preview={batchRequest?.preview ?? null}
        pending={batchPending}
        onCancel={() => { if (!batchPending) setBatchRequest(null); }}
        onConfirm={() => { void applyBatch(); }}
      />
      <TaskIntakeDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        tenantId={selected?.tenant_id ?? tasks[0]?.tenant_id}
        userId={userId}
        profiles={profiles}
        onCreated={onReload}
      />
      <TaskReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        tasks={merged}
        onOpenTask={(taskId) => { setSelectedId(taskId); setReviewOpen(false); }}
        onEscalate={escalateTask}
      />
      <TaskSlaDialog
        open={slaOpen}
        onOpenChange={setSlaOpen}
        tenantId={selected?.tenant_id ?? tasks[0]?.tenant_id}
        nameOf={nameOf}
        onOpenTask={(taskId) => { setSelectedId(taskId); setSlaOpen(false); }}
      />
      <TaskCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        taskTitle={selected?.title}
        people={profiles}
        onSubmit={(command) => { void runTaskCommand(command); }}
      />
    </>
  );
}
