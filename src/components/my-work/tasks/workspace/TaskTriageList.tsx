import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MyWorkTask } from "@/hooks/useMyWorkTasksData";
import { TASK_BALL_LABELS, type TaskBallOwner, type TaskZone } from "@/features/tasks/stafette";

interface Props {
  zones: Record<TaskZone, MyWorkTask[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  decisionLabel: (taskId: string) => string | null;
  nameOf: (id: string | null | undefined) => string | undefined;
}

const fmt = (s?: string | null) => (s ? new Date(s.slice(0, 10) + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : null);

function Row({ task, active, onSelect, sub }: { task: MyWorkTask; active: boolean; onSelect: () => void; sub: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-task-id={task.id}
      className={cn(
        "w-full text-left px-sm py-xs rounded-md transition-colors duration-fast",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
      )}
    >
      <div className="text-body font-medium truncate">{task.title}</div>
      <div className="text-caption text-muted-foreground truncate">{sub}</div>
    </button>
  );
}

export function TaskTriageList({ zones, selectedId, onSelect, decisionLabel, nameOf }: Props) {
  const [resubOpen, setResubOpen] = useState(false);

  const subFor = (t: MyWorkTask, zone: TaskZone) => {
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
          <Row key={t.id} task={t} active={t.id === selectedId} onSelect={() => onSelect(t.id)} sub={subFor(t, zone)} />
        ))
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-md p-sm">
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
            <Row key={t.id} task={t} active={t.id === selectedId} onSelect={() => onSelect(t.id)} sub={subFor(t, "resubmission")} />
          ))}
      </div>
    </div>
  );
}
