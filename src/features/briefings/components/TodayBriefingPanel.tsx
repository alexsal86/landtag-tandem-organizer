import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Check, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useTodayApprovedBriefings, type BriefingAppointment } from "@/features/appointments/briefing/useBriefing";
import { CompactBriefingEditor } from "@/features/appointments/briefing/CompactBriefingEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTodayBriefings } from "../hooks/useTodayBriefings";
import { useMarkBriefingRead } from "../hooks/useMarkBriefingRead";
import type { DailyBriefingWithAuthor } from "../types";

const COLLAPSE_AT = 320;

function BriefingItem({ briefing, moreAction, onRead }: {
  briefing: DailyBriefingWithAuthor; moreAction?: ReactNode; onRead?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const markRead = useMarkBriefingRead();
  const tooLong = briefing.content.length > COLLAPSE_AT;
  const initials = (briefing.author_display_name ?? "?").trim().split(/\s+/)
    .map(part => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return <section aria-label="Tagesbriefing" className="rounded-3xl bg-[#f0eafa] p-5">
    <div className="flex items-start gap-4">
      <Avatar className="h-8 w-8 shrink-0">
        {briefing.author_avatar_url && <AvatarImage src={briefing.author_avatar_url} alt="" />}
        <AvatarFallback className="bg-white text-sm font-semibold text-[#8b5cf6]">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-sm font-semibold text-foreground">{briefing.author_display_name ?? "Teammitglied"}</p>
          <span className="text-xs text-muted-foreground">Tagesbriefing</span>
          {!briefing.is_read && <span className="ml-1 text-xs font-medium text-[#8b5cf6]">Neu</span>}
        </div>
        {briefing.title && <p className="text-sm font-medium text-foreground">{briefing.title}</p>}
        <div className={cn(!expanded && tooLong && "line-clamp-5")}>
          <RichTextDisplay content={briefing.content} className="text-sm leading-relaxed text-foreground" />
        </div>
        {tooLong && <Button variant="link" size="sm" className="h-auto p-0 text-xs text-[#8b5cf6]"
          onClick={() => setExpanded(value => !value)}>
          {expanded ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
          {expanded ? "Weniger anzeigen" : "Mehr anzeigen"}
        </Button>}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {!briefing.is_read ? <Button variant="link" size="sm" className="h-auto p-0 text-sm text-[#8b5cf6]"
            disabled={markRead.isPending} onClick={() => { onRead?.(); markRead.mutate(briefing.id); }}>
            {markRead.isPending ? "Wird markiert…" : "Als gelesen markieren"}
          </Button> : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3 w-3" />Gelesen</span>}
          {moreAction}
        </div>
      </div>
    </div>
  </section>;
}

function AppointmentBriefingItem({ a }: { a: BriefingAppointment }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{a.title}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(a.start_time), "HH:mm", { locale: de })} Uhr{a.location ? ` · ${a.location}` : ""} · Briefing freigegeben
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><FileText className="mr-1 h-3.5 w-3.5" />Öffnen</Button>
      <CompactBriefingEditor open={open} onOpenChange={setOpen} appointmentId={a.id} title={a.title} />
    </div>
  );
}

export function TodayBriefingPanel() {
  const { data: briefings = [], isLoading } = useTodayBriefings();
  const { data: apptBriefings = [] } = useTodayApprovedBriefings();
  const [showMore, setShowMore] = useState(false);
  const [primaryId, setPrimaryId] = useState<string | null>(null);

  if (isLoading) return null;
  if (briefings.length === 0 && apptBriefings.length === 0) return null;

  // Ungelesene zuerst, gelesene unten
  const sorted = [...briefings].sort((a, b) => {
    if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
    return b.created_at.localeCompare(a.created_at);
  });

  const primary = sorted.find(briefing => briefing.id === primaryId) ?? sorted[0];
  const others = sorted.filter(briefing => briefing.id !== primary?.id);
  const names = [...new Set(others.map(briefing => briefing.author_display_name?.trim() || "Teammitglied"))];
  const authorList = new Intl.ListFormat("de", { style: "short", type: "conjunction" }).format(names);

  return <div className="animate-rise space-y-4">
    {primary && <BriefingItem key={primary.id} briefing={primary} onRead={() => setPrimaryId(primary.id)}
      moreAction={others.length > 0 ? <Button variant="link" size="sm"
        className="h-auto max-w-full whitespace-normal p-0 text-left text-sm text-muted-foreground"
        aria-expanded={showMore} aria-controls="additional-daily-briefings" onClick={() => setShowMore(value => !value)}>
        {showMore ? "Weitere Briefings ausblenden" : `+${others.length} ${others.length === 1 ? "weiteres" : "weitere"} von ${authorList}`}
      </Button> : undefined} />}
    {showMore && others.length > 0 && <div id="additional-daily-briefings" className="animate-fade-up space-y-4">
      {others.map(briefing => <BriefingItem key={briefing.id} briefing={briefing} />)}
    </div>}
    {apptBriefings.length > 0 && <Card className="dashboard-motion-card">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-base font-medium">Termin-Briefings heute</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-5 pb-5 pt-0">
        {apptBriefings.map(appointment => <AppointmentBriefingItem key={appointment.id} a={appointment} />)}
      </CardContent>
    </Card>}
  </div>;
}
