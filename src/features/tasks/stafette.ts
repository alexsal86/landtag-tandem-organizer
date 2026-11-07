// Pure rules for the task "Stafette" workspace (who is on the move, next step, resubmission).
export type TaskBallOwner = "office" | "deputy" | "external";
export type TaskZone = "mine" | "waiting" | "resubmission";

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
export function taskZone(task: StafetteTask, meId: string | undefined, now: Date = new Date()): TaskZone {
  const owner = (task.ball_owner ?? "office") as TaskBallOwner;
  if (owner !== "office") return "waiting";
  if (task.ball_assignee_id && meId && task.ball_assignee_id !== meId) return "waiting";
  if (isOnResubmission(task, now)) return "resubmission";
  return "mine";
}

export function groupByZone<T extends StafetteTask>(tasks: T[], meId: string | undefined, now: Date = new Date()) {
  const out: Record<TaskZone, T[]> = { mine: [], waiting: [], resubmission: [] };
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
  if (before.status !== "completed" && after.status === "completed") push("Aufgabe abgeschlossen");
  return events;
}

export function parseTaskTimeline(raw: unknown): StafetteEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is StafetteEvent => !!e && typeof e === "object" && typeof (e as StafetteEvent).text === "string" && typeof (e as StafetteEvent).at === "string",
  );
}
