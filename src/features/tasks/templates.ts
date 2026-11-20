// Pure rules for recurring tasks, mandate templates and subtask progress.

export type RecurrenceRule = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

export const RECURRENCE_LABELS: Record<RecurrenceRule, string> = {
  weekly: "Wöchentlich",
  biweekly: "Alle 2 Wochen",
  monthly: "Monatlich",
  quarterly: "Quartalsweise",
  yearly: "Jährlich",
};

export const isRecurrenceRule = (v: unknown): v is RecurrenceRule =>
  typeof v === "string" && v in RECURRENCE_LABELS;

/** Mirrors DB next_recurrence_date(): next due date as YYYY-MM-DD. */
export function nextRecurrenceDate(baseIso: string, rule: RecurrenceRule): string {
  const d = new Date(baseIso.length === 10 ? `${baseIso}T00:00:00Z` : baseIso);
  if (rule === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (rule === "biweekly") d.setUTCDate(d.getUTCDate() + 14);
  else if (rule === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (rule === "quarterly") d.setUTCMonth(d.getUTCMonth() + 3);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export interface TemplateSubtask { title: string; offsetDays: number }
export interface TaskTemplate {
  key: string;
  id?: string;
  title: string;
  description: string;
  firstStep: string;
  /** Days from start until the main task is due. */
  dueInDays: number;
  subtasks: TemplateSubtask[];
  isActive?: boolean;
}

export interface TaskTemplateRecord {
  id: string;
  title: string;
  description: string;
  first_step: string;
  due_in_days: number;
  subtasks: unknown;
  is_active: boolean;
}

export function taskTemplateFromRecord(record: TaskTemplateRecord): TaskTemplate {
  const rows = Array.isArray(record.subtasks) ? record.subtasks : [];
  return {
    key: record.id,
    id: record.id,
    title: record.title,
    description: record.description,
    firstStep: record.first_step,
    dueInDays: record.due_in_days,
    isActive: record.is_active,
    subtasks: rows.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const row = value as Record<string, unknown>;
      return typeof row.title === "string" && Number.isInteger(row.offsetDays)
        ? [{ title: row.title, offsetDays: Number(row.offsetDays) }]
        : [];
    }),
  };
}

export function validateTaskTemplate(template: Pick<TaskTemplate, "title" | "firstStep" | "dueInDays" | "subtasks">): string | null {
  if (template.title.trim().length < 2 || template.firstStep.trim().length < 2) return "Titel und erster Schritt sind erforderlich.";
  if (!Number.isInteger(template.dueInDays) || template.dueInDays < 0 || template.dueInDays > 365) return "Die Gesamtfrist muss zwischen 0 und 365 Tagen liegen.";
  if (template.subtasks.length > 30) return "Höchstens 30 Unteraufgaben sind erlaubt.";
  if (template.subtasks.some((step) => step.title.trim().length < 2 || !Number.isInteger(step.offsetDays) || step.offsetDays < 0 || step.offsetDays > 365)) {
    return "Jede Unteraufgabe benötigt Titel und eine Frist zwischen 0 und 365 Tagen.";
  }
  return null;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    key: "plenarwoche",
    title: "Vorbereitung Plenarwoche",
    description: "Alles für die kommende Plenarwoche vorbereiten.",
    firstStep: "Tagesordnung sichten",
    dueInDays: 7,
    subtasks: [
      { title: "Tagesordnung sichten und Themen markieren", offsetDays: 1 },
      { title: "Fraktionsabstimmung vorbereiten", offsetDays: 3 },
      { title: "Redeentwurf schreiben", offsetDays: 4 },
      { title: "Briefingmappe zusammenstellen", offsetDays: 5 },
      { title: "Social-Media-Beiträge planen", offsetDays: 6 },
    ],
  },
  {
    key: "sprechstunde",
    title: "Bürgersprechstunde",
    description: "Sprechstunde vor- und nachbereiten.",
    firstStep: "Anmeldungen prüfen",
    dueInDays: 14,
    subtasks: [
      { title: "Anmeldungen prüfen und Termine vergeben", offsetDays: 2 },
      { title: "Anliegen recherchieren / Dossiers vorbereiten", offsetDays: 5 },
      { title: "Raum und Ablauf organisieren", offsetDays: 6 },
      { title: "Nachbereitung: Antwortbriefe versenden", offsetDays: 14 },
    ],
  },
  {
    key: "kleine-anfrage",
    title: "Kleine Anfrage an die Landesregierung",
    description: "Kleine Anfrage erarbeiten, einreichen und Antwortfrist überwachen.",
    firstStep: "Fachrecherche",
    dueInDays: 30,
    subtasks: [
      { title: "Fachrecherche und Fragestellung", offsetDays: 3 },
      { title: "Rechtliche / formale Prüfung", offsetDays: 5 },
      { title: "Freigabe durch Abgeordnete", offsetDays: 6 },
      { title: "Einreichen", offsetDays: 7 },
      { title: "Antwortfrist prüfen (21 Tage)", offsetDays: 28 },
    ],
  },
];

const addDays = (start: Date, days: number) => {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Builds the rows a template creates; ids are generated client-side to avoid INSERT…RETURNING. */
export function buildTemplateRows(template: TaskTemplate, ctx: { userId: string; tenantId: string; start?: Date; makeId?: () => string }) {
  const start = ctx.start ?? new Date();
  const makeId = ctx.makeId ?? (() => crypto.randomUUID());
  const parentId = makeId();
  const base = { user_id: ctx.userId, tenant_id: ctx.tenantId, assigned_to: ctx.userId, status: "todo", priority: "medium", category: "personal" };
  const parent = { ...base, id: parentId, title: template.title, description: template.description, due_date: addDays(start, template.dueInDays), next_action: template.firstStep, ball_owner: "office" };
  const children = template.subtasks.map((s) => ({ ...base, id: makeId(), title: s.title, description: null, due_date: addDays(start, s.offsetDays), parent_task_id: parentId }));
  return { parent, children };
}

export function subtaskProgress(subtasks: Array<{ status: string }>) {
  const done = subtasks.filter((s) => s.status === "completed").length;
  return { done, total: subtasks.length, percent: subtasks.length ? Math.round((done / subtasks.length) * 100) : 0 };
}
