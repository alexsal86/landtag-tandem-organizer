import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { MyWorkTask } from "@/hooks/useMyWorkTasksData";
import { notify } from "@/lib/notify";
import { EmptyState } from "@/components/ui-patterns";
import { ListTodo } from "lucide-react";
import { groupByZone, isReminderDue, parseTaskTimeline, stafetteEvents, type StafetteEvent } from "@/features/tasks/stafette";
import { TaskTriageList } from "./TaskTriageList";
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
}

export function TaskStafetteWorkspace({ userId, tasks, profiles, onReload, onComplete, onDecision, onJourFixe, onCreate }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Partial<MyWorkTask>>>({});
  const shortcuts = useRef<{ stepDone: () => void; daySlip: () => void } | null>(null);

  const merged = useMemo(() => tasks.map((t) => ({ ...t, ...local[t.id] })), [tasks, local]);
  const zones = useMemo(() => groupByZone(merged, userId), [merged, userId]);
  const ordered = useMemo(() => [...zones.mine, ...zones.waiting, ...zones.resubmission], [zones]);
  const selected = merged.find((t) => t.id === selectedId) ?? ordered[0] ?? null;

  const remindedOnce = useRef(false);
  useEffect(() => {
    if (remindedOnce.current || tasks.length === 0) return;
    remindedOnce.current = true;
    const due = tasks.filter((t) => t.status !== "completed" && isReminderDue(t));
    if (due.length === 1) notify.info(`Erinnerung: ${due[0].title}`);
    else if (due.length > 1) notify.info(`${due.length} Erinnerungen fällig – sie stehen oben unter „Mein Zug“.`);
  }, [tasks]);

  const taskIds = useMemo(() => tasks.map((t) => t.id).sort(), [tasks]);
  const { data: decisions } = useQuery({
    queryKey: ["task-stafette-decisions", taskIds.join(",")],
    enabled: taskIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("task_decisions").select("task_id, status").in("task_id", taskIds);
      return data ?? [];
    },
  });

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
    if ("ball_owner" in patch) fields.ball_owner = patch.ball_owner;
    if ("ball_assignee_id" in patch) fields.ball_assignee_id = patch.ball_assignee_id;
    if ("next_action" in patch) fields.next_action = patch.next_action;
    if ("next_action_due" in patch) fields.next_action_due = patch.next_action_due;
    if ("reminder_at" in patch) fields.reminder_at = patch.reminder_at;
    if ("reminder_note" in patch) fields.reminder_note = patch.reminder_note;
    const after = { ...task, ...fields };
    const events: StafetteEvent[] = stafetteEvents(task, after, { actorName: nameOf(userId), nameOf: (id) => nameOf(id) });
    if (note) events.push({ id: `${Date.now()}-n`, type: "note", at: new Date().toISOString(), actorName: nameOf(userId), text: note });
    const timeline = [...parseTaskTimeline(task.timeline), ...events];
    const update = { ...fields, timeline: timeline as unknown as Json };
    setLocal((l) => ({ ...l, [task.id]: { ...l[task.id], ...fields, timeline } }));
    const { error } = await supabase.from("tasks").update(update).eq("id", task.id);
    if (error) {
      notify.error("Speichern fehlgeschlagen");
      setLocal((l) => { const n = { ...l }; delete n[task.id]; return n; });
      return;
    }
    if (fields.ball_owner === "deputy" && task.ball_owner !== "deputy") notify.success("Zur Freigabe vorgelegt");
    void onReload();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = selected ? ordered.findIndex((t) => t.id === selected.id) : -1;
      if (e.key === "j" || e.key === "ArrowDown") { const n = ordered[Math.min(idx + 1, ordered.length - 1)]; if (n) setSelectedId(n.id); e.preventDefault(); }
      else if (e.key === "k" || e.key === "ArrowUp") { const n = ordered[Math.max(idx - 1, 0)]; if (n) setSelectedId(n.id); e.preventDefault(); }
      else if (e.key === "e") shortcuts.current?.stepDone();
      else if (e.key === "t") shortcuts.current?.daySlip();
      else if (e.key === "c") { onCreate(); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered, selected, onCreate]);

  if (ordered.length === 0) {
    return <EmptyState icon={ListTodo} title="Alles erledigt" description="Keine offenen Aufgaben. Mit C legst du eine neue an." />;
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[340px_1fr] border-t">
      <div className="border-r overflow-y-auto">
        <TaskTriageList zones={zones} selectedId={selected?.id ?? null} onSelect={setSelectedId} decisionLabel={decisionLabel} nameOf={nameOf} />
      </div>
      <div className="min-h-0 flex flex-col">
        {selected && (
          <TaskDetailView
            task={selected}
            profiles={profiles}
            decisionLabel={decisionLabel(selected.id)}
            nameOf={nameOf}
            onSave={(p) => save(selected, p)}
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
  );
}
