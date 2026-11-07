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
  if (owner === "office" && (!task.ball_assignee_id || task.ball_assignee_id === meId)) return false;
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

/** A task is on resubmission when a step exists and its due day is after today. */
export function isOnResubmission(task: StafetteTask, now: Date = new Date()): boolean {
  if (stepState(task) === "unset" || !task.next_action_due) return false;
  return parseDay(task.next_action_due) > dayStart(now);
}

/**
 * Zone for the current user:
 * - waiting: ball is with deputy/external, or with another office person
 * - resubmission: my step is due in the future
 * - mine: everything else
 */
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
  if (isNudgeActive(task) && task.nudged_by !== meId) return "nudged";
  if (isReminderDue(task, now)) return "mine";
  const owner = (task.ball_owner ?? "office") as TaskBallOwner;
  if (owner !== "office") return "waiting";
  if (task.ball_assignee_id && meId && task.ball_assignee_id !== meId) return "waiting";
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

/** Shift a YYYY-MM-DD date (or today, if empty) by n days. */
export function shiftDay(day: string | null | undefined, days: number, now: Date = new Date()): string {
  const base = day ? parseDay(day) : dayStart(now);
  base.setDate(base.getDate() + days);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}
