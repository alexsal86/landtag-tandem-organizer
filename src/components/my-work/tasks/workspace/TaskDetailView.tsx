import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { usePersistentState } from "@/hooks/usePersistentState";
import { WorkflowLinks } from "@/components/workflow/WorkflowLinks";
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, CalendarDays, Check, ListChecks, Plus, X, Gavel, Send, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MyWorkTask } from "@/hooks/useMyWorkTasksData";
import { TaskSubtasks, TaskRecurrence } from "./TaskSubtasks";
import { sendToDaySlip, formatCaseDaySlipText } from "@/lib/daySlipBridge";
import {
  TASK_BALL_LABELS, canNudge, checklistProgress, isNudgeActive, isOnResubmission, isReminderDue, parseChecklist, reminderPreset, type ChecklistItem, parseTaskTimeline, shiftDay, stepState, type StafetteTask, type TaskBallOwner,
} from "@/features/tasks/stafette";

export interface TaskPatch extends StafetteTask {
  note?: string;
  ball_external_label?: string | null;
  checklist?: ChecklistItem[];
}

export interface PendingVote {
  title: string;
  options: Array<{ key: string; label: string; requiresComment: boolean }>;
}

interface Props {
  task: MyWorkTask;
  profiles: Array<{ user_id: string; display_name: string | null; avatar_url?: string | null }>;
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


const ownerColors = { office: "bg-success", deputy: "bg-pink-600", external: "bg-muted-foreground" };
const priorityLabels: Record<string, string> = { low: "Niedrig", medium: "Mittel", high: "Hoch", urgent: "Dringend" };
const datePresets = [["Heute", 0], ["Morgen", 1], ["In 3 Tagen", 3], ["Nächste Woche", 7]] as const;
const formatDate = (date: string) => new Date(date.slice(0, 10) + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

export function TaskDetailView({ task, profiles, decisionLabel, onSave, onComplete, onDecision, onJourFixe, nameOf, registerShortcuts, meId, onNudge, onAckNudge, pendingVote, onVote, onReload }: Props) {
  const [label, setLabel] = useState(task.next_action ?? "");
  const [due, setDue] = useState(task.next_action_due ?? "");
  const [owner, setOwner] = useState<TaskBallOwner>((task.ball_owner ?? "office") as TaskBallOwner);
  const [assignee, setAssignee] = useState<string>(task.ball_assignee_id ?? "none");
  const [externalLabel, setExternalLabel] = useState(task.ball_external_label ?? "");
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [recentOwners, setRecentOwners] = usePersistentState<string[]>(
    `task-recent-owners-${task.tenant_id}-${meId}`, [],
  );
  const [customField, setCustomField] = useState<"date" | null>(null);
  const [externalDraft, setExternalDraft] = useState("");
  const [customValue, setCustomValue] = useState("");
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
    setExternalLabel(task.ball_external_label ?? "");
    setNote("");
  }, [task.id, task.next_action, task.next_action_due, task.ball_owner, task.ball_assignee_id, task.ball_external_label]);

  const hasStep = stepState(task) === "set";
  const timeline = parseTaskTimeline(task.timeline).slice().reverse();
  const resub = isOnResubmission(task);

  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    try { await fn(); } finally { setSaving(false); }
  };

  const setStep = () =>
    run(() => onSave({ next_action: label.trim() || null, next_action_due: due || null, ball_owner: owner, ball_assignee_id: owner === "office" && assignee !== "none" ? assignee : null, ball_external_label: owner === "external" ? externalLabel || null : null }));
  const ownerOptions = [
    ...profiles.map((profile) => ({ id: `office:${profile.user_id}`, label: profile.display_name ?? "Unbenannt", role: "office" as const })),
    { id: "office:none", label: "Ohne feste Person", role: "office" as const },
    { id: "deputy", label: TASK_BALL_LABELS.deputy, role: "deputy" as const },
    ...["Fraktion", "Ministerium", "Extern"].map((label) => ({ id: `external:${label}`, label, role: "external" as const })),
  ];
  const rememberOwner = (id: string) =>
    setRecentOwners([id, ...recentOwners.filter((recent) => recent !== id)].slice(0, 3));
  const recentOptions = recentOwners.flatMap((id) => {
    const option = ownerOptions.find((option) => option.id === id);
    if (option) return [option];
    return id.startsWith("custom:") ? [{ id, label: id.slice(7), role: "external" as const }] : [];
  });
  const chooseOwner = (option: (typeof ownerOptions)[number]) => {
    setOwner(option.role);
    if (option.role === "office") setAssignee(option.id.slice(7));
    if (option.role === "external") setExternalLabel(option.id === "external:Extern" ? "" : option.label);
    rememberOwner(option.id);
    setOwnerPickerOpen(false);
  };
  const renderOwnerOption = (option: (typeof ownerOptions)[number], recent = false) => {
    const profile = option.role === "office" ? profiles.find(({ user_id }) => option.id === `office:${user_id}`) : undefined;
    const initials = option.role === "deputy" ? "MdL" : option.label.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
    return (
      <CommandItem key={option.id} value={recent ? `recent:${option.id}` : option.id}
        keywords={[option.label, TASK_BALL_LABELS[option.role]]}
        onSelect={() => chooseOwner(option)}
        className="gap-3 rounded-xl px-3 py-3 data-[selected=true]:bg-[#f2f2ef] data-[selected=true]:text-foreground dark:data-[selected=true]:bg-muted">
        <Avatar className="size-8" aria-hidden="true">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />}
          <AvatarFallback className="bg-[#f0f0ed] text-xs font-semibold dark:bg-muted">{initials}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 break-words">{option.label}</span>
        <span className="text-xs text-muted-foreground">{TASK_BALL_LABELS[option.role]}</span>
      </CommandItem>
    );
  };

  const daySlip = () =>
    sendToDaySlip({ text: formatCaseDaySlipText(task.title, task.next_action), source: { type: "task", id: task.id, nextActionLabel: task.next_action ?? undefined } });

  useEffect(() => {
    registerShortcuts({ stepDone: () => (hasStep ? setDoneDialog(true) : undefined), daySlip });
  });

  return (
    <div className="grid min-h-0 min-w-0 flex-1 auto-rows-max grid-cols-1  min-[1440px]:grid-cols-[minmax(0,1fr)_300px] min-[1440px]:auto-rows-auto ">
      <main aria-label="Aufgabendetails" className="min-h-0 min-w-0 space-y-5 bg-white p-6 dark:bg-card [&>section]:space-y-3 [&_input]:border-0 [&_input]:bg-transparent [&_textarea]:border-0 [&_textarea]:bg-transparent [&_[role=combobox]]:border-0 [&_[role=combobox]]:bg-transparent">
        <header className="relative space-y-4 border-b pb-7 pl-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" disabled={saving}
                aria-label="Aufgabe abschließen" onClick={() => void run(onComplete)}
                className="group absolute left-0 top-1 size-7 rounded-full border-2 border-muted-foreground/50 hover:border-success hover:bg-success/10 hover:text-success">
                <Check className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aufgabe abschließen</TooltipContent>
          </Tooltip>
          <h2 className="break-words text-3xl font-bold leading-tight tracking-tight">{task.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={ownerPickerOpen} onOpenChange={(open) => {
              setOwnerPickerOpen(open);
              if (open) setExternalDraft(owner === "external" ? externalLabel : "");
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-full rounded-full bg-transparent">
                  <span className={cn("size-2 shrink-0 rounded-full", ownerColors[owner])} />
                  <span className="text-muted-foreground">Am Zug</span>
                  <span className="truncate">
                    {(owner === "office" && nameOf(assignee)) || (owner === "external" && externalLabel) || TASK_BALL_LABELS[owner]}
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
                <DialogTitle className="sr-only">Wem übergeben?</DialogTitle>
                <Command>
                  <CommandInput aria-label="Name oder Rolle suchen" placeholder="Wem übergeben? Name oder Rolle tippen …" className="pr-10" />
                  <CommandList className="max-h-[55vh] px-2 pb-2">
                    <CommandEmpty>Keine passende Person oder Rolle gefunden.</CommandEmpty>
                    {recentOptions.length > 0 && <CommandGroup heading="Zuletzt">{recentOptions.map((option) => renderOwnerOption(option, true))}</CommandGroup>}
                    <CommandGroup heading="Büro">
                      {ownerOptions.filter((option) => option.role === "office").map((option) => renderOwnerOption(option))}
                    </CommandGroup>
                    <CommandGroup heading="Abgeordnete/r">
                      {ownerOptions.filter((option) => option.role === "deputy").map((option) => renderOwnerOption(option))}
                    </CommandGroup>
                    <CommandGroup heading="Extern">
                      {ownerOptions.filter((option) => option.role === "external").map((option) => renderOwnerOption(option))}
                    </CommandGroup>
                    <form className="px-1 pb-2 pt-1" onSubmit={(event) => {
                      event.preventDefault();
                      const label = externalDraft.trim();
                      if (label) chooseOwner({ id: `custom:${label}`, label, role: "external" });
                    }}>
                      <Input aria-label="Externe Stelle eingeben" placeholder="Externe Stelle eingeben …"
                        value={externalDraft} onChange={(event) => setExternalDraft(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") event.stopPropagation(); }}
                        maxLength={200} className="border-0 bg-[#f2f2ef] dark:bg-muted" />
                    </form>
                  </CommandList>
                </Command>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full bg-transparent data-[state=open]:bg-muted">
                  <CalendarDays />{due ? formatDate(due) : "Kein Termin"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-52 rounded-xl p-1">
                {datePresets.map(([text, days]) => {
                  const date = shiftDay(null, days);
                  return <DropdownMenuItem key={days} onSelect={() => setDue(date)} className="justify-between gap-4 py-2">
                    {text}<span className="text-xs text-muted-foreground">{formatDate(date)}</span>
                  </DropdownMenuItem>;
                })}
                <DropdownMenuItem onSelect={() => { setCustomValue(due); setCustomField("date"); }}>Datum wählen …</DropdownMenuItem>
                {due && <DropdownMenuItem onSelect={() => setDue("")}>Termin entfernen</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm">
              <span className="text-muted-foreground">Priorität</span>{priorityLabels[task.priority] ?? task.priority}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {decisionLabel && <Badge variant="secondary"><Gavel className="h-3 w-3 mr-1" />{decisionLabel}</Badge>}
            {task.pending_for_jour_fixe && <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />Jour Fixe</Badge>}
          </div>
          <WorkflowLinks taskId={task.id} />
          {task.description && <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{task.description}</p>}
        </header>

        {nudgeForMe && (
          <section className="space-y-3" role="alert">
            <div className="flex items-center gap-2 text-body font-medium">
              <BellRing className="h-4 w-4 text-primary" />
              {nameOf(task.nudged_by) ?? "Jemand"} hat dich angestupst
              {task.nudge_count && task.nudge_count > 1 ? <Badge variant="secondary">{task.nudge_count}×</Badge> : null}
            </div>
            <div className="text-caption text-muted-foreground">
              {task.nudged_at ? new Date(task.nudged_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : ""}
              {task.nudge_note ? ` – „${task.nudge_note}“` : ""}
            </div>
            <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Kurze Antwort (optional)" className="h-8" />
            <div className="flex gap-2">
              <Button size="sm" disabled={saving} onClick={() => run(async () => { await onAckNudge(""); })}>Gesehen</Button>
              <Button size="sm" variant="outline" disabled={saving || !reply.trim()} onClick={() => run(async () => { await onAckNudge(reply.trim()); setReply(""); })}>Antworten</Button>
            </div>
          </section>
        )}

        {pendingVote && (
          <section className="space-y-3">
            <div className="section-label flex items-center gap-2"><Gavel className="h-3.5 w-3.5" />Deine Stimme ist gefragt</div>
            <div className="text-body font-medium">{pendingVote.title}</div>
            <Input value={voteComment} onChange={(e) => setVoteComment(e.target.value)} placeholder="Kommentar (bei Rückfrage nötig)" className="h-8" />
            <div className="flex flex-wrap gap-2">
              {pendingVote.options.map((o) => (
                <Button key={o.key} size="sm" variant={o.key === "yes" ? "default" : "outline"} disabled={saving || (o.requiresComment && !voteComment.trim())}
                  onClick={() => run(async () => { await onVote(o.key, voteComment.trim()); setVoteComment(""); })}>
                  {o.label}
                </Button>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4 border-b pb-5 sm:ml-10">
          {resub && (
            <div className="rounded-md bg-muted px-3 py-2 text-caption">
              Auf Wiedervorlage bis {new Date(task.next_action_due + "T00:00:00").toLocaleDateString("de-DE")}. Erledige den Schritt, um einen neuen festzulegen.
            </div>
          )}

          <label htmlFor="task-next-action" className="text-sm text-muted-foreground">Nächster Schritt</label>
          <Input id="task-next-action" value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="Was passiert als Nächstes?" className="px-0 font-medium md:text-lg" disabled={hasStep} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={saving || !hasStep} onClick={() => setDoneDialog(true)} className="rounded-xl bg-success text-white hover:bg-success/90">
              <Check />Schritt erledigt <kbd className="rounded border border-white/60 px-1 text-xs">E</kbd>
            </Button>
            {owner !== "deputy" && (
              <Button disabled={saving} className="rounded-xl bg-green-900 text-white hover:bg-green-800"
                onClick={() => run(() => onSave({ ball_owner: "deputy", ball_assignee_id: null, next_action: "Freigabe prüfen", next_action_due: null }))}>
                <Send />Zur Freigabe vorlegen
              </Button>
            )}
            <Button variant="outline" disabled={saving} onClick={setStep} className="rounded-xl bg-transparent">Speichern</Button>
          </div>
          {mayNudge && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Input value={nudgeNote} onChange={(e) => setNudgeNote(e.target.value)} placeholder="Nachricht zum Anstupsen (optional)" className="h-8" />
              <Button size="sm" variant="outline" disabled={saving} onClick={() => run(async () => { await onNudge(nudgeNote.trim()); setNudgeNote(""); })}>
                <BellRing className="h-4 w-4 mr-1" />Anstupsen
              </Button>
            </div>
          )}
          {!mayNudge && task.nudged_by === meId && isNudgeActive(task) && (
            <div className="text-caption text-muted-foreground pt-2 border-t">Heute bereits angestupst – noch nicht gesehen.</div>
          )}
        </section>

        <section className="space-y-3 sm:ml-10">
          <div className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-3.5 w-3.5" />Checkliste{progress.total ? ` (${progress.done}/${progress.total})` : ""}</div>
          <ul className="space-y-1">
            {checklist.map((item) => (
              <li key={item.id} className="group flex items-center gap-2">
                <Checkbox checked={item.done} disabled={saving} aria-label={item.text}
                  onCheckedChange={() => saveList(checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))} />
                <span className={cn("flex-1 text-body", item.done && "line-through text-muted-foreground")}>{item.text}</span>
                <button type="button" aria-label="Punkt entfernen" className="opacity-0 group-hover:opacity-100 text-muted-foreground"
                  onClick={() => saveList(checklist.filter((i) => i.id !== item.id))}><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              placeholder="Punkt hinzufügen" className="h-8" />
          </div>
        </section>

        <TaskSubtasks taskId={task.id} tenantId={task.tenant_id} userId={meId} nameOf={nameOf} profiles={profiles} />

        <section className="space-y-3">
          <div className="section-label">Verlauf</div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz zum aktuellen Stand…" rows={2} />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" disabled={!note.trim() || saving} onClick={() => run(async () => { await onSave({ note: note.trim() }); setNote(""); })}>
              Notiz speichern
            </Button>
          </div>
          <ul className="space-y-2">
            {timeline.length === 0 && <li className="text-caption text-muted-foreground">Noch keine Einträge</li>}
            {timeline.map((e) => (
              <li key={e.id} className={cn("p-3 text-sm leading-relaxed", e.type === "system" ? "text-muted-foreground" : "text-foreground")}>
                <span className="tabular-nums">{new Date(e.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
                {e.actorName ? ` · ${e.actorName}` : ""}: {e.text}
              </li>
            ))}
          </ul>
        </section>

      </main>
      <aside aria-label="Eigenschaften und Aktionen" className="min-h-0 min-w-0 space-y-6 border-t bg-card p-5  min-[1440px]:border-l min-[1440px]:border-t-0">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Eigenschaften</h3>
          <dl className="text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&>div]:border-b [&>div]:border-border/50 [&>div]:py-3 [&_dt]:text-muted-foreground [&_dd]:text-right [&_dd]:break-words">
            <div><dt>Status</dt><dd>{task.status === "todo" ? "Offen" : task.status === "in_progress" ? "In Bearbeitung" : task.status === "completed" ? "Erledigt" : task.status}</dd></div>
            <div><dt>Priorität</dt><dd>{priorityLabels[task.priority] ?? task.priority}</dd></div>
            <div><dt>Fälligkeit</dt><dd>{task.due_date ? new Date(task.due_date).toLocaleDateString("de-DE") : "Keine Frist"}</dd></div>
            <div><dt>Erstellt von</dt><dd>{nameOf(task.user_id) ?? "Unbekannt"}</dd></div>
          </dl>
          <TaskRecurrence taskId={task.id} value={task.recurrence_rule} onChanged={onReload} />
        </section>
        <section className="rounded-xl border bg-background p-4 space-y-3">
          <div className="section-label flex items-center gap-2"><Bell className="h-3.5 w-3.5" />Mich erinnern</div>
          {task.reminder_at ? (
            <div className={cn("rounded-md px-3 py-2 text-caption flex items-center justify-between gap-3", isReminderDue(task) ? "bg-accent text-accent-foreground" : "bg-muted")}>
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
              <div className="flex flex-wrap gap-2">
                {([["tomorrow", "Morgen"], ["3days", "In 3 Tagen"], ["nextweek", "Nächste Woche"]] as const).map(([k, l]) => (
                  <Button key={k} size="sm" variant="outline" disabled={saving}
                    onClick={() => run(async () => { await onSave({ reminder_at: reminderPreset(k).toISOString(), reminder_note: remNote.trim() || null }); setRemNote(""); })}>
                    {l}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input type="datetime-local" value={remAt} onChange={(e) => setRemAt(e.target.value)} className="h-8 min-w-0 flex-1" aria-label="Eigene Uhrzeit" />
                <Button size="sm" variant="outline" disabled={saving || !remAt}
                  onClick={() => run(async () => { await onSave({ reminder_at: new Date(remAt).toISOString(), reminder_note: remNote.trim() || null }); setRemNote(""); setRemAt(""); })}>
                  Setzen
                </Button>
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col items-stretch gap-1 border-b pb-5 [&>button]:justify-start">
          <Button size="sm" variant="ghost" onClick={daySlip}><Zap className="h-4 w-4 mr-1" />Auf Tageszettel</Button>
          <Button size="sm" variant="ghost" onClick={onJourFixe}><Users className="h-4 w-4 mr-1" />Auf Jour Fixe</Button>
          <Button size="sm" variant="ghost" onClick={onDecision}><Gavel className="h-4 w-4 mr-1" />Entscheidung anfordern</Button>
        </section>

        <Button variant="outline" disabled={saving} onClick={() => hasStep ? setDoneDialog(true) : run(onComplete)} className="h-11 w-full rounded-xl border-2 border-success font-semibold text-success hover:bg-success/5 hover:text-success">
          <Check className="mr-2 h-4 w-4" />Aufgabe abschließen
        </Button>
      </aside>

      <Dialog open={customField !== null} onOpenChange={(open) => { if (!open) setCustomField(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Datum wählen</DialogTitle></DialogHeader>
          <form onSubmit={(event) => {
            event.preventDefault();
            setDue(customValue);
            setCustomField(null);
          }} className="space-y-4">
            <Input aria-label="Datum" type="date"
              value={customValue} onChange={(event) => setCustomValue(event.target.value)} required />
            <DialogFooter><Button type="submit">Übernehmen</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={doneDialog} onOpenChange={setDoneDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schritt „{task.next_action}“ erledigt</DialogTitle></DialogHeader>
          <p className="text-body text-muted-foreground">Ist die Aufgabe damit fertig, oder gibt es einen Folgeschritt?</p>
          <DialogFooter className="gap-2">
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
