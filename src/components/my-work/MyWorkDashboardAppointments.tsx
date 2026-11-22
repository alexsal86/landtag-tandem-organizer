import { hasAppointmentEnded, nextAppointmentId, timelineNowIndex } from "@/utils/dashboard/daySummary";
import { useQuery } from "@tanstack/react-query";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { dashboardBriefingState } from "@/features/appointments/briefing";
import { AppointmentBriefingStatusCard } from "@/features/appointments/briefing/AppointmentBriefingStatusCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { X, Download, MapPin, Check, CircleAlert, Video, Users, Clock, PencilLine } from "lucide-react";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { getLucideIcon } from "@/utils/iconUtils";
import { Separator } from "@/components/ui/separator";
import { AppointmentBriefingView } from "@/components/appointment-preparations/AppointmentBriefingView";
import { generateBriefingPdf } from "@/components/appointment-preparations/briefingPdfGenerator";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { getSpecialDayHint } from "@/utils/dashboard/specialDays";
import { type DashboardData } from "@/hooks/useDashboardData";
import { sanitizeRichHtml } from "@/utils/htmlSanitizer";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  APPOINTMENT_REQUEST_APPOINTMENT_MARKER,
  APPOINTMENT_REQUEST_LOCATION_MARKER,
  APPOINTMENT_REQUEST_REQUESTER_MARKER,
  APPOINTMENT_REQUEST_START_MARKER,
  APPOINTMENT_REQUEST_TITLE_MARKER,
} from "@/features/appointments/requestMarkers";

interface Props {
  data: DashboardData;
}

interface ParticipantItem {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  badge_color: string | null;
}

interface AppointmentRequestItem {
  decisionId: string;
  decisionDescription: string | null;
  appointmentId: string | null;
  appointmentTitle: string;
  appointmentStart: string | null;
  appointmentLocation: string | null;
  requester: string | null;
  responseType: "yes" | "no" | "question" | null;
  myParticipantId: string | null;
  myHasResponded: boolean;
}

const SPECIAL_DAY_DISMISSALS_STORAGE_KEY = "mywork-dashboard-special-day-dismissals";

interface StoredSpecialDayDismissal {
  hiddenUntilDate: string;
}

const getSpecialDayDismissals = (): Record<string, StoredSpecialDayDismissal> => {
  if (typeof window === "undefined") return {};

  try {
    const rawValue = window.localStorage.getItem(SPECIAL_DAY_DISMISSALS_STORAGE_KEY);
    if (!rawValue) return {};

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed).reduce<Record<string, StoredSpecialDayDismissal>>((acc, [key, value]) => {
      if (
        value &&
        typeof value === "object" &&
        typeof (value as StoredSpecialDayDismissal).hiddenUntilDate === "string"
      ) {
        acc[key] = { hiddenUntilDate: (value as StoredSpecialDayDismissal).hiddenUntilDate };
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const setSpecialDayDismissals = (dismissals: Record<string, StoredSpecialDayDismissal>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SPECIAL_DAY_DISMISSALS_STORAGE_KEY, JSON.stringify(dismissals));
};

const buildSpecialDayDismissalKey = (name: string, targetDate: string) => `${name}::${targetDate}`;

/** Check if an appointment is currently happening */
const isCurrentlyActive = (apt: { start_time: string; end_time?: string; is_all_day: boolean }) => {
  if (apt.is_all_day) return false;
  const now = new Date();
  const start = new Date(apt.start_time);
  const end = apt.end_time ? new Date(apt.end_time) : new Date(start.getTime() + 3600000);
  return start <= now && now < end;
};

const extractMarkerValue = (description: string | null | undefined, marker: string): string | null => {
  if (!description) return null;
  const line = description.split("\n").find((l) => l.startsWith(marker));
  return line ? line.slice(marker.length).trim() || null : null;
};

const getAppointmentIdFromDescription = (description: string | null | undefined): string | null =>
  extractMarkerValue(description, APPOINTMENT_REQUEST_APPOINTMENT_MARKER);

const getRequestedStartFromDescription = (description: string | null | undefined): string | null =>
  extractMarkerValue(description, APPOINTMENT_REQUEST_START_MARKER);

const getRequestedTitleFromDescription = (description: string | null | undefined): string | null =>
  extractMarkerValue(description, APPOINTMENT_REQUEST_TITLE_MARKER);

const getRequestedLocationFromDescription = (description: string | null | undefined): string | null =>
  extractMarkerValue(description, APPOINTMENT_REQUEST_LOCATION_MARKER);

const getRequesterFromDescription = (description: string | null | undefined): string | null =>
  extractMarkerValue(description, APPOINTMENT_REQUEST_REQUESTER_MARKER);

export const DashboardAppointments = ({ data }: Props) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const { currentTenant } = useTenant();
  const { isAdmin: canDecideBriefing } = useResolvedUserRole();
  const [briefingDecision, setBriefingDecision] = useState<{ id: string; title: string; start_time: string } | null>(null);
  const { appointments, isShowingTomorrow, tomorrowAppointments, specialDays, isLoading } = data;

  const [preparations, setPreparations] = useState<Map<string, AppointmentPreparation>>(new Map());
  const [preparationsError, setPreparationsError] = useState(false);
  const [preparationsLoaded, setPreparationsLoaded] = useState(false);
  const [expandedBriefingId, setExpandedBriefingId] = useState<string | null>(null);
  const [openedBriefings, setOpenedBriefings] = useState<Set<string>>(() => new Set());
  const [participants, setParticipants] = useState<Map<string, ParticipantItem[]>>(new Map());
  const allAppointments = useMemo(
    () => [...appointments, ...tomorrowAppointments],
    [appointments, tomorrowAppointments],
  );

  const nextId = nextAppointmentId(allAppointments, now);
  const appointmentIds = useMemo(() => allAppointments.map(appointment => appointment.id), [allAppointments]);
  const briefingAssignments = useQuery<Map<string, string>>({
    queryKey: ["appointment-briefing", "dashboard-status", currentTenant?.id, appointmentIds],
    enabled: !!currentTenant?.id && appointmentIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("id,briefing_status")
        .eq("tenant_id", currentTenant!.id).in("id", appointmentIds);
      if (error) throw error;
      return new Map<string, string>((data ?? []).map(appointment => [appointment.id, appointment.briefing_status]));
    },
  });

  const briefingStatusKey = [...(briefingAssignments.data?.entries() ?? [])]
    .map(([id, status]) => id + ":" + status).sort().join("|");

  // Fetch linked contacts as participants (only internal appointments have entries)
  useEffect(() => {
    let cancelled = false;
    const ids = allAppointments.map((a) => a.id);
    if (ids.length === 0) {
      setParticipants(new Map());
      return;
    }
    (async () => {
      const { data: rows, error } = await supabase
        .from("appointment_contacts")
        .select("appointment_id, contact_id, contacts(name, avatar_url)")
        .in("appointment_id", ids);
      if (cancelled || error) return;
      const map = new Map<string, ParticipantItem[]>();
      for (const r of rows ?? []) {
        const c = r.contacts as { name: string | null; avatar_url: string | null } | null;
        const list = map.get(r.appointment_id) ?? [];
        list.push({
          user_id: r.contact_id,
          display_name: c?.name ?? null,
          avatar_url: c?.avatar_url ?? null,
          badge_color: null,
        });
        map.set(r.appointment_id, list);
      }
      setParticipants(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [allAppointments]);

  // Fetch preparations for today's appointments
  useEffect(() => {
    let cancelled = false;
    setPreparations(new Map());
    setPreparationsLoaded(false);
    setPreparationsError(false);
    const fetchPreparations = async () => {
      if (!currentTenant?.id || allAppointments.length === 0) return;
      const aptIds = allAppointments.map((a) => a.id);
      try {
        const { data: preps, error } = await supabase
          .from("appointment_preparations")
          .select("*")
          .in("appointment_id", aptIds)
          .eq("is_archived", false)
          .eq("tenant_id", currentTenant.id);
        if (error) throw error;
        if (cancelled) return;
        if (preps && preps.length > 0) {
          const prepMap = new Map<string, AppointmentPreparation>();
          for (const p of preps) {
            prepMap.set(p.appointment_id, {
              id: p.id,
              title: p.title,
              status: p.status,
              notes: p.notes,
              appointment_id: p.appointment_id,
              template_id: p.template_id,
              tenant_id: p.tenant_id,
              created_by: p.created_by,
              created_at: p.created_at,
              updated_at: p.updated_at,
              is_archived: p.is_archived,
              archived_at: p.archived_at,
              preparation_data: (p.preparation_data ?? {}) as AppointmentPreparation["preparation_data"],
              checklist_items: (p.checklist_items ?? []) as AppointmentPreparation["checklist_items"],
            });
          }
          setPreparations(prepMap);
        }
        setPreparationsLoaded(true);
      } catch {
        if (!cancelled) setPreparationsError(true);
      }
    };
    fetchPreparations();
    return () => {
      cancelled = true;
    };
  }, [currentTenant?.id, allAppointments, briefingStatusKey]);

  const specialDayHint = useMemo(() => getSpecialDayHint(new Date(), specialDays), [specialDays]);
  const [isSpecialDayHintVisible, setIsSpecialDayHintVisible] = useState(true);

  useEffect(() => {
    if (!specialDayHint) {
      setIsSpecialDayHintVisible(false);
      return;
    }

    const dismissalKey = buildSpecialDayDismissalKey(specialDayHint.name, specialDayHint.targetDate);
    const dismissals = getSpecialDayDismissals();
    const dismissal = dismissals[dismissalKey];

    if (!dismissal) {
      setIsSpecialDayHintVisible(true);
      return;
    }

    if (specialDayHint.isToday || dismissal.hiddenUntilDate < specialDayHint.targetDate) {
      delete dismissals[dismissalKey];
      setSpecialDayDismissals(dismissals);
      setIsSpecialDayHintVisible(true);
      return;
    }

    setIsSpecialDayHintVisible(false);
  }, [specialDayHint]);

  const dismissSpecialDayHint = useCallback(() => {
    if (!specialDayHint) return;

    const dismissalKey = buildSpecialDayDismissalKey(specialDayHint.name, specialDayHint.targetDate);
    const dismissals = getSpecialDayDismissals();
    dismissals[dismissalKey] = { hiddenUntilDate: specialDayHint.targetDate };
    setSpecialDayDismissals(dismissals);
    setIsSpecialDayHintVisible(false);
  }, [specialDayHint]);

  const renderAppointment = (apt: DashboardData["appointments"][number], isTodayGroup: boolean) => {
    const aptDate = format(new Date(apt.start_time), "yyyy-MM-dd");
    const active = isTodayGroup && isCurrentlyActive(apt);
    const ended = hasAppointmentEnded(apt, now);
    const isNext = apt.id === nextId;
    const hasPrep = preparations.has(apt.id);
    const prep = preparations.get(apt.id);
    const isBriefingExpanded = expandedBriefingId === apt.id;
    const start = new Date(apt.start_time);
    const end = apt.end_time ? new Date(apt.end_time) : null;
    let meetingUrl: string | null = null;
    try {
      const locationUrl = new URL(apt.location?.trim() ?? "");
      if (
        locationUrl.protocol === "https:" &&
        /(^|\.)(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|webex\.com|meet\.jit\.si)$/.test(
          locationUrl.hostname,
        )
      ) {
        meetingUrl = locationUrl.href;
      }
    } catch {
      /* Location is a place rather than a meeting URL. */
    }
    const participantList = participants.get(apt.id) ?? [];
    const briefingStatus = briefingAssignments.data?.get(apt.id);
    const briefingState = dashboardBriefingState(briefingStatus, hasPrep);
    const statusError = preparationsError || briefingAssignments.isError;
    const statusLoading = !preparationsLoaded || briefingAssignments.isPending;
    const badgeLabel = statusError ? "Briefing-Status nicht verfügbar"
      : statusLoading ? "Briefing wird geprüft" : briefingState?.label;
    const badgeClass = statusError || statusLoading ? "bg-muted text-muted-foreground"
      : briefingState?.kind === "missing" ? "bg-destructive/10 text-destructive"
      : briefingState?.kind === "ready" ? "bg-palette-green/15 text-palette-green"
      : briefingState?.kind === "pending" ? "bg-palette-amber/15 text-palette-amber"
      : "bg-muted text-muted-foreground";
    const BadgeIcon = statusError || briefingState?.kind === "missing" ? CircleAlert
      : briefingState?.kind === "ready" ? Check : briefingState?.kind === "pending" ? Clock : PencilLine;
    const canOpenBriefing = !statusError && !statusLoading && briefingState?.canOpen;
    const canChooseBriefing = canDecideBriefing && !statusError && !statusLoading
      && (briefingStatus === "undecided" || briefingStatus === "none");
    return (
      <div key={apt.id} className={cn("relative border-b border-border/60 group-last/day-entry:border-b-0", ended && "opacity-55")}>
        <span aria-hidden="true" className={cn(
          "absolute -left-5 top-[18px] z-10 h-3 w-3 rounded-full border-2",
          ended ? "border-muted-foreground bg-muted-foreground"
            : active || isNext ? "border-[#55ad21] bg-[#55ad21]"
            : "border-border bg-card",
        )}>
          {isNext && <span className="absolute -inset-1 rounded-full border border-[#55ad21] animate-ring motion-reduce:hidden" />}
        </span>
        <div
          className={`relative grid grid-cols-[3.25rem_minmax(0,1fr)] @min-[32rem]:grid-cols-[3.25rem_minmax(0,1fr)_auto] gap-x-3 gap-y-2 rounded-lg px-3 py-3 transition-colors hover:bg-muted/40 focus-within:bg-muted/40 ${active ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
        >
          <button
            type="button"
            className="absolute inset-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label={`Termindetails öffnen: ${apt.title}`}
            onClick={() => navigate(`/calendar?date=${aptDate}&event=${apt.id}`)}
          />
          <div className="pointer-events-none relative tabular-nums">
            <p
              className={cn(
                apt.is_all_day ? "text-sm font-semibold" : "text-base font-semibold leading-6 text-foreground",
                ended && "text-muted-foreground",
              )}
            >
              {apt.is_all_day ? "Ganztägig" : format(start, "HH:mm")}
            </p>
            {!apt.is_all_day && end && end > start && (
              <p className="text-xs text-muted-foreground/80">
                {isSameDay(start, end) ? "" : format(end, "d. MMM. ", { locale: de })}
                {format(end, "HH:mm")}
              </p>
            )}
          </div>
          <div className="pointer-events-none relative min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className={cn(
                "break-words text-foreground",
                isNext ? "text-lg font-semibold leading-7" : "text-base font-medium leading-6",
                ended && "line-through",
              )}>{apt.title}</p>
            </div>
            {((apt.location && !meetingUrl) || participantList.length > 0) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {apt.location && !meetingUrl && (
                  <span className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="break-words">{apt.location}</span>
                  </span>
                )}
                {participantList.length > 0 && (
                  <span className="flex items-center gap-2">
                    <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>{participantList.length} Teilnehmende</span>
                    <span className="pointer-events-auto">
                      <AvatarStack participants={participantList} maxVisible={4} size="sm" />
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="relative z-10 col-start-2 flex w-full flex-col items-end gap-2 @min-[32rem]:col-start-3 @min-[32rem]:row-start-1 @min-[32rem]:w-auto @min-[32rem]:max-w-[19rem] @min-[32rem]:self-start">
            <div className="flex w-full items-center justify-end gap-2">
              {!ended && badgeLabel && <span className="relative z-10 inline-flex">
                {canChooseBriefing ? (
                  <button type="button" className={cn("pointer-events-auto inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs hover:underline focus-visible:outline focus-visible:outline-2", badgeClass)}
                    onClick={() => setBriefingDecision(apt)} aria-label={`${badgeLabel}: ${apt.title} – Briefing anfordern oder ablehnen`}>
                    <BadgeIcon className="h-3 w-3" aria-hidden="true" />{badgeLabel}
                  </button>
                ) : (
                  <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs", badgeClass)}>
                    <BadgeIcon className="h-3 w-3" aria-hidden="true" />{badgeLabel}
                  </span>
                )}
              </span>}
              {(ended || isNext) && <span className="inline-flex shrink-0">
                {ended && <span className="rounded-full bg-[#eaf5df] px-2 py-0.5 text-xs text-[#55ad21]">Erledigt</span>}
                {isNext && <span className="rounded-full bg-[#eaf5df] px-2 py-0.5 text-xs text-[#55ad21]">Als Nächstes</span>}
              </span>}
            </div>
            {(meetingUrl || canOpenBriefing) && <div className="flex flex-wrap items-center justify-end gap-2">
              {meetingUrl && (
                <a
                  href={meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded px-2 py-2 text-xs text-primary hover:underline focus-visible:outline-primary"
                >
                  <Video className="h-3 w-3" aria-hidden="true" />
                  Meeting beitreten
                </a>
              )}
              {canOpenBriefing && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg border border-border bg-transparent px-3 text-sm font-normal hover:bg-transparent hover:border-foreground/30"
                    aria-expanded={isBriefingExpanded}
                    aria-controls={`dashboard-briefing-${apt.id}`}
                    onClick={() => {
                      setOpenedBriefings(previous => new Set(previous).add(apt.id));
                      setExpandedBriefingId(previous => previous === apt.id ? null : apt.id);
                    }}
                  >
                    {isBriefingExpanded ? "Briefing schließen" : "Briefing öffnen"}
                  </Button>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-transparent hover:border-foreground/30"
                          aria-label="Briefing als PDF herunterladen"
                          onClick={() => {
                            if (prep)
                              generateBriefingPdf({
                                preparation: prep,
                                appointmentTitle: apt.title,
                                appointmentStartTime: apt.start_time,
                                appointmentEndTime: apt.end_time || apt.start_time,
                                appointmentLocation: apt.location || undefined,
                              }).catch(console.error);
                          }}
                        >
                          <Download className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Briefing als PDF herunterladen</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>}
          </div>
        </div>
        {canOpenBriefing && prep && (
          <div className="dashboard-expand grid grid-rows-[0fr] data-[open=true]:grid-rows-[1fr]" data-open={isBriefingExpanded}
            aria-hidden={!isBriefingExpanded} inert={!isBriefingExpanded}>
            <div className="min-h-0 overflow-hidden">
              {openedBriefings.has(apt.id) && (
                <div id={`dashboard-briefing-${apt.id}`} className="animate-fade-up mt-1 ml-4">
                  <AppointmentBriefingView
                    preparation={prep}
                    appointmentInfo={{
                      title: apt.title,
                      start_time: apt.start_time,
                      end_time: apt.end_time || apt.start_time,
                      location: apt.location || undefined,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNowMarker = () => (
    <div className="relative flex items-center gap-2 py-2 pl-3 text-xs font-medium text-[#ec4899]" role="status">
      <span className="absolute -left-5 top-2.5 z-10 h-3 w-3 rounded-full border-2 border-[#ec4899] bg-card" aria-hidden="true" />
      <time dateTime={now.toISOString()} className="shrink-0">
        {new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(now)} · Jetzt
      </time>
      <span className="h-px flex-1 bg-[#ec4899]" aria-hidden="true" />
    </div>
  );

  const renderDayAppointments = (items: DashboardData["appointments"], today: boolean) => {
    const entries: Array<{ key: string; appointment: DashboardData["appointments"][number] | null }> =
      items.map(appointment => ({ key: appointment.id, appointment }));
    if (today) entries.splice(timelineNowIndex(items, now), 0, { key: "current-time", appointment: null });
    return (
      <div className="pl-5">
        {entries.map((entry, index) => (
          <div key={entry.key} className="group/day-entry relative animate-rise" style={{ animationDelay: `${Math.min(index, 3) * 40}ms` }}>
            <span aria-hidden="true" className={cn(
              "pointer-events-none absolute -left-[15px] top-0 w-0.5 bg-border group-first/day-entry:hidden",
              entry.appointment ? "h-[14px]" : "h-1.5",
            )} />
            <span aria-hidden="true" className={cn(
              "pointer-events-none absolute -left-[15px] bottom-0 w-0.5 bg-border group-last/day-entry:hidden",
              entry.appointment ? "top-[34px]" : "top-[26px]",
            )} />
            {entry.appointment ? renderAppointment(entry.appointment, today) : renderNowMarker()}
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  const HintIcon = specialDayHint?.icon ? getLucideIcon(specialDayHint.icon) : null;

  return (
    <div className="@container space-y-4">
      <div>
        {(isShowingTomorrow || appointments.length === 0) && (
          <p className="mb-3 text-sm text-muted-foreground">Heute stehen keine weiteren Termine an.</p>
        )}
        {(isShowingTomorrow || appointments.length === 0) && (
          <div className="relative mb-2 pl-5">{renderNowMarker()}</div>
        )}
        {appointments.length === 0 ? (
          isShowingTomorrow && <p className="text-sm text-muted-foreground">Auch morgen stehen keine Termine an.</p>
        ) : (
          <div className="space-y-1.5">
            <DayDivider label={isShowingTomorrow ? "Morgen" : "Heute"} date={isShowingTomorrow ? addDays(new Date(), 1) : new Date()} first />
            {renderDayAppointments(appointments, !isShowingTomorrow)}
          </div>
        )}
        {tomorrowAppointments.length > 0 && (
          <div className="mt-5 space-y-1.5">
            <DayDivider label="Morgen" date={addDays(new Date(), 1)} />
            {renderDayAppointments(tomorrowAppointments, false)}
          </div>
        )}
      </div>

      {specialDayHint && isSpecialDayHintVisible && <Separator className="my-2" />}

      {specialDayHint && isSpecialDayHintVisible && (
        <div className="group relative bg-palette-amber/10 border-l-2 border-palette-amber/60 px-3 py-1.5 pr-9 rounded text-sm text-foreground flex items-start gap-2">
          {HintIcon && <HintIcon className="h-3 w-3 mt-0.5 shrink-0 text-palette-amber" />}
          <span
            dangerouslySetInnerHTML={{
              __html: sanitizeRichHtml(
                specialDayHint.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>"),
              ),
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full text-palette-amber opacity-0 transition-opacity hover:bg-palette-amber/20 hover:text-palette-amber focus-visible:opacity-100 group-hover:opacity-100"
            onClick={dismissSpecialDayHint}
            aria-label="Hinweis ausblenden"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <Dialog open={!!briefingDecision} onOpenChange={open => { if (!open) setBriefingDecision(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{briefingDecision?.title} – Briefing</DialogTitle></DialogHeader>
          {briefingDecision && <AppointmentBriefingStatusCard appointmentId={briefingDecision.id}
            title={briefingDecision.title} startTime={briefingDecision.start_time} isDecider={canDecideBriefing} />}
        </DialogContent>
      </Dialog>

      {/* Terminanfrage und Feedback-Reminder sind jetzt in der Navigation (Kalender-Panel) */}
    </div>
  );
};

/** Day separator: label chip between hairlines so today and tomorrow read as separate blocks. */
function DayDivider({ label, date, first = false }: { label: string; date: Date; first?: boolean }) {
  return (
    <div className="mb-1 flex items-center gap-2" role="heading" aria-level={3}>
      {!first && <span className="h-px w-3 bg-border" aria-hidden="true" />}
      <span className="section-label inline-flex items-center gap-1.5 text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", first ? "bg-primary" : "bg-muted-foreground/50")} aria-hidden="true" />
        {label}
        <span className="font-normal normal-case tracking-normal opacity-70">{format(date, "EEEE, d. MMMM", { locale: de })}</span>
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}
