import { differenceInCalendarDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { usePersistentState } from "@/hooks/usePersistentState";
import { WorkflowLinks } from "@/components/workflow/WorkflowLinks";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bell, BellOff, BellRing, CalendarDays, Check, ChevronDown, Flag, Plus, X, Gavel, Send, Users, Zap } from "lucide-react";
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
import { TaskSubtasks } from "./TaskSubtasks";
import { sendToDaySlip, formatCaseDaySlipText } from "@/lib/daySlipBridge";
import {
  TASK_BALL_LABELS, canNudge, checklistProgress, isNudgeActive, isOnResubmission, isReminderDue, parseChecklist, reminderPreset, type ChecklistItem, parseTaskTimeline, shiftDay, stepState, type StafetteTask, type TaskBallOwner,
} from "@/features/tasks/stafette";

export interface TaskPatch extends StafetteTask {
  note?: string;
  description?: string | null;
  due_date?: string | null;
  priority?: "medium" | "high" | "low";
  stafette_resume_on?: string | null;
  ball_accepted_at?: string | null;
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
  registerShortcuts: (h: { stepDone: () => void; daySlip: () => void; openOwner: () => void }) => void;
  meId?: string;
  onNudge: (note: string) => Promise<void>;
  onAckNudge: (reply: string) => Promise<void>;
  pendingVote: PendingVote | null;
  onVote: (key: string, comment: string) => Promise<void>;
}


const ownerColors = { office: "bg-success", deputy: "bg-pink-600", external: "bg-muted-foreground" };
const priorities = [
  { value: "medium", label: "Mittel", color: "bg-yellow-500" },
  { value: "high", label: "Hoch", color: "bg-red-600" },
  { value: "low", label: "Niedrig", color: "bg-gray-400" },
] as const;
const datePresets = [["Heute", 0], ["Morgen", 1], ["In 3 Tagen", 3], ["Nächste Woche", 7]] as const;
const formatDate = (date: string) => new Date(date.slice(0, 10) + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

export function TaskDetailView({ task, profiles, decisionLabel, onSave, onComplete, onDecision, onJourFixe, nameOf, registerShortcuts, meId, onNudge, onAckNudge, pendingVote, onVote }: Props) {
  const { data: meetingTitle } = useQuery({
    queryKey: ["task-jour-fixe-title", task.tenant_id, task.meeting_id],
    enabled: Boolean(task.meeting_id),
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("title").eq("id", task.meeting_id!).maybeSingle();
      if (error) throw error;
      return data?.title;
    },
  });
  const jourFixeHint = task.meeting_id
    ? (meetingTitle ? `Auf Jour Fixe „${meetingTitle}“` : "Auf Jour Fixe eingeplant")
    : task.pending_for_jour_fixe ? "Für den nächsten Jour Fixe vorgemerkt" : "Auf Jour Fixe";
  const [description, setDescription] = useState(task.description ?? "");
  const [label, setLabel] = useState(task.next_action ?? "");
  const [due, setDue] = useState(task.next_action_due ?? "");
  const [owner, setOwner] = useState<TaskBallOwner>((task.ball_owner ?? "office") as TaskBallOwner);
  const [assignee, setAssignee] = useState<string>(task.ball_assignee_id ?? "none");
  const [externalLabel, setExternalLabel] = useState(task.ball_external_label ?? "");
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [recentOwners, setRecentOwners] = usePersistentState<string[]>(
    `task-recent-owners-${task.tenant_id}-${meId}`, [],
  );
  const [customField, setCustomField] = useState<"step" | "deadline" | "resubmission" | null>(null);
  const [externalDraft, setExternalDraft] = useState("");
  const [externalTarget, setExternalTarget] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [followUpOwner, setFollowUpOwner] = useState("");
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
  const checklistWritePending = useRef(false);
  const saveList = async (items: ChecklistItem[]) => {
    if (checklistWritePending.current) return;
    checklistWritePending.current = true;
    try {
      await onSave({ checklist: items });
    } finally {
      checklistWritePending.current = false;
    }
  };
  const addItem = () => {
    const text = newItem.trim();
    if (!text || checklistWritePending.current) return;
    setNewItem("");
    void saveList([...checklist, { id: crypto.randomUUID(), text, done: false }]);
  };

  useEffect(() => {
    setDue(task.next_action_due ?? "");
    setOwner((task.ball_owner ?? "office") as TaskBallOwner);
    setAssignee(task.ball_assignee_id ?? "none");
    setExternalLabel(task.ball_external_label ?? "");
  }, [task.id, task.next_action_due, task.ball_owner, task.ball_assignee_id, task.ball_external_label]);

  useEffect(() => {
    setLabel(task.next_action ?? "");
  }, [task.id, task.next_action]);

  useEffect(() => {
    setDescription(task.description ?? "");
  }, [task.id, task.description]);

  const priorityIndex = task.priority === "urgent" ? 1 : priorities.findIndex(({ value }) => value === task.priority);
  const priority = priorities[priorityIndex < 0 ? 0 : priorityIndex];
  const nextPriority = priorities[priorityIndex < 0 ? 1 : (priorityIndex + 1) % priorities.length];
  const overdueDays = due ? differenceInCalendarDays(new Date(), new Date(due.slice(0, 10) + "T00:00:00")) : 0;
  const hasStep = stepState(task) === "set";
  const timeline = parseTaskTimeline(task.timeline).slice().reverse();
  const resub = isOnResubmission(task);

  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    try { await fn(); } finally { setSaving(false); }
  };

  const setStep = () => run(() => onSave({ next_action: label.trim() || null }));
  const saveDue = (date: string) => run(() => onSave({ next_action_due: date || null }));

  const changeOwnerPicker = (open: boolean) => {
    if (!open) setExternalTarget(null);
    setOwnerPickerOpen(open);
    if (open) setExternalDraft(owner === "external" ? externalLabel : "");
  };
  const { data: deputyIds } = useQuery({
    queryKey: ["task-deputy-ids", task.tenant_id, meId],
    enabled: Boolean(task.tenant_id && meId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_task_deputy_ids", { p_tenant_id: task.tenant_id! });
      if (error) throw error;
      return data;
    },
  });
  const deputyId = deputyIds?.[0];
  const deputyProfile = profiles.find((profile) => profile.user_id === deputyId);
  const ownerOptions = [
    ...profiles.filter((profile) => !deputyIds?.includes(profile.user_id)).map((profile) => ({ id: `office:${profile.user_id}`, label: profile.display_name ?? "Unbenannt", role: "office" as const })),
    { id: "office:none", label: "Ohne feste Person", role: "office" as const },
    ...(deputyId ? [{
      id: `deputy:${deputyId}`, label: deputyProfile?.display_name ?? TASK_BALL_LABELS.deputy, role: "deputy" as const,
    }] : []),
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
    const person = option.id.startsWith("deputy:") || option.role === "office" ? option.id.slice(7) : "none";
    if (option.role === "external") {
      setExternalTarget(option.label);
      setFollowUp("");
      setFollowUpOwner(owner === "external" ? task.ball_assignee_id ?? meId ?? "" : meId ?? "");
      return;
    }
    void run(() => onSave({
      ball_owner: option.role,
      ball_assignee_id: person === "none" ? null : person,
      ...(option.role === "deputy" ? { next_action: "Freigabe prüfen", next_action_due: null } : {}),
    }));
    rememberOwner(option.id);
    setOwnerPickerOpen(false);
  };
  const saveExternal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!externalTarget || !followUp || !followUpOwner) return;
    void run(() => onSave({
      ball_owner: "external",
      ball_external_label: externalTarget,
      ball_assignee_id: followUpOwner,
      reminder_at: new Date(followUp + "T09:00:00").toISOString(),
      reminder_note: `Bei ${externalTarget} nachfassen`,
    }));
    changeOwnerPicker(false);
  };
  const renderOwnerOption = (option: (typeof ownerOptions)[number], recent = false) => {
    const profile = option.role !== "external" ? profiles.find(({ user_id }) => option.id === `${option.role}:${user_id}`) : undefined;
    const initials = option.label.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
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
    registerShortcuts({ stepDone: () => (hasStep ? setDoneDialog(true) : undefined), daySlip, openOwner: () => changeOwnerPicker(true) });
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <main data-task-detail aria-label="Aufgabendetails" className="min-h-0 min-w-0 flex-1 bg-white p-6 dark:bg-card [&_input]:border-0 [&_input]:bg-transparent [&_textarea]:border-0 [&_textarea]:bg-transparent [&_[role=combobox]]:border-0 [&_[role=combobox]]:bg-transparent">
        <div className="w-full max-w-[750px] space-y-3 [&>section]:space-y-3">
          <header className="relative space-y-1 pl-10">
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
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="min-w-0 flex-1 break-words text-[28px] font-semibold leading-tight tracking-tight">{task.title}</h2>
              <div role="group" aria-label="Aufgabenaktionen" className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button size="icon" variant="ghost" className="rounded-xl hover:bg-[#f0f0ed] hover:text-foreground dark:hover:bg-muted" aria-label="Mich erinnern">
                          <Bell strokeWidth={task.reminder_at ? 2.75 : 2} />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{task.reminder_at ? "Erinnerung gesetzt" : "Mich erinnern"}</TooltipContent>
                  </Tooltip>
                  <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-3" aria-label="Mich erinnern">
                    <h3 className="text-sm font-semibold">Mich erinnern</h3>
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
                  </PopoverContent>
                </Popover>
                {[
                  { label: "Auf Tageszettel", Icon: Zap, action: daySlip },
                  { label: jourFixeHint, Icon: Users, action: onJourFixe, active: Boolean(task.meeting_id || task.pending_for_jour_fixe) },
                  { label: decisionLabel ?? "Entscheidung anfordern", Icon: Gavel, action: onDecision, active: Boolean(decisionLabel) },
                ].map(({ label, Icon, action, active }) => (
                  <Tooltip key={label}>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="rounded-xl hover:bg-[#f0f0ed] hover:text-foreground dark:hover:bg-muted" aria-label={label} onClick={action}><Icon strokeWidth={active ? 2.75 : 2} className={active ? "text-foreground" : undefined} /></Button>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
            <Textarea aria-label="Beschreibung" value={description} onChange={(event) => setDescription(event.target.value)}
              placeholder="Beschreibung hinzufügen …" rows={1}
              className="min-h-0 resize-y px-0 py-0 focus-visible:ring-0 focus-visible:ring-offset-0 leading-relaxed text-muted-foreground [field-sizing:content]" />
            {description !== (task.description ?? "") && (
              <Button size="sm" variant="outline" disabled={saving}
                onClick={() => void run(() => onSave({ description: description.trim() || null }))}>
                Beschreibung speichern
              </Button>
            )}
            {(decisionLabel || task.pending_for_jour_fixe) && <div className="flex flex-wrap gap-2">
              {decisionLabel && <Badge variant="secondary"><Gavel className="h-3 w-3 mr-1" />{decisionLabel}</Badge>}
              {task.pending_for_jour_fixe && <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />Jour Fixe</Badge>}
            </div>}
            <WorkflowLinks taskId={task.id} />
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <Dialog open={ownerPickerOpen} onOpenChange={changeOwnerPicker}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" aria-keyshortcuts="A" disabled={saving} className="max-w-full rounded-full bg-transparent">
                    <span className={cn("size-2 shrink-0 rounded-full", ownerColors[owner])} />
                    <span className="text-muted-foreground">Am Zug</span>
                    <span className="truncate">
                      {(owner !== "external" && (nameOf(assignee) || (owner === "deputy" && deputyProfiles.length === 1 && deputyProfiles[0].display_name))) || (owner === "external" && externalLabel) || TASK_BALL_LABELS[owner]}
                    </span>
                    <kbd className="rounded border px-1 text-xs text-muted-foreground">A</kbd>
                  </Button>
                </DialogTrigger>
                <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
                  <DialogTitle className="sr-only">Wem übergeben?</DialogTitle>
                  {externalTarget ? (
                    <form onSubmit={saveExternal} className="space-y-3 p-5">
                      <p className="font-medium">Wartet auf {externalTarget}</p>
                      <label className="block text-sm">Wer fasst nach?
                        <select className="mt-1 block w-full rounded border bg-background p-2" value={followUpOwner} required onChange={(event) => setFollowUpOwner(event.target.value)}>
                          <option value="">Person auswählen</option>
                          {profiles.map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.display_name ?? "Unbenannt"}</option>)}
                        </select>
                      </label>
                      <label className="block text-sm">Nachfassen am
                        <Input type="date" value={followUp} required onChange={(event) => setFollowUp(event.target.value)} />
                      </label>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setExternalTarget(null)}>Zurück</Button>
                        <Button type="submit" disabled={saving}>Übergabe speichern</Button>
                      </div>
                    </form>
                  ) : <Command>
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
                  </Command>}
                </DialogContent>
              </Dialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={saving} className="rounded-full bg-transparent data-[state=open]:bg-muted">
                    <Flag />
                    <span className="text-muted-foreground">Endfrist</span>
                    <span>{task.due_date ? formatDate(task.due_date) : "Setzen"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-52 rounded-xl p-1">
                  {([["Freitag", 5], ["Montag", 1]] as const).map(([label, weekday]) => {
                    const today = new Date();
                    const date = shiftDay(null, (weekday - today.getDay() + 6) % 7 + 1, today);
                    return (
                      <DropdownMenuItem key={weekday} onSelect={() => void run(() => onSave({ due_date: date }))} className="justify-between gap-4 py-2">
                        {label}<span className="text-xs text-muted-foreground">{formatDate(date)}</span>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuItem onSelect={() => { setCustomValue(task.due_date?.slice(0, 10) ?? ""); setCustomField("deadline"); }}>
                    Datum wählen …
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { if (task.due_date) void run(() => onSave({ due_date: null })); }}>
                    Ohne Endfrist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" disabled={saving} className="rounded-full bg-transparent"
                aria-label={`Priorität ${priority.label}. Auf ${nextPriority.label} ändern`}
                onClick={() => void run(() => onSave({ priority: nextPriority.value }))}>
                <span className={cn("size-2 rounded-full", priority.color)} />
                <span className="text-muted-foreground">Priorität</span>
                {priority.label}
              </Button>
            </div>
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

          <section className="ml-10 space-y-3 border-y pb-3 pt-6">
            <div>
              <label htmlFor="task-next-action" className="block text-xs font-semibold text-muted-foreground">Nächster Schritt</label>
              <div className="mt-[10px] flex flex-wrap items-center gap-2">
                <Textarea id="task-next-action" rows={1} aria-describedby={hasStep ? undefined : "task-next-action-hint"} value={label} onChange={(event) => setLabel(event.target.value)}
                  placeholder="Was passiert als Nächstes?" className="min-h-0 min-w-0 flex-1 basis-48 resize-none border-0 px-0 py-0 font-medium leading-tight shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:text-xl read-only:cursor-text [field-sizing:content] [overflow-wrap:anywhere]"
                  readOnly={hasStep} disabled={saving}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing && !hasStep && label.trim()) {
                      event.preventDefault();
                      void setStep();
                    }
                  }} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={saving} className="rounded-full bg-transparent data-[state=open]:bg-muted">
                      <CalendarDays />
                      <span className="text-muted-foreground">Schritt bis</span>
                      {overdueDays > 0 ? (
                        <span className="text-destructive">seit {overdueDays} {overdueDays === 1 ? "Tag" : "Tagen"} überfällig</span>
                      ) : <span className="font-medium">{due ? formatDate(due) : "Kein Termin"}</span>}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-52 rounded-xl p-1">
                    {datePresets.map(([text, days]) => {
                      const date = shiftDay(null, days);
                      return <DropdownMenuItem key={days} onSelect={() => void saveDue(date)} className="justify-between gap-4 py-2 font-medium">
                        {text}<span className="text-xs text-muted-foreground">{formatDate(date)}</span>
                      </DropdownMenuItem>;
                    })}
                    <DropdownMenuItem onSelect={() => { setCustomValue(due.slice(0, 10)); setCustomField("step"); }}>Datum wählen …</DropdownMenuItem>
                    {due && <DropdownMenuItem onSelect={() => void saveDue("")}>Termin entfernen</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {!hasStep && <p id="task-next-action-hint" className="mt-2 text-xs text-muted-foreground">Enter übernimmt den Schritt.</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {owner !== "external" && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setCustomValue(task.stafette_resume_on ?? "");
                  setCustomField("resubmission");
                }}>Wieder vorlegen …</Button>
              )}
              {task.stafette_resume_on && (
                <Button variant="ghost" size="sm" onClick={() => void run(() => onSave({ stafette_resume_on: null }))}>Wiedervorlage entfernen</Button>
              )}
              {owner === "external" && (
                <span>Nachfassen: {nameOf(task.ball_assignee_id) ?? "Person offen"} · {task.reminder_at ? new Date(task.reminder_at).toLocaleDateString("de-DE") : "Termin offen"}</span>
              )}
              {task.ball_handed_at && owner !== "external" && (
                <span>{task.ball_accepted_at ? "Übernommen" : "Übergeben"} am {new Date(task.ball_accepted_at ?? task.ball_handed_at).toLocaleDateString("de-DE")}</span>
              )}
              {task.ball_handed_at && !task.ball_accepted_at && owner !== "external" && !!meId && task.ball_assignee_id === meId && (
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void run(() => onSave({ ball_accepted_at: new Date().toISOString() }))}>Übernehmen</Button>
              )}
            </div>
            {resub && task.stafette_resume_on && (
              <div className="rounded-md bg-muted px-3 py-2 text-caption">
                Auf Wiedervorlage bis {formatDate(task.stafette_resume_on)}.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {hasStep ? <Button disabled={saving} onClick={() => setDoneDialog(true)} className="h-11 rounded-xl bg-success px-4 text-white hover:bg-success/90">
                <Check />Schritt erledigt <kbd className="rounded border border-white/60 px-1 text-xs">E</kbd>
              </Button> : (
                <Button disabled={saving || !label.trim()} onClick={setStep} className="h-11 rounded-xl bg-success px-4 text-white hover:bg-success/90">
                  Schritt festlegen
                </Button>
              )}
              <div className="inline-flex items-stretch">
                {owner !== "deputy" && (
                  <Button variant="outline" disabled={saving || !deputyId} className="h-11 rounded-l-xl rounded-r-none bg-transparent"
                    onClick={() => run(() => onSave({ ball_owner: "deputy", ball_assignee_id: deputyId, next_action: "Freigabe prüfen", next_action_due: null }))}>
                    <Send />Übergeben an Abgeordnete/r
                  </Button>
                )}
                <Button variant="outline" disabled={saving} aria-label="Andere Zuständigkeit auswählen"
                  className={cn("h-11 rounded-xl bg-transparent", owner !== "deputy" && "rounded-l-none border-l-0")}
                  onClick={() => changeOwnerPicker(true)}>
                  {owner === "deputy" && "Übergeben"}<ChevronDown />
                </Button>
              </div>
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

          <section className="ml-10 space-y-3 pt-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              Checkliste
              {progress.total > 0 && (
                <span className="font-normal text-muted-foreground">{progress.done} von {progress.total}</span>
              )}
            </h3>
            <ul className="space-y-3">
              {checklist.map((item) => (
                <li key={item.id} className="group grid min-h-5 grid-cols-[20px_minmax(0,1fr)_14px] items-center gap-3">
                  <Checkbox checked={item.done} aria-label={item.text} className="relative size-5 min-w-5 rounded-sm border-muted-foreground transition-none [&>span]:pointer-events-none [&>span]:absolute [&>span]:inset-0 [&_svg]:size-3.5"
                    onCheckedChange={() => saveList(checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))} />
                  <span data-done={item.done} className="min-w-0 break-words text-body data-[done=true]:text-muted-foreground data-[done=true]:line-through">{item.text}</span>
                  <button type="button" aria-label="Punkt entfernen" className="text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => saveList(checklist.filter((i) => i.id !== item.id))}><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <Plus aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                aria-label="Punkt hinzufügen" placeholder="Punkt hinzufügen" className="h-8 border-0 bg-transparent px-0 shadow-none" />
            </div>
          </section>

          <div className="ml-10 pt-5"><TaskSubtasks taskId={task.id} tenantId={task.tenant_id} category={task.category} userId={meId} profiles={profiles} /></div>

          <section className="ml-10 space-y-3 pt-5">
            <h3 className="text-base font-semibold">Verlauf</h3>
            <form onSubmit={(event) => {
              event.preventDefault();
              if (!note.trim() || saving) return;
              void run(async () => {
                await onSave({ note: note.trim() });
                setNote("");
              });
            }} className="rounded-xl border focus-within:ring-2 focus-within:ring-ring">
              <Input aria-label="Notiz hinzufügen. Enter speichert." value={note} onChange={(event) => setNote(event.target.value)}
                placeholder="Notiz hinzufügen … (Enter speichert)" disabled={saving}
                className="h-11 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0" />
            </form>
            <ol className="pt-5 [overflow-anchor:none]">
              {[...timeline, { id: "task-created", at: task.created_at, actorName: nameOf(task.user_id) ?? "Unbekannt", text: "Aufgabe erstellt" }].map((entry) => (
                <li key={entry.id} className="relative pb-6 pl-7 text-sm last:pb-0 before:absolute before:left-[5px] before:top-[22px] before:bottom-[-2px] before:w-px before:bg-border before:content-[''] last:before:hidden">
                  <span aria-hidden="true" className="absolute left-0 top-1.5 size-3 rounded-full bg-muted-foreground/45" />
                  <div className="text-xs text-muted-foreground">
                    <time dateTime={entry.at} className="tabular-nums">
                      {new Date(entry.at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </time>
                    {entry.actorName && ` · ${entry.actorName}`}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{entry.text}</p>
                </li>
              ))}
            </ol>
          </section>

        </div>
      </main>

      <Dialog open={customField !== null} onOpenChange={(open) => { if (!open) setCustomField(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{customField === "resubmission" ? "Wiedervorlage wählen" : customField === "deadline" ? "Endfrist wählen" : "Datum für den Schritt wählen"}</DialogTitle></DialogHeader>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (customField === "resubmission") void run(() => onSave({ stafette_resume_on: customValue || null }));
            if (customField === "deadline") void run(() => onSave({ due_date: customValue }));
            if (customField === "step") void saveDue(customValue);
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
            <Button variant="outline" onClick={() => run(async () => { setDoneDialog(false); await onSave({ next_action: null, next_action_due: null }); setLabel(""); setDue(""); })}>
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
