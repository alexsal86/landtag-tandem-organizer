/**
 * Returns semantic Tailwind classes for an agenda system item type.
 * Tokens are defined in src/index.css and tailwind.config.ts under "agenda-*".
 */
export type AgendaSystemType =
  | "upcoming_appointments"
  | "quick_notes"
  | "tasks"
  | "birthdays"
  | "decisions";

interface AgendaTokenSet {
  token: string; // suffix used in agenda-<token>
  iconText: string;
}

const AGENDA_TOKENS: Record<AgendaSystemType, AgendaTokenSet> = {
  upcoming_appointments: { token: "appointments", iconText: "text-agenda-appointments" },
  quick_notes: { token: "notes", iconText: "text-agenda-notes" },
  tasks: { token: "tasks", iconText: "text-agenda-tasks" },
  birthdays: { token: "birthdays", iconText: "text-agenda-birthdays" },
  decisions: { token: "decisions", iconText: "text-agenda-decisions" },
};

export function getAgendaSystemItemClass(systemType: string): string {
  const entry = AGENDA_TOKENS[systemType as AgendaSystemType];
  if (!entry) return "";
  return `border-l-4 border-l-agenda-${entry.token} bg-agenda-${entry.token}/10`;
}

export function getAgendaChildClass(systemType: string): string {
  const entry = AGENDA_TOKENS[systemType as AgendaSystemType] ?? AGENDA_TOKENS.quick_notes;
  return `bg-agenda-${entry.token}/10 border-agenda-${entry.token}/30`;
}

export function getAgendaIconColor(systemType: string): string {
  return AGENDA_TOKENS[systemType as AgendaSystemType]?.iconText ?? "";
}

export function getAgendaToggleClass(systemType: string): string {
  const entry = AGENDA_TOKENS[systemType as AgendaSystemType] ?? AGENDA_TOKENS.quick_notes;
  return `border-agenda-${entry.token}/30 text-agenda-${entry.token} hover:bg-agenda-${entry.token}/10`;
}
