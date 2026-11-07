import { useEffect, useState } from "react";
import { CalendarClock, Check, Gavel, Send, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { MyWorkTask } from "@/hooks/useMyWorkTasksData";
import { sendToDaySlip, formatCaseDaySlipText } from "@/lib/daySlipBridge";
import {
  TASK_BALL_LABELS, isOnResubmission, parseTaskTimeline, stepState, type StafetteTask, type TaskBallOwner,
} from "@/features/tasks/stafette";

export interface TaskPatch extends StafetteTask {
  note?: string;
}

interface Props {
  task: MyWorkTask;
  profiles: Array<{ user_id: string; display_name: string | null }>;
  decisionLabel: string | null;
  onSave: (patch: TaskPatch) => Promise<void>;
  onComplete: () => Promise<void>;
  onDecision: () => void;
  onJourFixe: () => void;
  nameOf: (id: string | null | undefined) => string | undefined;
  registerShortcuts: (h: { stepDone: () => void; daySlip: () => void }) => void;
}

const OWNERS: TaskBallOwner[] = ["office", "deputy", "external"];

export function TaskDetailView({ task, profiles, decisionLabel, onSave, onComplete, onDecision, onJourFixe, nameOf, registerShortcuts }: Props) {
  const [label, setLabel] = useState(task.next_action ?? "");
  const [due, setDue] = useState(task.next_action_due ?? "");
  const [owner, setOwner] = useState<TaskBallOwner>((task.ball_owner ?? "office") as TaskBallOwner);
  const [assignee, setAssignee] = useState<string>(task.ball_assignee_id ?? "none");
  const [note, setNote] = useState("");
  const [doneDialog, setDoneDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLabel(task.next_action ?? "");
    setDue(task.next_action_due ?? "");
    setOwner((task.ball_owner ?? "office") as TaskBallOwner);
    setAssignee(task.ball_assignee_id ?? "none");
    setNote("");
  }, [task.id, task.next_action, task.next_action_due, task.ball_owner, task.ball_assignee_id]);

  const hasStep = stepState(task) === "set";
  const timeline = parseTaskTimeline(task.timeline).slice().reverse();
  const resub = isOnResubmission(task);

  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    try { await fn(); } finally { setSaving(false); }
  };

  const setStep = () =>
    run(() => onSave({ next_action: label.trim() || null, next_action_due: due || null, ball_owner: owner, ball_assignee_id: assignee === "none" ? null : assignee }));
  const daySlip = () =>
    sendToDaySlip({ text: formatCaseDaySlipText(task.title, task.next_action), source: { type: "task", id: task.id, nextActionLabel: task.next_action ?? undefined } });

  useEffect(() => {
    registerShortcuts({ stepDone: () => (hasStep ? setDoneDialog(true) : undefined), daySlip });
  });

  return (
    <div className="flex flex-col gap-md p-md overflow-y-auto">
      <div className="space-y-xs">
        <div className="flex items-start justify-between gap-sm">
          <h2 className="text-h2">{task.title}</h2>
          {task.priority === "high" || task.priority === "urgent" ? <Badge variant="destructive">Dringend</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-xs">
          {decisionLabel && <Badge variant="secondary"><Gavel className="h-3 w-3 mr-1" />{decisionLabel}</Badge>}
          {task.pending_for_jour_fixe && <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />Jour Fixe</Badge>}
        </div>
        {task.description && <p className="text-body text-muted-foreground whitespace-pre-wrap line-clamp-4">{task.description}</p>}
      </div>

      <section className="rounded-lg border p-md space-y-sm">
        <div className="section-label">Wer ist am Zug?</div>
        <div className="flex flex-wrap gap-xs">
          {OWNERS.map((o) => (
            <Button key={o} size="sm" variant={owner === o ? "default" : "outline"} onClick={() => setOwner(o)}>
              {TASK_BALL_LABELS[o]}
            </Button>
          ))}
        </div>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Verantwortlich" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Keine Person festgelegt</SelectItem>
            {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name ?? "Unbenannt"}</SelectItem>)}
          </SelectContent>
        </Select>

        {resub && (
          <div className="rounded-md bg-muted px-sm py-xs text-caption">
            Auf Wiedervorlage bis {new Date(task.next_action_due + "T00:00:00").toLocaleDateString("de-DE")}. Erledige den Schritt, um einen neuen festzulegen.
          </div>
        )}

        <div className="section-label pt-xs">Nächster Schritt</div>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Was ist konkret als Nächstes zu tun?" disabled={hasStep} />
        <div className="flex items-center gap-xs">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 w-44" />
        </div>
        <div className="flex flex-wrap gap-xs pt-xs">
          {hasStep ? (
            <Button size="sm" disabled={saving} onClick={() => setDoneDialog(true)}><Check className="h-4 w-4 mr-1" />Schritt erledigt</Button>
          ) : (
            <Button size="sm" disabled={saving || !label.trim()} onClick={setStep}>Schritt festlegen</Button>
          )}
          {hasStep && (
            <Button size="sm" variant="outline" disabled={saving} onClick={setStep}>Änderungen speichern</Button>
          )}
          {owner === "office" && (
            <Button size="sm" variant="secondary" disabled={saving}
              onClick={() => run(() => onSave({ ball_owner: "deputy", ball_assignee_id: null, next_action: "Freigabe prüfen", next_action_due: null }))}>
              <Send className="h-4 w-4 mr-1" />Zur Freigabe vorlegen
            </Button>
          )}
        </div>
      </section>

      <section className="flex flex-wrap gap-xs border-b pb-md">
        <Button size="sm" variant="ghost" onClick={daySlip}><Zap className="h-4 w-4 mr-1" />Auf Tageszettel</Button>
        <Button size="sm" variant="ghost" onClick={onJourFixe}><Users className="h-4 w-4 mr-1" />Auf Jour Fixe</Button>
        <Button size="sm" variant="ghost" onClick={onDecision}><Gavel className="h-4 w-4 mr-1" />Entscheidung anfordern</Button>
      </section>

      <section className="space-y-sm">
        <div className="section-label">Verlauf</div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz zum aktuellen Stand…" rows={2} />
        <div className="flex justify-end">
          <Button size="sm" variant="outline" disabled={!note.trim() || saving} onClick={() => run(async () => { await onSave({ note: note.trim() }); setNote(""); })}>
            Notiz speichern
          </Button>
        </div>
        <ul className="space-y-xs">
          {timeline.length === 0 && <li className="text-caption text-muted-foreground">Noch keine Einträge</li>}
          {timeline.map((e) => (
            <li key={e.id} className={cn("text-caption", e.type === "system" ? "text-muted-foreground" : "text-foreground")}>
              <span className="tabular-nums">{new Date(e.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
              {e.actorName ? ` · ${e.actorName}` : ""}: {e.text}
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={doneDialog} onOpenChange={setDoneDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schritt „{task.next_action}“ erledigt</DialogTitle></DialogHeader>
          <p className="text-body text-muted-foreground">Ist die Aufgabe damit fertig, oder gibt es einen Folgeschritt?</p>
          <DialogFooter className="gap-xs">
            <Button variant="outline" onClick={() => run(async () => { setDoneDialog(false); await onSave({ next_action: null, next_action_due: null, ball_owner: "office" }); setLabel(""); setDue(""); })}>
              Folgeschritt festlegen
            </Button>
            <Button onClick={() => run(async () => { setDoneDialog(false); await onSave({ next_action: null, next_action_due: null }); await onComplete(); })}>
              Aufgabe abschließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
