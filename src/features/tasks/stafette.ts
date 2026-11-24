// Pure rules for the task "Stafette" workspace (who is on the move, next step, resubmission).
export type TaskBallOwner = "office" | "deputy" | "external";
export type TaskZone = "nudged" | "mine" | "waiting" | "resubmission";

export const TASK_BALL_LABELS: Record<TaskBallOwner, string> = {
  office: "Büro",
  deputy: "Abgeordnete/r",
  external: "Extern",
};

export interface StafetteTask {
  ball_owner?: string | null;
  ball_assignee_id?: string | null;
  ball_external_label?: string | null;
  ball_handed_at?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  stafette_resume_on?: string | null;
  user_id?: string;
  next_action?: string | null;
  next_action_due?: string | null;
  status?: string | null;
  reminder_at?: string | null;
  reminder_note?: string | null;
  nudged_at?: string | null;
  nudged_by?: string | null;
  nudge_seen_at?: string | null;
  nudge_count?: number | null;
}

/** A nudge is active until the recipient marks it as seen. */
export function isNudgeActive(task: StafetteTask): boolean {
  if (!task.nudged_at) return false;
  return !task.nudge_seen_at || new Date(task.nudge_seen_at).getTime() < new Date(task.nudged_at).getTime();
}

/** Nudging is possible when someone else holds the ball (not external) and I have not nudged in the last 24h. */
export function canNudge(task: StafetteTask, meId: string | undefined, now: Date = new Date()): boolean {
  const owner = (task.ball_owner ?? "office") as TaskBallOwner;
  if (owner === "external") return false;
  if (task.ball_assignee_id === meId || (owner === "office" && !task.ball_assignee_id)) return false;
  if (task.nudged_by === meId && task.nudged_at && now.getTime() - new Date(task.nudged_at).getTime() < 24 * 3600_000) return false;
  return true;
}

export interface StafetteEvent {
  id: string;
  type: "system" | "note";
  at: string;
  actorName?: string;
  text: string;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDay = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function stepState(task: StafetteTask): "unset" | "set" {
  return task.next_action && task.next_action.trim() ? "set" : "unset";
}

/** Explicit resubmission controls visibility independently of the deadline. */
export function isOnResubmission(task: StafetteTask, now: Date = new Date()): boolean {
  return !!task.stafette_resume_on && parseDay(task.stafette_resume_on) > dayStart(now);
}

export function isTaskReminderFor(task: StafetteTask, meId: string | undefined, now: Date = new Date()): boolean {
  return !!meId && (task.ball_assignee_id ?? task.user_id) === meId && isReminderDue(task, now);
}

/** A reminder is due once its time has passed; it pulls the task back into "Mein Zug". */
export function isReminderDue(task: StafetteTask, now: Date = new Date()): boolean {
  if (!task.reminder_at) return false;
  const t = new Date(task.reminder_at).getTime();
  return !Number.isNaN(t) && t <= now.getTime();
}

/** Preset reminder times (09:00 local) relative to now. */
export function reminderPreset(kind: "tomorrow" | "3days" | "nextweek", now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  if (kind === "tomorrow") d.setDate(d.getDate() + 1);
  else if (kind === "3days") d.setDate(d.getDate() + 3);
  else { const dow = d.getDay(); d.setDate(d.getDate() + (((8 - dow) % 7) || 7)); }
  return d;
}

export function taskZone(task: StafetteTask, meId: string | undefined, now: Date = new Date()): TaskZone {
  const owner = task.ball_owner ?? "office";
  const assignedToMe = !!meId && task.ball_assignee_id === meId;
  if (owner !== "external" && assignedToMe && isNudgeActive(task) && task.nudged_by !== meId) return "nudged";
  if (isTaskReminderFor(task, meId, now)) return "mine";
  if (owner === "external" || (!assignedToMe && (owner === "deputy" || task.ball_assignee_id))) return "waiting";
  if (isOnResubmission(task, now)) return "resubmission";
  return "mine";
}

export function groupByZone<T extends StafetteTask>(tasks: T[], meId: string | undefined, now: Date = new Date()) {
  const out: Record<TaskZone, T[]> = { nudged: [], mine: [], waiting: [], resubmission: [] };
  for (const t of tasks) {
    if (t.status === "completed") continue;
    out[taskZone(t, meId, now)].push(t);
  }
  return out;
}

const fmtDay = (s: string) => {
  const d = parseDay(s);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

/** Timeline entries describing the difference between two task states. */
export function stafetteEvents(
  before: StafetteTask,
  after: StafetteTask,
  ctx: { actorName?: string; now?: Date; nameOf?: (id: string) => string | undefined } = {},
): StafetteEvent[] {
  const at = (ctx.now ?? new Date()).toISOString();
  const events: StafetteEvent[] = [];
  const push = (text: string) =>
    events.push({ id: `${at}-${events.length}`, type: "system", at, actorName: ctx.actorName, text });

  const bOwner = (before.ball_owner ?? "office") as TaskBallOwner;
  const aOwner = (after.ball_owner ?? "office") as TaskBallOwner;
  if (bOwner !== aOwner) push(`Am Zug: ${TASK_BALL_LABELS[bOwner]} → ${TASK_BALL_LABELS[aOwner]}`);
  if ((before.ball_assignee_id ?? null) !== (after.ball_assignee_id ?? null) && after.ball_assignee_id) {
    push(`Verantwortlich: ${ctx.nameOf?.(after.ball_assignee_id) ?? "neue Person"}`);
  }
  const bStep = before.next_action?.trim() || "";
  const aStep = after.next_action?.trim() || "";
  if (bStep && !aStep) push(`Schritt erledigt: „${bStep}“`);
  else if (aStep && bStep !== aStep) {
    if (bStep) push(`Schritt erledigt: „${bStep}“`);
    push(`Schritt festgelegt: „${aStep}“${after.next_action_due ? ` bis ${fmtDay(after.next_action_due)}` : ""}`);
  } else if (aStep && (before.next_action_due ?? null) !== (after.next_action_due ?? null)) {
    push(after.next_action_due ? `Frist geändert auf ${fmtDay(after.next_action_due)}` : "Frist entfernt");
  }
  const bRem = before.reminder_at ?? null;
  const aRem = after.reminder_at ?? null;
  if (bRem !== aRem) {
    if (aRem) {
      const d = new Date(aRem);
      push(`Erinnerung gesetzt: ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}${after.reminder_note ? ` – ${after.reminder_note}` : ""}`);
    } else push("Erinnerung erledigt");
  }
  if (before.status !== "completed" && after.status === "completed") push("Aufgabe abgeschlossen");
  return events;
}

export function parseTaskTimeline(raw: unknown): StafetteEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is StafetteEvent => !!e && typeof e === "object" && typeof (e as StafetteEvent).text === "string" && typeof (e as StafetteEvent).at === "string",
  );
}

export interface ChecklistItem { id: string; text: string; done: boolean }

export function parseChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((i): i is ChecklistItem => !!i && typeof i === "object" && typeof (i as ChecklistItem).text === "string")
    .map((i) => ({ id: String(i.id ?? i.text), text: i.text, done: !!i.done }));
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/** Timeline texts for checklist items that were newly ticked off. */
export function checklistEvents(before: ChecklistItem[], after: ChecklistItem[]): string[] {
  const was = new Map(before.map((i) => [i.id, i.done]));
  return after.filter((i) => i.done && !was.get(i.id)).map((i) => `Checkpunkt erledigt: „${i.text}“`);
}

export type TaskBatchAction = "deputy" | "week" | "nudge";

export const TASK_BATCH_LABELS: Record<TaskBatchAction, string> = {
  deputy: "Zur Freigabe vorlegen",
  week: "Frist +1 Woche",
  nudge: "Anstupsen",
};

/** Upper bound that matches the check inside batch_task_stafette_action. */
export const TASK_BATCH_LIMIT = 200;

export interface TaskBatchItem {
  task_id: string;
  title: string | null;
  eligible: boolean;
  reason: string | null;
  before: string | null;
  after: string | null;
}

export interface TaskBatchPreview {
  action: TaskBatchAction;
  total: number;
  affected: number;
  skipped: number;
  items: TaskBatchItem[];
}

const asText = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

/** Counts always come from the rows themselves, so a summary can never promise more than it shows. */
export function taskBatchPreview(action: TaskBatchAction, items: TaskBatchItem[]): TaskBatchPreview {
  return {
    action,
    total: items.length,
    affected: items.filter((item) => item.eligible).length,
    skipped: items.filter((item) => !item.eligible).length,
    items,
  };
}

/** Reads the JSON of batch_task_stafette_preview; returns null for unexpected shapes. */
export function parseTaskBatchPreview(raw: unknown): TaskBatchPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (data.action !== "deputy" && data.action !== "week" && data.action !== "nudge") return null;
  const items = Array.isArray(data.items)
    ? data.items.flatMap((entry): TaskBatchItem[] => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        if (typeof item.task_id !== "string") return [];
        return [{
          task_id: item.task_id,
          title: asText(item.title),
          eligible: item.eligible === true,
          reason: asText(item.reason),
          before: asText(item.before),
          after: asText(item.after),
        }];
      })
    : [];
  return taskBatchPreview(data.action, items);
}

/** „5 Aufgaben, 2 werden übersprungen“ – the honest summary before anything is written. */
export function batchPreviewSummary(preview: TaskBatchPreview): string {
  const tasks = `${preview.total} ${preview.total === 1 ? "Aufgabe" : "Aufgaben"}`;
  if (preview.skipped === 0) return `${tasks} ${preview.total === 1 ? "wird" : "werden"} bearbeitet`;
  return `${tasks}, ${preview.skipped} ${preview.skipped === 1 ? "wird" : "werden"} übersprungen`;
}

/** Skip reasons grouped, so the dialog explains instead of just counting. */
export function groupBatchSkips(items: TaskBatchItem[]): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.eligible) continue;
    const reason = item.reason ?? "nicht möglich";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

/** One line per change, showing what actually happens to the task. */
export function describeBatchItem(item: TaskBatchItem, action: TaskBatchAction): string {
  if (action === "week") return item.before && item.after ? `Frist ${item.before} → ${item.after}` : "Frist verschieben";
  if (action === "deputy") return item.before ? `Schritt bleibt: „${item.before}“` : `Nächster Schritt: „${item.after ?? "Freigabe prüfen"}“`;
  return "Wird bei der zuständigen Person oben einsortiert";
}

export interface BallLabel {
  owner: TaskBallOwner;
  label: string;
  /** True when the ball sits in the office but no person is named. */
  needsPerson: boolean;
}

/** "Büro (keine Person)" instead of pretending a personal ball for everyone. */
export function ballAssigneeLabel(task: StafetteTask, nameOf?: (id: string) => string | undefined): BallLabel {
  const owner = (task.ball_owner ?? "office") as TaskBallOwner;
  if (owner === "external") {
    return { owner, label: task.ball_external_label?.trim() || TASK_BALL_LABELS.external, needsPerson: false };
  }
  const hasPerson = !!task.ball_assignee_id;
  const name = hasPerson ? nameOf?.(task.ball_assignee_id!)?.trim() : undefined;
  if (owner === "deputy") return { owner, label: name || TASK_BALL_LABELS.deputy, needsPerson: false };
  return { owner, label: name ?? (hasPerson ? TASK_BALL_LABELS.office : "Büro (keine Person)"), needsPerson: !hasPerson };
}

const DAY_MS = 86_400_000;
export const TASK_STALLED_DAYS = 14;

/** Days since the ball moved (fall back to creation) – the honest waiting time. */
export function daysWaiting(task: StafetteTask, now: Date = new Date()): number {
  const stamp = task.ball_handed_at ?? task.created_at;
  if (!stamp) return 0;
  const time = new Date(stamp).getTime();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, Math.floor((now.getTime() - time) / DAY_MS));
}

/** A task without movement for two weeks is silent, not "in Arbeit". */
export function isStalledTask(task: StafetteTask, now: Date = new Date(), days: number = TASK_STALLED_DAYS): boolean {
  if (task.status === "completed") return false;
  const stamp = task.ball_handed_at ?? task.created_at;
  if (!stamp) return false;
  const time = new Date(stamp).getTime();
  if (Number.isNaN(time)) return false;
  return now.getTime() - time > days * DAY_MS;
}

/** Escalation reason: two unanswered nudges, or a stalled task. */
export function escalationFor(task: StafetteTask, now: Date = new Date()): string | null {
  if (task.status === "completed") return null;
  const nudges = task.nudge_count ?? 0;
  if (nudges >= 2 && isNudgeActive(task)) return `${nudges}× angestupst, keine Reaktion`;
  if (isStalledTask(task, now)) return `seit ${daysWaiting(task, now)} Tagen ohne Bewegung`;
  return null;
}

export interface WeekReview<T extends StafetteTask & { id: string; title: string }> {
  noNextStep: T[];
  noBallPerson: T[];
  stalled: T[];
  duplicates: Array<{ title: string; tasks: T[] }>;
  escalate: Array<{ task: T; reason: string }>;
}

/** The weekly cleanup list: missing next steps, unnamed balls, silence, duplicates. */
export function weekReview<T extends StafetteTask & { id: string; title: string }>(tasks: T[], now: Date = new Date()): WeekReview<T> {
  const open = tasks.filter((task) => task.status !== "completed");
  const noNextStep = open.filter((task) => stepState(task) === "unset");
  const noBallPerson = open.filter((task) => ballAssigneeLabel(task).needsPerson);
  const stalled = open.filter((task) => isStalledTask(task, now));
  const groups = new Map<string, T[]>();
  for (const task of open) {
    const key = task.title.trim().toLocaleLowerCase("de").replace(/\s+/g, " ");
    if (key.length < 8) continue;
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  const duplicates = [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({ title: group[0].title.trim(), tasks: group }))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
  const escalate = open.flatMap((task) => {
    const reason = escalationFor(task, now);
    return reason ? [{ task, reason }] : [];
  });
  return { noNextStep, noBallPerson, stalled, duplicates, escalate };
}

export type SlaLevel = "ok" | "warn" | "critical";

/** Approval waiting time: three days is noticeable, seven is the bottleneck. */
export function slaLevel(days: number): SlaLevel {
  if (days >= 7) return "critical";
  if (days >= 3) return "warn";
  return "ok";
}

export type TaskCommand =
  | { kind: "due"; days: number }
  | { kind: "assign"; query: string }
  | { kind: "wait"; text: string }
  | { kind: "priority"; priority: "high" | "medium" | "low" }
  | { kind: "complete" };

/** One-line task commands ("frist +1w", "an Max", "wartet auf Ministerium"). */
export function parseTaskCommand(input: string): TaskCommand | null {
  const text = input.trim();
  if (!text) return null;
  const relative = /^frist\s*\+?\s*(\d+)\s*(t|tag|tage|w|woche|wochen)?$/i.exec(text);
  if (relative) {
    const amount = Number(relative[1]);
    if (!Number.isFinite(amount) || amount < 0 || amount > 365) return null;
    const unit = (relative[2] ?? "t").toLowerCase();
    return { kind: "due", days: unit.startsWith("w") ? amount * 7 : amount };
  }
  if (/^frist\s+(heute|morgen)$/i.test(text)) return { kind: "due", days: /morgen/i.test(text) ? 1 : 0 };
  const assign = /^an\s+(.{2,})$/i.exec(text);
  if (assign) return { kind: "assign", query: assign[1].trim() };
  const wait = /^wartet auf\s+(.{2,})$/i.exec(text);
  if (wait) return { kind: "wait", text: wait[1].trim() };
  const priority = /^(?:prio|priorität)\s+(hoch|mittel|niedrig)$/i.exec(text);
  if (priority) {
    const value = priority[1].toLowerCase();
    return { kind: "priority", priority: value === "hoch" ? "high" : value === "mittel" ? "medium" : "low" };
  }
  if (/^(erledigt|fertig|abhaken)$/i.test(text)) return { kind: "complete" };
  return null;
}

export function describeTaskCommand(command: TaskCommand, nameOf?: (query: string) => string | undefined): string {
  if (command.kind === "due") {
    if (command.days === 0) return "Frist auf heute setzen";
    if (command.days === 1) return "Frist auf morgen setzen";
    return `Frist in ${command.days} Tagen setzen`;
  }
  if (command.kind === "assign") return `Ball an ${nameOf?.(command.query) ?? command.query} übergeben`;
  if (command.kind === "wait") return `Wartet auf ${command.text}`;
  if (command.kind === "priority") {
    return `Priorität ${command.priority === "high" ? "hoch" : command.priority === "medium" ? "mittel" : "niedrig"}`;
  }
  return "Aufgabe abschließen";
}

/** Shift a YYYY-MM-DD date (or today, if empty) by n days. */
export function shiftDay(day: string | null | undefined, days: number, now: Date = new Date()): string {
  const base = day ? parseDay(day) : dayStart(now);
  base.setDate(base.getDate() + days);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}
