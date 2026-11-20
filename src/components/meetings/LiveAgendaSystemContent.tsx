import { stripHtml } from "@/utils/textDiff";
import { useState } from "react";
import { MessageSquarePlus, Star } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SystemSubpointList } from "./agenda-editor/SystemSubpointList";
import type { AgendaItem, LinkedCaseItem, LinkedQuickNote, LinkedTask, MeetingUpcomingAppointment, Profile, RelevantDecision } from "./types";

export const liveAgendaSystemTypes = ["upcoming_appointments", "quick_notes", "tasks", "decisions", "case_items"];

export interface LiveAgendaSystemData {
  upcomingAppointments: MeetingUpcomingAppointment[];
  starredAppointmentIds: Set<string>;
  onToggleStar: (appointment: MeetingUpcomingAppointment) => void;
  onUpdateNoteResult: (noteId: string, result: string) => void;
  isLoading?: boolean;
}

export function LiveAgendaSystemContent({
  item, agendaNumber, profiles, linkedQuickNotes, linkedTasks, linkedCaseItems, relevantDecisions,
  upcomingAppointments, starredAppointmentIds, onToggleStar, onUpdateNoteResult, isLoading, onUpdateResult,
}: LiveAgendaSystemData & {
  item: AgendaItem;
  agendaNumber?: string;
  profiles: Profile[];
  linkedQuickNotes: LinkedQuickNote[];
  linkedTasks: LinkedTask[];
  linkedCaseItems: LinkedCaseItem[];
  relevantDecisions: RelevantDecision[];
  onUpdateResult: (itemId: string, field: "result_text", value: string) => void;
}) {
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const editableList = {
    agendaNumber,
    resultText: item.result_text,
    onUpdateResult: (value: string) => { if (item.id) onUpdateResult(item.id, "result_text", value); },
    checkable: true,
  };
  const editor = (title: string, value: string, onChange: (value: string) => void) => (
    <Textarea aria-label={title} value={value} onChange={(event) => onChange(event.target.value)}
      placeholder={title} className="mt-2 min-h-[60px] text-xs" />
  );
  const empty = (label: string) => (
    <p role="status" className="py-2 pl-[3.75rem] text-xs text-muted-foreground">
      {isLoading ? `${label} werden geladen …` : `Keine ${label} vorhanden`}
    </p>
  );
  const owner = (id?: string | null) => profiles.find((profile) => profile.user_id === id)?.display_name;

  switch (item.system_type) {
    case "upcoming_appointments":
      return upcomingAppointments.length ? (
        <SystemSubpointList {...editableList} label="Kommende Termine" entries={upcomingAppointments} titleOf={(entry) => entry.title}
          metadata={(entry) => (
            <time dateTime={entry.start_time} className="text-muted-foreground">
              {format(new Date(entry.start_time), "EEE, dd.MM. · HH:mm", { locale: de })} Uhr
              {entry.location && ` · ${entry.location}`}
            </time>
          )}
          actions={(entry) => (
            <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Termin vormerken: ${entry.title}`}
              aria-pressed={starredAppointmentIds.has(entry.id)} onClick={() => onToggleStar(entry)}>
              <Star className={cn("size-4", starredAppointmentIds.has(entry.id) && "fill-palette-amber text-palette-amber")} />
            </Button>
          )}
          details={(entry, result, patch) => result?.result || expandedNotes.has(entry.id) ? (
            editor("Terminnotiz", result?.result ?? "", (value) => patch({ result: value }))
          ) : (
            <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs"
              onClick={() => setExpandedNotes((previous) => new Set(previous).add(entry.id))}>
              <MessageSquarePlus className="size-3" /> Notiz
            </Button>
          )}
        />
      ) : empty("Termine");
    case "decisions":
      return relevantDecisions.length ? (
        <SystemSubpointList {...editableList} label="Entscheidungen" entries={relevantDecisions} titleOf={(entry) => entry.title || "Ohne Titel"}
          metadata={(entry) => entry.response_deadline && <span className="text-muted-foreground">Frist {format(new Date(entry.response_deadline), "dd.MM.yyyy")}</span>}
          details={(entry, result, patch) => (
            <>
              {entry.description && <RichTextDisplay content={entry.description} className="text-xs text-muted-foreground" />}
              {editor("Ergebnis zur Entscheidung", result?.result ?? "", (value) => patch({ result: value }))}
            </>
          )}
        />
      ) : empty("Entscheidungen");
    case "quick_notes":
      return linkedQuickNotes.length ? (
        <SystemSubpointList {...editableList} label="Notizen" entries={linkedQuickNotes} titleOf={(entry) => entry.title || "Notiz"}
          metadata={(entry) => <span className="text-muted-foreground">{owner(entry.user_id)}</span>}
          details={(entry) => (
            <>
              <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{stripHtml(entry.content)}</p>
              {editor("Ergebnis zur Notiz", entry.meeting_result || "", (value) => onUpdateNoteResult(entry.id, value))}
            </>
          )}
        />
      ) : empty("Notizen");
    case "tasks":
      return linkedTasks.length ? (
        <SystemSubpointList {...editableList} label="Aufgaben" entries={linkedTasks} titleOf={(entry) => entry.title}
          metadata={(entry) => <span className="text-muted-foreground">{owner(entry.user_id)}{entry.due_date && ` · Frist ${format(new Date(entry.due_date), "dd.MM.yyyy")}`}</span>}
          details={(entry, result, patch) => (
            <>
              {entry.description && <RichTextDisplay content={entry.description} className="text-xs text-muted-foreground" />}
              {editor("Ergebnis zur Aufgabe", result?.result ?? "", (value) => patch({ result: value }))}
            </>
          )}
        />
      ) : empty("Aufgaben");
    case "case_items":
      return linkedCaseItems.length ? (
        <SystemSubpointList {...editableList} label="Vorgänge" entries={linkedCaseItems} titleOf={(entry) => entry.subject || "Ohne Betreff"}
          details={(_entry, result, patch) => editor("Ergebnis zum Vorgang", result?.result ?? "", (value) => patch({ result: value }))}
        />
      ) : empty("Vorgänge");
    default:
      return null;
  }
}
