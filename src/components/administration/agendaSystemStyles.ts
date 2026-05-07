/**
 * Returns semantic Tailwind classes for an agenda system item type.
 * Tokens are defined in src/index.css and tailwind.config.ts under "agenda-*".
 *
 * IMPORTANT: All class strings are written out literally so the Tailwind
 * scanner can pick them up.
 */
export type AgendaSystemType =
  | "upcoming_appointments"
  | "quick_notes"
  | "tasks"
  | "birthdays"
  | "decisions";

interface AgendaStyleSet {
  systemItem: string;
  child: string;
  icon: string;
  toggle: string;
}

const FALLBACK: AgendaStyleSet = {
  systemItem: "",
  child:
    "bg-agenda-notes/10 border-agenda-notes/30",
  icon: "text-agenda-notes",
  toggle:
    "border-agenda-notes/30 text-agenda-notes hover:bg-agenda-notes/10",
};

const AGENDA_STYLES: Record<AgendaSystemType, AgendaStyleSet> = {
  upcoming_appointments: {
    systemItem:
      "border-l-4 border-l-agenda-appointments bg-agenda-appointments/10",
    child:
      "bg-agenda-appointments/10 border-agenda-appointments/30",
    icon: "text-agenda-appointments",
    toggle:
      "border-agenda-appointments/30 text-agenda-appointments hover:bg-agenda-appointments/10",
  },
  quick_notes: {
    systemItem:
      "border-l-4 border-l-agenda-notes bg-agenda-notes/10",
    child:
      "bg-agenda-notes/10 border-agenda-notes/30",
    icon: "text-agenda-notes",
    toggle:
      "border-agenda-notes/30 text-agenda-notes hover:bg-agenda-notes/10",
  },
  tasks: {
    systemItem:
      "border-l-4 border-l-agenda-tasks bg-agenda-tasks/10",
    child:
      "bg-agenda-tasks/10 border-agenda-tasks/30",
    icon: "text-agenda-tasks",
    toggle:
      "border-agenda-tasks/30 text-agenda-tasks hover:bg-agenda-tasks/10",
  },
  birthdays: {
    systemItem:
      "border-l-4 border-l-agenda-birthdays bg-agenda-birthdays/10",
    child:
      "bg-agenda-birthdays/10 border-agenda-birthdays/30",
    icon: "text-agenda-birthdays",
    toggle:
      "border-agenda-birthdays/30 text-agenda-birthdays hover:bg-agenda-birthdays/10",
  },
  decisions: {
    systemItem:
      "border-l-4 border-l-agenda-decisions bg-agenda-decisions/10",
    child:
      "bg-agenda-decisions/10 border-agenda-decisions/30",
    icon: "text-agenda-decisions",
    toggle:
      "border-agenda-decisions/30 text-agenda-decisions hover:bg-agenda-decisions/10",
  },
};

function get(systemType: string): AgendaStyleSet {
  return AGENDA_STYLES[systemType as AgendaSystemType] ?? FALLBACK;
}

export const getAgendaSystemItemClass = (t: string) => get(t).systemItem;
export const getAgendaChildClass = (t: string) => get(t).child;
export const getAgendaIconColor = (t: string) => get(t).icon;
export const getAgendaToggleClass = (t: string) => get(t).toggle;
