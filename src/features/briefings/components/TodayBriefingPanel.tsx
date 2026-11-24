import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useUserPreference } from "@/hooks/useUserPreference";
import { dailyBriefingTargetLabel, dailyBriefingReadLabel, isReadBriefingCollapsed } from "../utils";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronDown, ChevronUp, FileText, X } from "lucide-react";
import { useTodayApprovedBriefings, type BriefingAppointment } from "@/features/appointments/briefing/useBriefing";
import { CompactBriefingEditor } from "@/features/appointments/briefing/CompactBriefingEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTodayBriefings, useUpcomingBriefings } from "../hooks/useTodayBriefings";
import { useMarkBriefingRead } from "../hooks/useMarkBriefingRead";
import type { DailyBriefingWithAuthor } from "../types";

const COLLAPSE_AT = 320;

function BriefingItem({ briefing, moreAction, onRead, targetLabel, preview = false }: {
  briefing: DailyBriefingWithAuthor; moreAction?: ReactNode; onRead?: () => void; targetLabel?: string; preview?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [previewOpened, setPreviewOpened] = useState(false);
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [collapsed, setCollapsed] = useUserPreference<boolean>(
    `daily-briefing-collapsed:${currentTenant?.id}:${user?.id}:${briefing.id}`, false,
  );
  const sectionRef = useRef<HTMLElement | null>(null);
  const previousRect = useRef<DOMRect | null>(null);
  const isCollapsed = isReadBriefingCollapsed(briefing.is_read, collapsed);
  const isPreview = preview && !previewOpened && !briefing.is_read;
  const viewMode = isPreview ? "preview" : isCollapsed ? "collapsed" : "expanded";
  const toggleCollapsed = (value: boolean) => {
    previousRect.current = sectionRef.current?.getBoundingClientRect() ?? null;
    setCollapsed(value);
  };
  useLayoutEffect(() => {
    const before = previousRect.current;
    previousRect.current = null;
    const element = sectionRef.current;
    if (!before || !element || !element.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const after = element.getBoundingClientRect();
    if (!after.width || !after.height) return;
    const animation = element.animate([
      { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`, opacity: 0.65 },
      { transform: 'none', opacity: 1 },
    ], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    return () => animation.cancel();
  }, [viewMode]);
  const markRead = useMarkBriefingRead();
  const tooLong = briefing.content.length > COLLAPSE_AT;
  const initials = (briefing.author_display_name ?? "?").trim().split(/\s+/)
    .map(part => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  if (isPreview) return <section ref={sectionRef} aria-label={`Tagesbriefing ${targetLabel ?? ""} vorab lesen`}
    className="origin-top-left rounded-3xl bg-[#f0eafa] px-5 py-3">
    <button type="button" aria-expanded={false} onClick={() => {
      previousRect.current = sectionRef.current?.getBoundingClientRect() ?? null;
      setPreviewOpened(true);
    }}
      className="flex w-full flex-wrap items-center justify-between gap-2 rounded text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <span>Tagesbriefing {targetLabel} liegt bereit</span>
      <span className="inline-flex items-center gap-2 text-xs text-[#8b5cf6]">Vorab lesen<ChevronDown className="h-4 w-4" aria-hidden="true" /></span>
    </button>
  </section>;

  if (isCollapsed) return <section ref={sectionRef} aria-label="Eingeklapptes Tagesbriefing"
    className="ml-auto flex w-fit max-w-full origin-top-left flex-wrap items-center justify-end gap-3 rounded-xl bg-[rgb(240,243,246)] px-5 py-2">
    <button type="button" onClick={() => toggleCollapsed(false)} aria-expanded={false}
      className="inline-flex min-w-0 max-w-full items-center justify-end gap-2 rounded text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <span className="truncate text-muted-foreground">Tagesbriefing{targetLabel ? ` ${targetLabel}` : ""} · {briefing.author_display_name ?? "Teammitglied"}</span>
      <span className="shrink-0 rounded-full bg-[#eaf5df] px-3 py-1 font-medium text-[#397d16]">{dailyBriefingReadLabel(briefing.read_at)}</span>
      <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
    </button>
    {moreAction}
  </section>;

  return <section ref={sectionRef} aria-label="Tagesbriefing" className={cn("relative origin-top-left rounded-3xl p-5", briefing.is_read ? "bg-[rgb(240,243,246)]" : "bg-[#f0eafa]")}>
    {briefing.is_read && <button type="button" aria-label="Tagesbriefing einklappen" onClick={() => toggleCollapsed(true)}
      className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded text-black hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>}
    <div className="flex items-start gap-4">
      <Avatar className="h-8 w-8 shrink-0">
        {briefing.author_avatar_url && <AvatarImage src={briefing.author_avatar_url} alt="" />}
        <AvatarFallback className="bg-white text-sm font-semibold text-[#8b5cf6]">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pr-6">
          <p className="text-sm font-semibold text-foreground">{briefing.author_display_name ?? "Teammitglied"}</p>
          <span className="text-xs text-muted-foreground">Tagesbriefing{targetLabel ? ` · ${targetLabel}` : ""}</span>
          {!briefing.is_read ? <span className="ml-1 text-xs font-medium text-[#8b5cf6]">Neu</span>
            : <span className="inline-flex rounded-full bg-[#eaf5df] px-3 py-1 text-xs font-medium text-[#397d16]">{dailyBriefingReadLabel(briefing.read_at)}</span>}
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
          </Button> : null}
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
  const upcoming = useUpcomingBriefings();
  const futureBriefings = upcoming.data ?? [];
  const [showMore, setShowMore] = useState(false);
  const [primaryId, setPrimaryId] = useState<string | null>(null);

  if (isLoading) return null;
  if (briefings.length === 0 && apptBriefings.length === 0 && futureBriefings.length === 0 && !upcoming.isError) return null;

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
    {upcoming.isError && <div role="status" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      Zukünftige Tagesbriefings konnten nicht geladen werden.
      <Button size="sm" variant="link" onClick={() => void upcoming.refetch()}>Erneut laden</Button>
    </div>}
    {futureBriefings.map(briefing => <BriefingItem key={briefing.id} briefing={briefing}
      preview targetLabel={dailyBriefingTargetLabel(briefing.briefing_date)} />)}
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
