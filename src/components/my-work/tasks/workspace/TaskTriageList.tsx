import { useState } from "react";
import { BellRing, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { MyWorkTask } from "@/hooks/useMyWorkTasksData";
import { isReminderDue, TASK_BALL_LABELS, type TaskBallOwner, type TaskZone } from "@/features/tasks/stafette";

interface Props {
  zones: Record<TaskZone, MyWorkTask[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  decisionLabel: (taskId: string) => string | null;
  nameOf: (id: string | null | undefined) => string | undefined;
  selection: Set<string>;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onBatch: (kind: "deputy" | "week" | "nudge") => Promise<void>;
}

const fmt = (s?: string | null) => (s ? new Date(s.slice(0, 10) + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : null);

function Row({ task, active, onSelect, sub, checked, onCheck, highlight }: { task: MyWorkTask; active: boolean; onSelect: () => void; sub: string; checked: boolean; onCheck: () => void; highlight?: boolean }) {
  return (
    <div className={cn(
      "group flex items-start gap-xs px-sm py-xs rounded-md transition-colors duration-fast",
      highlight && "border-l-2 border-primary bg-primary/10",
      active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
    )}>
      <Checkbox
        checked={checked}
        onCheckedChange={onCheck}
        aria-label={`${task.title} auswählen`}
        className={cn("mt-1 transition-opacity", checked ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}
      />
      <button
        type="button"
        onClick={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? onCheck() : onSelect())}
        data-task-id={task.id}
        className="flex-1 min-w-0 text-left"
      >
        <div className="text-body font-medium truncate">{task.title}</div>
        <div className="text-caption text-muted-foreground truncate">{sub}</div>
      </button>
    </div>
  );
}

export function TaskTriageList({ zones, selectedId, onSelect, decisionLabel, nameOf, selection, onToggleSelect, onClearSelection, onBatch }: Props) {
  const [busy, setBusy] = useState(false);
  const runBatch = async (k: "deputy" | "week" | "nudge") => { setBusy(true); try { await onBatch(k); } finally { setBusy(false); } };
  const [resubOpen, setResubOpen] = useState(false);

  const subFor = (t: MyWorkTask, zone: TaskZone) => {
    if (zone === "nudged") {
      const n = t.nudge_count && t.nudge_count > 1 ? `${t.nudge_count}× angestupst` : "Angestupst";
      return [`${n} von ${nameOf(t.nudged_by) ?? "Kolleg:in"}`, t.nudge_note].filter(Boolean).join(" · ");
    }
    if (isReminderDue(t)) return ["🔔 Erinnerung", t.reminder_note || t.next_action || null].filter(Boolean).join(" · ");
    const step = t.next_action?.trim() ? t.next_action : "kein nächster Schritt";
    const due = fmt(t.next_action_due ?? t.due_date);
    if (zone === "waiting") {
      const owner = (t.ball_owner ?? "office") as TaskBallOwner;
      const who = owner === "office" ? nameOf(t.ball_assignee_id) ?? "Büro" : TASK_BALL_LABELS[owner];
      const dec = decisionLabel(t.id);
      return [`Ball: ${who}`, dec, due].filter(Boolean).join(" · ");
    }
    return [step, due].filter(Boolean).join(" · ");
  };

  const section = (zone: TaskZone, title: string) => (
    <div className="space-y-2xs">
      <div className="section-label px-sm">{title} ({zones[zone].length})</div>
      {zones[zone].length === 0 ? (
        <div className="px-sm text-caption text-muted-foreground">Nichts offen</div>
      ) : (
        zones[zone].map((t) => (
          <Row key={t.id} task={t} active={t.id === selectedId} onSelect={() => onSelect(t.id)} sub={subFor(t, zone)} checked={selection.has(t.id)} onCheck={() => onToggleSelect(t.id)} highlight={zone === "nudged"} />
        ))
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-md p-sm">
      {selection.size > 0 && (
        <div className="sticky top-0 z-sticky rounded-lg border bg-popover p-sm shadow-md space-y-xs">
          <div className="flex items-center justify-between text-caption">
            <span className="font-medium">{selection.size} ausgewählt</span>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClearSelection}>Aufheben</button>
          </div>
          <div className="flex flex-wrap gap-xs">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => runBatch("deputy")}>Zur Freigabe vorlegen</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => runBatch("week")}>Frist +1 Woche</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => runBatch("nudge")}>Anstupsen</Button>
          </div>
        </div>
      )}
      {zones.nudged.length > 0 && (
        <div className="space-y-2xs">
          <div className="section-label px-sm flex items-center gap-xs text-primary"><BellRing className="h-3.5 w-3.5" />Angestupst ({zones.nudged.length})</div>
          {zones.nudged.map((t) => (
            <Row key={t.id} task={t} active={t.id === selectedId} onSelect={() => onSelect(t.id)} sub={subFor(t, "nudged")} checked={selection.has(t.id)} onCheck={() => onToggleSelect(t.id)} highlight />
          ))}
        </div>
      )}
      {section("mine", "Mein Zug")}
      {section("waiting", "Wartet auf andere")}
      <div className="space-y-2xs border-t pt-sm">
        <button
          type="button"
          onClick={() => setResubOpen((o) => !o)}
          className="section-label px-sm flex items-center gap-xs w-full text-left"
          aria-expanded={resubOpen}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !resubOpen && "-rotate-90")} />
          Wiedervorlage ({zones.resubmission.length})
        </button>
        {resubOpen &&
          zones.resubmission.map((t) => (
            <Row key={t.id} task={t} active={t.id === selectedId} onSelect={() => onSelect(t.id)} sub={subFor(t, "resubmission")} checked={selection.has(t.id)} onCheck={() => onToggleSelect(t.id)} />
          ))}
      </div>
    </div>
  );
}
