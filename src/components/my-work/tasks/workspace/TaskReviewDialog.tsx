import { useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MyWorkTask } from "@/hooks/useMyWorkTasksData";
import { ballAssigneeLabel, weekReview } from "@/features/tasks/stafette";
import { AlertTriangle, ArrowUpRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: MyWorkTask[];
  onOpenTask: (taskId: string) => void;
  onEscalate: (taskId: string, note: string) => Promise<void>;
}

const VISIBLE = 6;

function Section<T>({ title, hint, items, render }: { title: string; hint: string; items: T[]; render: (item: T) => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, VISIBLE);
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">{items.length}</span></h3>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nichts zu tun.</p>
      ) : (
        <>
          <ul className="space-y-1">{visible.map(render)}</ul>
          {items.length > VISIBLE && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setExpanded((value) => !value)}>
              <ChevronDown className={cn("size-3.5", expanded && "rotate-180")} />
              {expanded ? "Weniger anzeigen" : `${items.length - VISIBLE} weitere`}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function TaskRow({ task, detail, onOpenTask }: { task: MyWorkTask; detail?: string; onOpenTask: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onOpenTask(task.id)} className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted">
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{detail ?? task.next_action ?? "Kein nächster Schritt"}</span>
      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

/** Wochenreview: Eskalationen, fehlende Schritte, namenlose Bälle, stille Aufgaben, Duplikate. */
export function TaskReviewDialog({ open, onOpenChange, tasks, onOpenTask, onEscalate }: Props) {
  const review = useMemo(() => weekReview(tasks), [tasks]);
  const [escalating, setEscalating] = useState<string | null>(null);

  const escalate = async (taskId: string) => {
    setEscalating(taskId);
    try {
      const reason = review.escalate.find((entry) => entry.task.id === taskId)?.reason ?? "";
      await onEscalate(taskId, reason);
    } finally {
      setEscalating(null);
    }
  };

  const total = review.escalate.length + review.noNextStep.length + review.noBallPerson.length + review.stalled.length + review.duplicates.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Wochenreview</DialogTitle>
          <DialogDescription>
            {total} Auffälligkeiten. Der Durchgang ändert nichts automatisch – jede Zeile öffnet die Aufgabe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Section
            title="Eskalation"
            hint="2× ohne Reaktion oder 14 Tage still"
            items={review.escalate}
            render={(entry) => (
              <li key={entry.task.id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
                <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onOpenTask(entry.task.id)}>{entry.task.title}</button>
                <span className="text-xs text-muted-foreground">{entry.reason}</span>
                <Button size="sm" variant="outline" disabled={escalating === entry.task.id} onClick={() => void escalate(entry.task.id)}>
                  {escalating === entry.task.id ? "Meldet …" : "Büroleitung informieren"}
                </Button>
              </li>
            )}
          />

          <Section
            title="Ohne nächsten Schritt"
            hint="die Aufgabe sagt nicht, was zu tun ist"
            items={review.noNextStep}
            render={(task) => <li key={task.id}><TaskRow task={task} detail="Schritt fehlt" onOpenTask={onOpenTask} /></li>}
          />

          <Section
            title="Büro ohne Person"
            hint="mehrere Personen sehen die Aufgabe als „mein Zug“"
            items={review.noBallPerson}
            render={(task) => <li key={task.id}><TaskRow task={task} detail={ballAssigneeLabel(task).label} onOpenTask={onOpenTask} /></li>}
          />

          <Section
            title="Still geworden"
            hint="seit mindestens 14 Tagen keine Bewegung"
            items={review.stalled}
            render={(task) => <li key={task.id}><TaskRow task={task} detail="lange unverändert" onOpenTask={onOpenTask} /></li>}
          />

          <Section
            title="Doppelte Titel"
            hint="gleiche Aufgabe mehrfach angelegt?"
            items={review.duplicates}
            render={(group) => (
              <li key={group.tasks[0].id} className="flex flex-wrap items-center gap-2">
                <TaskRow task={group.tasks[0]} detail={`${group.tasks.length}× gleicher Titel`} onOpenTask={onOpenTask} />
              </li>
            )}
          />
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
