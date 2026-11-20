import { VirtualList } from "@/components/shared/VirtualList";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { differenceInCalendarDays, endOfWeek, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { MyWorkTask } from "@/hooks/useMyWorkTasksData";
import { isReminderDue, TASK_BALL_LABELS, type TaskBallOwner, type TaskZone } from "@/features/tasks/stafette";

interface Props {
  zones: Record<TaskZone, MyWorkTask[]>;
  visibleZones: readonly TaskZone[];
  snoozes: Record<string, string>;
  onCreate: () => void;
  onComplete: (id: string) => void | Promise<void>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  decisionLabel: (taskId: string) => string | null;
  nameOf: (id: string | null | undefined) => string | undefined;
  selection: Set<string>;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onBatch: (kind: "deputy" | "week" | "nudge") => Promise<void>;
}

export function TaskTriageList({ zones, visibleZones, snoozes, onCreate, onComplete, selectedId, onSelect, decisionLabel, nameOf, selection, onToggleSelect, onClearSelection, onBatch }: Props) {
  const [busy, setBusy] = useState(false);
  const runBatch = async (k: "deputy" | "week" | "nudge") => { setBusy(true); try { await onBatch(k); } finally { setBusy(false); } };
  const [query, setQuery] = useState("");

  const subFor = (t: MyWorkTask, zone: TaskZone) => {
    if (zone === "nudged") {
      const n = t.nudge_count && t.nudge_count > 1 ? `${t.nudge_count}× angestupst` : "Angestupst";
      return [`${n} von ${nameOf(t.nudged_by) ?? "Kolleg:in"}`, t.nudge_note].filter(Boolean).join(" · ");
    }
    if (isReminderDue(t)) return ["🔔 Erinnerung", t.reminder_note || t.next_action || null].filter(Boolean).join(" · ");
    const step = t.next_action?.trim() ? t.next_action : "Kein nächster Schritt";
    if (zone === "waiting") {
      const owner = (t.ball_owner ?? "office") as TaskBallOwner;
      const who = owner === "office" ? nameOf(t.ball_assignee_id) ?? "Büro" : TASK_BALL_LABELS[owner];
      const dec = decisionLabel(t.id);
      return [`Ball: ${who}`, dec].filter(Boolean).join(" · ");
    }
    return step;
  };

  const today = startOfDay(new Date());
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const sections = [
    { key: "overdue", title: "Überfällig" },
    { key: "week", title: "Diese Woche" },
    { key: "later", title: "Später" },
  ];
  const tasks = visibleZones.flatMap((zone) => zones[zone].map((task) => {
    const date = snoozes[task.id] || task.next_action_due || task.due_date;
    const due = date ? new Date(date.slice(0, 10) + "T00:00:00") : null;
    const group = due && due < today ? "overdue" : due && due <= weekEnd ? "week" : "later";
    return { task, zone, due, group };
  })).filter(({ task }) => task.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
  const entries = sections.flatMap(({ key, title }) => {
    const items = tasks.filter((item) => item.group === key);
    if (!items.length) return [];
    return [
      { key, title, count: items.length, item: null as (typeof tasks)[number] | null },
      ...items.map((item) => ({ key: item.task.id, title, count: items.length, item })),
    ];
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex shrink-0 items-center gap-2 px-2 py-3">
        <Button size="icon" variant="ghost" onClick={onCreate} aria-label="Neue Aufgabe"><Plus /></Button>
        <div className="relative min-w-0 flex-1">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Neue Aufgabe oder suchen …" aria-label="Aufgaben suchen" className="border-0 bg-transparent shadow-none" onKeyDown={(event) => { if (event.key === "Enter" && !tasks.length) onCreate(); }} />
        </div>
      </div>
      {selection.size > 0 && (
        <div className="shrink-0 rounded-lg border bg-popover p-3 shadow-md space-y-2">
          <div className="flex items-center justify-between text-caption">
            <span className="font-medium">{selection.size} ausgewählt</span>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClearSelection}>Aufheben</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => runBatch("deputy")}>Zur Freigabe vorlegen</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => runBatch("week")}>Frist +1 Woche</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => runBatch("nudge")}>Anstupsen</Button>
          </div>
        </div>
      )}
      <VirtualList
        className="min-h-0 flex-1"
        items={entries}
        estimateSize={64}
        getItemKey={(entry) => entry.key}
        renderItem={({ key, title, count, item }) => {
          if (!item) return <div className={cn("px-3 pb-2 pt-6 text-sm font-semibold", key === "overdue" ? "text-destructive" : "text-muted-foreground")}>{title} <span className="ml-2">{count}</span></div>;
          const { task, zone, due, group } = item;
          const days = due ? differenceInCalendarDays(today, due) : 0;
          const resubmission = !!snoozes[task.id] || zone === "resubmission";
          return (
            <div className={cn("flex items-start gap-3 rounded-xl border-l-2 border-transparent px-3 py-3", task.id === selectedId ? "border-l-foreground bg-muted" : "hover:bg-muted/60")}>
              <button type="button" onClick={() => void onComplete(task.id)} aria-label={`„${task.title}“ abschließen`} className="mt-1 h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/50 hover:border-foreground" />
              <button type="button" onClick={(event) => event.shiftKey || event.metaKey || event.ctrlKey ? onToggleSelect(task.id) : onSelect(task.id)} aria-current={task.id === selectedId ? "true" : undefined} aria-pressed={selection.has(task.id)} className="min-w-0 flex-1 text-left">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium leading-5">{task.title}</span>
                  {due && <span className={cn("shrink-0 text-xs", group === "overdue" ? "text-destructive" : "text-muted-foreground")}>{days > 0 ? `${days} ${days === 1 ? "Tag" : "Tage"} überfällig` : due.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</span>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{resubmission ? "Wiedervorlage · " : ""}{subFor(task, zone)}</div>
              </button>
            </div>
          );
        }}
      />
    </div>
  );
}
