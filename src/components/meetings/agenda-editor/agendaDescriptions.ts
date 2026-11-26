import { stripHtml } from "@/utils/textDiff";
import { systemAgendaOption } from "../systemAgendaRegistry";
import type {
  AgendaItem,
  LinkedCaseItem,
  LinkedQuickNote,
  LinkedTask,
  Profile,
  RelevantDecision,
  SystemAgendaType,
} from "@/components/meetings/types";

/** Fasst Personen als "2× Name · 1× Name" zusammen. */
export function countByPerson(
  profiles: Profile[],
  label: string,
  people: (string | null | undefined)[],
): string {
  const counts = new Map<string, number>();
  for (const person of people) {
    if (person) counts.set(person, (counts.get(person) ?? 0) + 1);
  }
  return [
    label,
    ...Array.from(
      counts,
      ([id, count]) =>
        `${count}× ${profiles.find((profile) => profile.user_id === id)?.display_name || "Unbekannte Person"}`,
    ),
  ].join(" · ");
}

export interface SystemDescriptionInput {
  profiles: Profile[];
  meetingNotes: LinkedQuickNote[];
  meetingLinkedTasks: LinkedTask[];
  meetingLinkedCaseItems: LinkedCaseItem[];
  meetingRelevantDecisions: RelevantDecision[];
}

/** Standardbeschreibung je Systempunkt aus den verknüpften Meeting-Daten. */
export function buildSystemDescriptions({
  profiles,
  meetingNotes,
  meetingLinkedTasks,
  meetingLinkedCaseItems,
  meetingRelevantDecisions,
}: SystemDescriptionInput): Partial<Record<SystemAgendaType, string>> {
  const taskCount = meetingLinkedTasks.length;
  const caseCount = meetingLinkedCaseItems.length;
  const decisionCount = meetingRelevantDecisions.filter(
    (decision) => decision.status === "active",
  ).length;

  return {
    quick_notes: countByPerson(
      profiles,
      meetingNotes.length === 0
        ? "Keine Notiz vorhanden"
        : meetingNotes.length === 1
          ? "1 Notiz"
          : `${meetingNotes.length} Notizen`,
      meetingNotes.map((note) => note.user_id),
    ),
    tasks: countByPerson(
      profiles,
      taskCount === 0 ? "Keine Aufgabe vorhanden" : taskCount === 1 ? "1 Aufgabe" : `${taskCount} Aufgaben`,
      meetingLinkedTasks.map((task) => task.assigned_to),
    ),
    case_items: countByPerson(
      profiles,
      caseCount === 0 ? "Kein Vorgang vorhanden" : caseCount === 1 ? "1 Vorgang" : `${caseCount} Vorgänge`,
      meetingLinkedCaseItems.map((item) => item.owner_user_id),
    ),
    decisions:
      decisionCount === 0
        ? "Keine Entscheidung steht aus"
        : decisionCount === 1
          ? "1 Entscheidung steht aus"
          : `${decisionCount} Entscheidungen stehen aus`,
  };
}

export interface AgendaDescriptionContext {
  meetingId: string | undefined;
  getItemKey: (item: AgendaItem, index: number) => string;
  systemCounts: Record<string, number | null>;
  remoteDescriptions: Record<string, string>;
  descriptions: Partial<Record<SystemAgendaType, string>>;
  upcomingAppointmentCount?: number;
}

/**
 * Beschreibung eines Agenda-Punkts: manuell gepflegte Beschreibung gewinnt,
 * danach zählen generierte Einträge, dann die Standardtexte der Systempunkte.
 */
export function resolveAgendaDescription(
  item: AgendaItem,
  index: number,
  {
    meetingId,
    getItemKey,
    systemCounts,
    remoteDescriptions,
    descriptions,
    upcomingAppointmentCount,
  }: AgendaDescriptionContext,
): string | undefined {
  const type = item.system_type as SystemAgendaType | undefined;
  if (!type) return item.description ?? undefined;

  const description = stripHtml(item.description ?? "");
  // Earlier versions stored the generated note summary in the description.
  const legacyNoteSummary =
    type === "quick_notes" && /^\d+ Notiz(?:en)?(?:(?: · |\. )\d+× .+)+$/.test(description);
  if (description && !legacyNoteSummary) return item.description ?? undefined;

  const key = getItemKey(item, index);
  const count = systemCounts[key];
  if (type === "upcoming_appointments") {
    const appointments = upcomingAppointmentCount ?? count;
    if (appointments === 0) return "Kein Termin vorhanden";
    if (appointments != null) return appointments === 1 ? "1 Termin" : `${appointments} Termine`;
  }

  if (type === "appointment_requests" && count != null && count > 0) {
    return count === 1 ? "1 offener Eintrag" : `${count} offene Einträge`;
  }
  return (
    descriptions[type] ??
    remoteDescriptions[`${meetingId}:${key}`] ??
    (count === 0 ? systemAgendaOption(type)?.emptyDescription : undefined)
  );
}
