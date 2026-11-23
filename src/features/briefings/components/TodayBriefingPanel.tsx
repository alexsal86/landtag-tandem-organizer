import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Check, ChevronDown, ChevronUp, FileText, Sparkles } from "lucide-react";
import { useTodayApprovedBriefings, type BriefingAppointment } from "@/features/appointments/briefing/useBriefing";
import { CompactBriefingEditor } from "@/features/appointments/briefing/CompactBriefingEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTodayBriefings } from "../hooks/useTodayBriefings";
import { useMarkBriefingRead } from "../hooks/useMarkBriefingRead";
import type { DailyBriefingWithAuthor } from "../types";

const COLLAPSE_AT = 320;

function BriefingItem({ briefing }: { briefing: DailyBriefingWithAuthor }) {
  const [expanded, setExpanded] = useState(false);
  const markRead = useMarkBriefingRead();
  const tooLong = briefing.content.length > COLLAPSE_AT;

  const initials = (briefing.author_display_name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-opacity",
        briefing.is_read && "opacity-60 bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Avatar className="h-9 w-9">
            {briefing.author_avatar_url && (
              <AvatarImage src={briefing.author_avatar_url} alt="" />
            )}
            <AvatarFallback>{initials || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium truncate">
                {briefing.author_display_name ?? "Teammitglied"}
              </p>
              <span className="text-xs text-muted-foreground">
                verfasst {formatDistanceToNow(new Date(briefing.created_at), { locale: de, addSuffix: true })}
              </span>
              {briefing.is_read && (
                <Badge variant="secondary" className="text-[10px]">Gelesen</Badge>
              )}
            </div>
            {briefing.title && (
              <p className="mt-0.5 text-sm font-semibold">{briefing.title}</p>
            )}
          </div>
        </div>
        {!briefing.is_read && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markRead.mutate(briefing.id)}
            disabled={markRead.isPending}
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Gelesen
          </Button>
        )}
      </div>
      <div className={cn("mt-3", !expanded && tooLong && "line-clamp-5")}>
        <RichTextDisplay content={briefing.content} className="text-sm leading-relaxed text-foreground/90" />
      </div>
      {tooLong && (
        <Button
          variant="link"
          size="sm"
          className="mt-1 h-auto p-0 text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-1 h-3 w-3" /> Weniger anzeigen
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-3 w-3" /> Mehr anzeigen
            </>
          )}
        </Button>
      )}
    </div>
  );
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

  if (isLoading) return null;
  if (briefings.length === 0 && apptBriefings.length === 0) return null;

  // Ungelesene zuerst, gelesene unten
  const sorted = [...briefings].sort((a, b) => {
    if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
    return b.created_at.localeCompare(a.created_at);
  });

  const unreadCount = briefings.filter((b) => !b.is_read).length;

  return (
    <Card className="dashboard-motion-card animate-rise">
      <CardHeader className="flex min-h-[52px] flex-row flex-wrap items-center justify-between gap-2 space-y-0 py-space-sm px-space-md">
        <CardTitle className="inline-flex items-center gap-2 text-base font-medium leading-6">
          <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          Briefing für heute
          {unreadCount > 0 && (
            <Badge variant="default" className="ml-1">{unreadCount} neu</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-space-md pb-space-md pt-0">
        {apptBriefings.length > 0 && (
          <div className="space-y-2">
            <p className="section-label">Termin-Briefings heute</p>
            {apptBriefings.map((a) => <AppointmentBriefingItem key={a.id} a={a} />)}
          </div>
        )}
        {sorted.map((b) => (
          <BriefingItem key={b.id} briefing={b} />
        ))}
      </CardContent>
    </Card>
  );
}
