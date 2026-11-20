import { useState } from "react";
import { Briefcase, CalendarDays, Clock, ListTodo, MessageSquarePlus, Scale, Star, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { agendaSubpointListClass, agendaSubpointNumber, agendaSubpointRowClass } from "./agenda-editor/systemSubpoints";
import { parseMeetingResults } from "./platformAgendaRules";
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
  const [expandedApptNotes, setExpandedApptNotes] = useState<Set<string>>(new Set());
  const onExpandApptNote = (id: string) => setExpandedApptNotes((previous) => new Set(previous).add(id));
  const getProfile = (id: string) => profiles.find((profile) => profile.user_id === id);

  const renderLoadingState = (label: string) => (
    <div className="pl-4 space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 animate-spin" />
        <span>{label} werden geladen ...</span>
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );

  const renderAppointmentNotes = (parentItem: AgendaItem) => {
    const apptResults = parseMeetingResults(parentItem.result_text);
    return upcomingAppointments.length > 0 ? (
      upcomingAppointments.map((appt, apptIdx) => (
        <div key={appt.id} className={cn(agendaSubpointRowClass, "space-y-2", starredAppointmentIds.has(appt.id) && "bg-palette-amber/5")}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" aria-label={`Termin vormerken: ${appt.title}`} aria-pressed={starredAppointmentIds.has(appt.id)} onClick={(e) => { e.stopPropagation(); onToggleStar(appt); }}>
              <Star className={cn("h-3.5 w-3.5", starredAppointmentIds.has(appt.id) ? "fill-palette-amber text-palette-amber" : "text-muted-foreground")} />
            </Button>
            <span className="text-xs font-medium text-muted-foreground">{agendaSubpointNumber(agendaNumber, apptIdx)}</span>
            <CalendarDays className="h-3.5 w-3.5 text-palette-blue" />
            <span className="text-xs font-normal">{appt.title}</span>
          </div>
          <p className="text-xs text-muted-foreground ml-8">
            {format(new Date(appt.start_time), "EEE dd.MM. HH:mm", { locale: de })}
            {appt.end_time && ` - ${format(new Date(appt.end_time), "HH:mm")}`}
            {appt.location && ` | ${appt.location}`}
          </p>
          {(apptResults[appt.id] || expandedApptNotes.has(appt.id)) ? (
            <div className="ml-8">
              <Textarea value={apptResults[appt.id]?.result || ''} onChange={(e) => {
                const newResults = { ...apptResults, [appt.id]: { ...apptResults[appt.id], result: e.target.value } };
                onUpdateResult(parentItem.id!, 'result_text', JSON.stringify(newResults));
              }} placeholder="Notizen zu diesem Termin..." className="min-h-[60px] text-xs" />
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground ml-8" onClick={() => onExpandApptNote(appt.id)}>
              <MessageSquarePlus className="h-3 w-3 mr-1" /> Notiz
            </Button>
          )}
        </div>
      ))
    ) : isLoading ? renderLoadingState('Termine') : <p className="text-sm text-muted-foreground pl-4">Keine Termine in den nächsten 2 Wochen.</p>;
  };

  const renderQuickNotes = () => (
    linkedQuickNotes.length > 0 ? linkedQuickNotes.map((note, noteIdx) => (
      <div key={note.id} className={cn(agendaSubpointRowClass, "space-y-2")}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{agendaSubpointNumber(agendaNumber, noteIdx)}</span>
          <StickyNote className="h-3.5 w-3.5 text-palette-amber" />
          <span className="text-xs font-normal">{note.title || `Notiz ${noteIdx + 1}`}</span>
        </div>
        <RichTextDisplay content={note.content} className="text-sm text-muted-foreground" />
        {note.user_id && (() => {
          const profile = getProfile(note.user_id);
          return profile ? (
            <div className="flex items-center gap-1.5 ml-6 mt-1">
              <Avatar className="h-5 w-5"><AvatarImage src={profile.avatar_url || undefined} /><AvatarFallback className="text-[10px]">{(profile.display_name || '?').charAt(0).toUpperCase()}</AvatarFallback></Avatar>
              <span className="text-xs text-muted-foreground">{profile.display_name}</span>
            </div>
          ) : null;
        })()}
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
          <Textarea value={note.meeting_result || ''} onChange={(e) => onUpdateNoteResult(note.id, e.target.value)} placeholder="Ergebnis für diese Notiz..." className="min-h-[60px] text-xs" />
        </div>
      </div>
    )) : isLoading ? renderLoadingState('Notizen') : <p className="text-sm text-muted-foreground pl-4">Keine Notizen vorhanden.</p>
  );

  const renderLinkedTasks = (parentItem: AgendaItem) => {
    const taskResults = parseMeetingResults(parentItem.result_text);
    return linkedTasks.length > 0 ? linkedTasks.map((task, taskIdx) => (
      <div key={task.id} className={cn(agendaSubpointRowClass, "space-y-2")}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{agendaSubpointNumber(agendaNumber, taskIdx)}</span>
          <ListTodo className="h-3.5 w-3.5 text-palette-green" />
          <span className="text-xs font-normal">{task.title}</span>
        </div>
        {task.description && <RichTextDisplay content={task.description} className="text-sm text-muted-foreground" />}
        {task.user_id && (() => {
          const profile = getProfile(task.user_id);
          return profile ? (
            <div className="flex items-center gap-1.5 ml-6 mt-1">
              <Avatar className="h-5 w-5"><AvatarImage src={profile.avatar_url || undefined} /><AvatarFallback className="text-[10px]">{(profile.display_name || '?').charAt(0).toUpperCase()}</AvatarFallback></Avatar>
              <span className="text-xs text-muted-foreground">{profile.display_name}</span>
            </div>
          ) : null;
        })()}
        {task.due_date && <p className="text-xs text-muted-foreground">Frist: {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}</p>}
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
          <Textarea value={taskResults[task.id]?.result || ''} onChange={(e) => {
            const newResults = { ...taskResults, [task.id]: { ...taskResults[task.id], result: e.target.value } };
            onUpdateResult(parentItem.id!, 'result_text', JSON.stringify(newResults));
          }} placeholder="Ergebnis für diese Aufgabe..." className="min-h-[60px] text-xs" />
        </div>
      </div>
    )) : isLoading ? renderLoadingState('Aufgaben') : <p className="text-sm text-muted-foreground pl-4">Keine Aufgaben vorhanden.</p>;
  };

  const renderDecisions = (parentItem: AgendaItem) => {
    const decisionResults = parseMeetingResults(parentItem.result_text);
    return relevantDecisions.length > 0 ? relevantDecisions.map((decision, idx) => (
      <div key={decision.id} className={cn(agendaSubpointRowClass, "space-y-2")}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{agendaSubpointNumber(agendaNumber, idx)}</span>
          <Scale className="h-3.5 w-3.5 text-palette-violet" />
          <span className="text-xs font-normal">{decision.title}</span>
        </div>
        {decision.description && <RichTextDisplay content={decision.description} className="text-sm text-muted-foreground" />}
        {decision.response_deadline && <p className="text-xs text-muted-foreground">Frist: {format(new Date(decision.response_deadline), "dd.MM.yyyy", { locale: de })}</p>}
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
          <Textarea value={decisionResults[decision.id]?.result || ''} onChange={(e) => {
            const newResults = { ...decisionResults, [decision.id]: { ...decisionResults[decision.id], result: e.target.value } };
            onUpdateResult(parentItem.id!, 'result_text', JSON.stringify(newResults));
          }} placeholder="Ergebnis für diese Entscheidung..." className="min-h-[60px] text-xs" />
        </div>
      </div>
    )) : isLoading ? renderLoadingState('Entscheidungen') : <p className="text-sm text-muted-foreground pl-4">Keine Entscheidungen vorhanden.</p>;
  };

  const renderCaseItems = (parentItem: AgendaItem) => {
    const ciResults = parseMeetingResults(parentItem.result_text);
    return linkedCaseItems.length > 0 ? linkedCaseItems.map((ci, idx) => (
      <div key={ci.id} className={cn(agendaSubpointRowClass, "space-y-2")}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{agendaSubpointNumber(agendaNumber, idx)}</span>
          <Briefcase className="h-3.5 w-3.5 text-palette-teal" />
          <span className="text-xs font-normal">{ci.subject || '(Kein Betreff)'}</span>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
          <Textarea value={ciResults[ci.id]?.result || ''} onChange={(e) => {
            const newResults = { ...ciResults, [ci.id]: { ...ciResults[ci.id], result: e.target.value } };
            onUpdateResult(parentItem.id!, 'result_text', JSON.stringify(newResults));
          }} placeholder="Ergebnis für diesen Vorgang..." className="min-h-[60px] text-xs" />
        </div>
      </div>
    )) : isLoading ? renderLoadingState('Vorgänge') : <p className="text-sm text-muted-foreground pl-4">Keine Vorgänge vorhanden.</p>;
  };

  const content = {
    upcoming_appointments: renderAppointmentNotes,
    quick_notes: renderQuickNotes,
    tasks: renderLinkedTasks,
    decisions: renderDecisions,
    case_items: renderCaseItems,
  };
  const render = content[item.system_type as keyof typeof content];
  return render ? <div className={agendaSubpointListClass}>{render(item)}</div> : null;
}
