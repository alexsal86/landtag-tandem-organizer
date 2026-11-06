import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Vote, Calendar as CalendarIcon, ChevronDown, CheckSquare, FileText } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Panel = "decision" | "meeting" | null;

const decisionStatusLabel: Record<string, string> = {
  active: "Offen", open: "Offen", completed: "Abgeschlossen", archived: "Archiviert", draft: "Entwurf",
};

function stop(e: React.SyntheticEvent) { e.stopPropagation(); }

export const noteChipBase =
  "inline-flex h-7 items-center gap-2 rounded-md border border-border bg-background/60 px-2.5 text-xs font-medium hover:bg-muted/60 cursor-pointer text-foreground transition-colors duration-fast ease-standard hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function DecisionDetails({ id, canEdit, onOpen, onRemove }: { id: string; canEdit: boolean; onOpen: () => void; onRemove: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["note-chip-decision", id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: d } = await supabase.from("task_decisions").select("title, status, response_deadline").eq("id", id).maybeSingle();
      const { data: parts } = await supabase.from("task_decision_participants").select("user_id").eq("decision_id", id);
      const ids = (parts ?? []).map((p) => p.user_id);
      let names: string[] = [];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
        names = (profs ?? []).map((p) => p.display_name).filter((n): n is string => !!n);
      }
      return d ? { ...d, names } : null;
    },
  });
  if (isLoading) return <Skeleton className="h-4 w-40" />;
  if (!data) return <p className="text-muted-foreground">Entscheidung nicht gefunden</p>;
  return (
    <div className="space-y-1">
      <p className="font-medium">{data.title}</p>
      {data.status && <p className="text-muted-foreground">Status: {decisionStatusLabel[data.status] ?? data.status}</p>}
      {data.response_deadline && <p className="text-muted-foreground">Frist: {format(new Date(data.response_deadline), "dd.MM.yyyy", { locale: de })}</p>}
      {data.names.length > 0 && <p className="text-muted-foreground">Entscheider: {data.names.join(", ")}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { stop(e); onOpen(); }}>Entscheidung öffnen</Button>
        {canEdit && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={(e) => { stop(e); onRemove(); }}>Zurücknehmen</Button>}
      </div>
    </div>
  );
}

function MeetingDetails({ id, canEdit, onOpen, onRemove }: { id: string; canEdit: boolean; onOpen: () => void; onRemove: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["note-chip-meeting", id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: m } = await supabase.from("meetings").select("title, meeting_date, meeting_time").eq("id", id).maybeSingle();
      const { count } = await supabase.from("meeting_participants").select("id", { count: "exact", head: true }).eq("meeting_id", id);
      return m ? { ...m, participants: count ?? 0 } : null;
    },
  });
  if (isLoading) return <Skeleton className="h-4 w-40" />;
  if (!data) return <p className="text-muted-foreground">Jour fixe nicht gefunden</p>;
  return (
    <div className="space-y-1">
      <p className="font-medium">{data.title}</p>
      {data.meeting_date && (
        <p className="text-muted-foreground">
          Termin: {format(new Date(data.meeting_date), "EEEE, dd.MM.yyyy", { locale: de })}
          {data.meeting_time ? `, ${data.meeting_time.slice(0, 5)} Uhr` : " · ganztägig"}
        </p>
      )}
      {data.participants > 0 && <p className="text-muted-foreground">{data.participants} Teilnehmende</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { stop(e); onOpen(); }}>Jour fixe öffnen</Button>
        {canEdit && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={(e) => { stop(e); onRemove(); }}>Vom Jour fixe entfernen</Button>}
      </div>
    </div>
  );
}

interface Props {
  taskId?: string | null;
  decisionId?: string | null;
  caseItemId?: string | null;
  meetingId?: string | null;
  meetingDate?: string | null;
  canEdit: boolean;
  onRemoveDecision: () => void;
  onRemoveFromMeeting: () => void;
  extra?: React.ReactNode;
}

export function NoteStatusChips({ taskId, decisionId, caseItemId, meetingId, meetingDate, canEdit, onRemoveDecision, onRemoveFromMeeting, extra }: Props) {
  const [open, setOpen] = useState<Panel>(null);
  const navigate = useNavigate();
  if (!taskId && !decisionId && !caseItemId && !meetingId && !extra) return null;
  const toggle = (p: Exclude<Panel, null>) => (e: React.MouseEvent) => { stop(e); setOpen((cur) => (cur === p ? null : p)); };
  const chev = (p: Panel) => <ChevronDown className={cn("h-3 w-3 transition-transform duration-fast", open === p && "rotate-180")} />;

  return (
    <div className="mt-2" onClick={stop} onKeyDown={stop}>
      <div className="flex flex-wrap gap-1.5">
        {decisionId && (
          <button type="button" aria-expanded={open === "decision"} className={cn(noteChipBase, open === "decision" && "bg-muted text-foreground")} onClick={toggle("decision")}>
            <Vote className="h-3.5 w-3.5" />Entscheidung{chev("decision")}
          </button>
        )}
        {meetingId && (
          <button type="button" aria-expanded={open === "meeting"} className={cn(noteChipBase, open === "meeting" && "bg-muted text-foreground")} onClick={toggle("meeting")}>
            <CalendarIcon className="h-3.5 w-3.5" />Jour fixe{meetingDate ? ` ${format(new Date(meetingDate), "dd.MM.", { locale: de })}` : ""}{chev("meeting")}
          </button>
        )}
        {taskId && (
          <button type="button" className={noteChipBase} onClick={(e) => { stop(e); navigate(`/mywork?tab=tasks&highlight=${taskId}`); }}>
            <CheckSquare className="h-3.5 w-3.5" />Aufgabe
          </button>
        )}
        {caseItemId && (
          <button type="button" className={noteChipBase} onClick={(e) => { stop(e); navigate(`/mywork?tab=cases&caseItemId=${caseItemId}`); }}>
            <FileText className="h-3.5 w-3.5" />Vorgang
          </button>
        )}
        {extra}
      </div>
      {open && (
        <div className="mt-2 rounded-md bg-muted/60 p-2.5 text-[13px] animate-in fade-in-0 slide-in-from-top-1 duration-fast">
          {open === "decision" && decisionId && (
            <DecisionDetails id={decisionId} canEdit={canEdit} onOpen={() => navigate(`/mywork?tab=decisions&highlight=${decisionId}`)} onRemove={() => { setOpen(null); onRemoveDecision(); }} />
          )}
          {open === "meeting" && meetingId && (
            <MeetingDetails id={meetingId} canEdit={canEdit} onOpen={() => navigate(`/meetings?highlight=${meetingId}`)} onRemove={() => { setOpen(null); onRemoveFromMeeting(); }} />
          )}
        </div>
      )}
    </div>
  );
}
