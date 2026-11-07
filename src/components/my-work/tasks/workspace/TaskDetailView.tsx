import { WorkflowLinks } from "@/components/workflow/WorkflowLinks";
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, CalendarClock, Check, ListChecks, Plus, X, Gavel, Send, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { MyWorkTask } from "@/hooks/useMyWorkTasksData";
import { TaskSubtasks, TaskRecurrence } from "./TaskSubtasks";
import { sendToDaySlip, formatCaseDaySlipText } from "@/lib/daySlipBridge";
import {
  TASK_BALL_LABELS, canNudge, checklistProgress, isNudgeActive, isOnResubmission, isReminderDue, parseChecklist, reminderPreset, type ChecklistItem, parseTaskTimeline, stepState, type StafetteTask, type TaskBallOwner,
} from "@/features/tasks/stafette";

export interface TaskPatch extends StafetteTask {
  note?: string;
  checklist?: ChecklistItem[];
}

export interface PendingVote {
  title: string;
  options: Array<{ key: string; label: string; requiresComment: boolean }>;
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
  meId?: string;
  onNudge: (note: string) => Promise<void>;
  onAckNudge: (reply: string) => Promise<void>;
  pendingVote: PendingVote | null;
  onVote: (key: string, comment: string) => Promise<void>;
  onReload: () => void;
}

const OWNERS: TaskBallOwner[] = ["office", "deputy", "external"];

export function TaskDetailView({ task, profiles, decisionLabel, onSave, onComplete, onDecision, onJourFixe, nameOf, registerShortcuts, meId, onNudge, onAckNudge, pendingVote, onVote, onReload }: Props) {
  const [label, setLabel] = useState(task.next_action ?? "");
  const [due, setDue] = useState(task.next_action_due ?? "");
  const [owner, setOwner] = useState<TaskBallOwner>((task.ball_owner ?? "office") as TaskBallOwner);
  const [assignee, setAssignee] = useState<string>(task.ball_assignee_id ?? "none");
  const [note, setNote] = useState("");
  const [doneDialog, setDoneDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remNote, setRemNote] = useState("");
  const [remAt, setRemAt] = useState("");
  const [nudgeNote, setNudgeNote] = useState("");
  const [reply, setReply] = useState("");
  const [newItem, setNewItem] = useState("");
  const [voteComment, setVoteComment] = useState("");
  const checklist = parseChecklist(task.checklist);
  const progress = checklistProgress(checklist);
  const nudgeForMe = isNudgeActive(task) && task.nudged_by !== meId;
  const mayNudge = canNudge(task, meId);
  const saveList = (items: ChecklistItem[]) => run(() => onSave({ checklist: items }));
  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setNewItem("");
    void saveList([...checklist, { id: crypto.randomUUID(), text, done: false }]);
  };

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
        <WorkflowLinks taskId={task.id} />
        <TaskRecurrence taskId={task.id} value={task.recurrence_rule} onChanged={onReload} />
        {task.description && <p className="text-body text-muted-foreground whitespace-pre-wrap line-clamp-4">{task.description}</p>}
      </div>

      {nudgeForMe && (
        <section className="rounded-lg border-2 border-primary bg-primary/10 p-md space-y-sm" role="alert">
          <div className="flex items-center gap-xs text-body font-medium">
            <BellRing className="h-4 w-4 text-primary" />
            {nameOf(task.nudged_by) ?? "Jemand"} hat dich angestupst
            {task.nudge_count && task.nudge_count > 1 ? <Badge variant="secondary">{task.nudge_count}×</Badge> : null}
          </div>
          <div className="text-caption text-muted-foreground">
            {task.nudged_at ? new Date(task.nudged_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : ""}
            {task.nudge_note ? ` – „${task.nudge_note}“` : ""}
          </div>
          <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Kurze Antwort (optional)" className="h-8" />
          <div className="flex gap-xs">
            <Button size="sm" disabled={saving} onClick={() => run(async () => { await onAckNudge(""); })}>Gesehen</Button>
            <Button size="sm" variant="outline" disabled={saving || !reply.trim()} onClick={() => run(async () => { await onAckNudge(reply.trim()); setReply(""); })}>Antworten</Button>
          </div>
        </section>
      )}

      {pendingVote && (
        <section className="rounded-lg border-2 border-primary p-md space-y-sm">
          <div className="section-label flex items-center gap-xs"><Gavel className="h-3.5 w-3.5" />Deine Stimme ist gefragt</div>
          <div className="text-body font-medium">{pendingVote.title}</div>
          <Input value={voteComment} onChange={(e) => setVoteComment(e.target.value)} placeholder="Kommentar (bei Rückfrage nötig)" className="h-8" />
          <div className="flex flex-wrap gap-xs">
            {pendingVote.options.map((o) => (
              <Button key={o.key} size="sm" variant={o.key === "yes" ? "default" : "outline"} disabled={saving || (o.requiresComment && !voteComment.trim())}
                onClick={() => run(async () => { await onVote(o.key, voteComment.trim()); setVoteComment(""); })}>
                {o.label}
              </Button>
            ))}
          </div>
        </section>
      )}

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
        {mayNudge && (
          <div className="flex gap-xs pt-xs border-t">
            <Input value={nudgeNote} onChange={(e) => setNudgeNote(e.target.value)} placeholder="Nachricht zum Anstupsen (optional)" className="h-8" />
            <Button size="sm" variant="outline" disabled={saving} onClick={() => run(async () => { await onNudge(nudgeNote.trim()); setNudgeNote(""); })}>
              <BellRing className="h-4 w-4 mr-1" />Anstupsen
            </Button>
          </div>
        )}
        {!mayNudge && task.nudged_by === meId && isNudgeActive(task) && (
          <div className="text-caption text-muted-foreground pt-xs border-t">Heute bereits angestupst – noch nicht gesehen.</div>
        )}
      </section>

      <TaskSubtasks taskId={task.id} tenantId={task.tenant_id} userId={meId} nameOf={nameOf} profiles={profiles} />

      <section className="rounded-lg border p-md space-y-sm">
        <div className="section-label flex items-center gap-xs"><ListChecks className="h-3.5 w-3.5" />Checkliste{progress.total ? ` (${progress.done}/${progress.total})` : ""}</div>
        <ul className="space-y-2xs">
          {checklist.map((item) => (
            <li key={item.id} className="group flex items-center gap-xs">
              <Checkbox checked={item.done} disabled={saving} aria-label={item.text}
                onCheckedChange={() => saveList(checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))} />
              <span className={cn("flex-1 text-body", item.done && "line-through text-muted-foreground")}>{item.text}</span>
              <button type="button" aria-label="Punkt entfernen" className="opacity-0 group-hover:opacity-100 text-muted-foreground"
                onClick={() => saveList(checklist.filter((i) => i.id !== item.id))}><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-xs">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
            placeholder="Punkt hinzufügen, Enter für den nächsten" className="h-8" />
        </div>
      </section>

      <section className="rounded-lg border p-md space-y-sm">
        <div className="section-label flex items-center gap-xs"><Bell className="h-3.5 w-3.5" />Mich erinnern</div>
        {task.reminder_at ? (
          <div className={cn("rounded-md px-sm py-xs text-caption flex items-center justify-between gap-sm", isReminderDue(task) ? "bg-accent text-accent-foreground" : "bg-muted")}>
            <span>
              {isReminderDue(task) ? "Fällig seit " : "Am "}
              {new Date(task.reminder_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
              {task.reminder_note ? ` – ${task.reminder_note}` : ""}
            </span>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => run(() => onSave({ reminder_at: null, reminder_note: null }))}>
              <BellOff className="h-4 w-4 mr-1" />Erledigt
            </Button>
          </div>
        ) : (
          <>
            <Input value={remNote} onChange={(e) => setRemNote(e.target.value)} placeholder="Woran erinnern? (optional, z. B. „Beim Ministerium nachfassen“)" className="h-8" />
            <div className="flex flex-wrap gap-xs">
              {([["tomorrow", "Morgen"], ["3days", "In 3 Tagen"], ["nextweek", "Nächste Woche"]] as const).map(([k, l]) => (
                <Button key={k} size="sm" variant="outline" disabled={saving}
                  onClick={() => run(async () => { await onSave({ reminder_at: reminderPreset(k).toISOString(), reminder_note: remNote.trim() || null }); setRemNote(""); })}>
                  {l}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-xs">
              <Input type="datetime-local" value={remAt} onChange={(e) => setRemAt(e.target.value)} className="h-8 w-56" aria-label="Eigene Uhrzeit" />
              <Button size="sm" variant="outline" disabled={saving || !remAt}
                onClick={() => run(async () => { await onSave({ reminder_at: new Date(remAt).toISOString(), reminder_note: remNote.trim() || null }); setRemNote(""); setRemAt(""); })}>
                Setzen
              </Button>
            </div>
          </>
        )}
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
