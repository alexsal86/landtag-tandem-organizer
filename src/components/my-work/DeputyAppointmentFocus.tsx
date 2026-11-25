import { useQuery } from "@tanstack/react-query";
import { Check, MapPin, Mic, Navigation, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import type { AppointmentData, DashboardData } from "@/hooks/useDashboardAppointmentsData";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { dashboardBriefingState } from "@/features/appointments/briefing";
import { BriefingRequestPopover } from "@/features/appointments/briefing/BriefingRequestPopover";
import { mergeLegacy } from "@/features/appointments/briefing/briefingModel";
import { applyReportedStart, summarizeReportedChanges, type MinimalChangeAlert } from "@/features/appointments/change-alerts/changeModel";
import { appointmentFocusMode, departureTime, focusCountdown, pickFocusAppointment } from "@/features/appointments/dashboardFocus";
import { berlinClock, berlinDayKey, berlinWeekdayShortDate } from "@/utils/berlinDate";
import { cn } from "@/lib/utils";
import { stripHtml } from "@/utils/textDiff";

type PreparationData = AppointmentPreparation["preparation_data"];
const action = "h-auto min-h-10 whitespace-normal rounded-xl px-3 py-2";
const green = "bg-[#38761c] text-white hover:bg-[#2b5e15]";
const amber = "bg-[#965806] text-white hover:bg-[#784604]";
const badge = "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground";
const text = (value?: string | null) => typeof value === "string" ? stripHtml(value) : "";

type CalendarInfo = Pick<Tables<"appointments">, "id" | "category" | "status" | "briefing_status" | "description" | "contact_id" | "location">;
type Candidate = AppointmentData & { original: string; category?: string | null; status?: string | null };

function clockWithDay(time: string, now: Date) {
  return berlinDayKey(time) === berlinDayKey(now) ? berlinClock(time)
    : `${berlinWeekdayShortDate(time)} · ${berlinClock(time)}`;
}

export function DeputyAppointmentFocus({ data, now, alerts }: {
  data: DashboardData; now: Date; alerts: MinimalChangeAlert[];
}) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { isAbgeordneter } = useResolvedUserRole();
  const tenant = currentTenant?.id;
  const candidates = [...data.appointments, ...data.tomorrowAppointments, ...(data.nextTimedAppointment ? [data.nextTimedAppointment] : [])];
  const ids = [...new Set(candidates.filter(appointment => !appointment.is_all_day).map(appointment => appointment.id))].sort();
  const metadata = useQuery({
    queryKey: ["appointment-briefing", "dashboard-focus-status", tenant, user?.id, ids],
    enabled: !!tenant && ids.length > 0,
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("id,category,status,briefing_status,description,contact_id,location")
        .eq("tenant_id", tenant!).in("id", ids);
      if (error) throw error;
      return data;
    },
  });
  const byId = new Map<string, CalendarInfo>();
  for (const row of metadata.data ?? []) byId.set(row.id, row);
  const effective: Candidate[] = candidates.map(row => {
    const info = byId.get(row.id);
    const changes = summarizeReportedChanges(alerts, row.id);
    return {
      ...applyReportedStart(row, changes.newStartTime),
      original: row.start_time,
      location: changes.newLocation || row.location || info?.location || undefined,
      category: info?.category, status: info?.status,
    };
  });
  const focus = pickFocusAppointment(effective, now);
  if (!focus.appointment || !tenant || metadata.isPending || metadata.isError) return null;
  const internal = byId.get(focus.appointment.id);
  return <FocusCard key={`${tenant}:${user?.id}:${focus.appointment.id}`} appointment={focus.appointment} now={now}
    running={focus.running} after={focus.after} tenant={tenant} briefingStatus={internal?.briefing_status}
    internal={!!internal} description={internal?.description} contactId={internal?.contact_id} canRequest={isAbgeordneter} />;
}

function FocusCard({ appointment, now, running, after, tenant, briefingStatus, internal, description, contactId, canRequest }: {
  appointment: Candidate; now: Date; running: boolean; after?: Candidate; tenant: string;
  briefingStatus?: string; internal: boolean; description?: string | null; contactId?: string | null; canRequest: boolean;
}) {
  const id = appointment.id;
  const approved = briefingStatus === "approved" || briefingStatus === "completed";
  const details = useQuery({
    queryKey: ["appointment-briefing", "dashboard-focus", tenant, id, approved],
    enabled: internal,
    staleTime: 20_000,
    queryFn: async () => {
      const [settings, planning, prep, linked] = await Promise.all([
        supabase.from("appointments").select("dashboard_focus,travel_minutes,dashboard_contribution").eq("tenant_id", tenant).eq("id", id).maybeSingle(),
        supabase.from("event_planning_dates").select("event_plannings!inner(id,tenant_id,location,event_planning_contacts(name,phone,role))")
          .eq("appointment_id", id).eq("is_confirmed", true).eq("event_plannings.tenant_id", tenant).limit(1).maybeSingle(),
        approved ? supabase.from("appointment_preparations").select("id,preparation_data,notes")
          .eq("tenant_id", tenant).eq("appointment_id", id).eq("is_archived", false)
          .order("updated_at", { ascending: false }).limit(1).maybeSingle() : null,
        supabase.from("appointment_contacts").select("contacts!inner(id,name,phone,position,organization,tenant_id)")
          .eq("appointment_id", id).eq("contacts.tenant_id", tenant).order("contact_id").limit(1).maybeSingle(),
      ]);
      return { settings: settings.data, planning: planning.data?.event_plannings, prep: prep?.data, linked: linked.data?.contacts };
    },
  });
  const info = details.data;
  const pd = (info?.prep?.preparation_data ?? {}) as PreparationData;
  const primaryId = pd.contact_id || pd.conversation_partners?.[0]?.contact_id || contactId || info?.linked?.id;
  const person = useQuery({
    queryKey: ["appointment-focus-contact", tenant, id, primaryId],
    enabled: internal && !!primaryId,
    staleTime: 30_000,
    queryFn: async () => {
      const [contact, memory] = await Promise.all([
        supabase.from("contacts").select("id,name,phone,position,organization").eq("tenant_id", tenant).eq("id", primaryId!).maybeSingle(),
        supabase.from("contact_briefing_memory").select("id,content,question,answer").eq("tenant_id", tenant)
          .eq("contact_id", primaryId!).order("updated_at", { ascending: false }).limit(2),
      ]);
      return { contact: contact.data, memory: memory.data ?? [] };
    },
  });

  const ready = approved && !!info?.prep;
  const briefing = dashboardBriefingState(briefingStatus, !!info?.prep);
  const mode = appointmentFocusMode(appointment, ready, info?.settings?.dashboard_focus);
  const calendar = `/calendar?date=${berlinDayKey(appointment.start_time)}&highlight=${encodeURIComponent(internal ? id : `external-${id.replace(/^external-/, "")}`)}`;
  const startLabel = clockWithDay(appointment.start_time, now);
  const location = appointment.location || info?.planning?.location;
  const destination = location?.trim() && !/^(digital|online|telefon|virtuell)\b|:\/\//i.test(location.trim()) ? location.trim() : null;
  const address = useQuery({
    queryKey: ["appointment-focus-address", tenant, destination],
    enabled: !!destination && mode !== "hint" && !running,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("appointment_locations").select("address").eq("tenant_id", tenant)
        .eq("name", destination!).eq("is_active", true).limit(1).maybeSingle();
      return data?.address?.trim() || destination;
    },
  });
  const route = destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.data || destination)}` : null;
  const departure = route ? departureTime(appointment.start_time, info?.settings?.travel_minutes, pd.travel_time) : null;
  const due = departure ? focusCountdown(departure.at, now) : null;
  const imminent = !running && due === 0;
  const routeFirst = imminent || !ready || (due !== null && due <= 15);
  const status = running ? "Läuft gerade" : imminent ? "Jetzt losfahren" : "Als Nächstes";
  const minutes = focusCountdown(appointment.start_time, now);
  const next = after && <Link to={`/calendar?date=${berlinDayKey(after.start_time)}`} className="text-sm text-muted-foreground hover:underline">
    Danach · {clockWithDay(after.start_time, now)} {after.title}
  </Link>;

  if (mode === "hint") return (
    <Card className="rounded-dashboard-card py-0 shadow-dashboard-card">
      <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <Link to={calendar} className="min-w-0 flex-1 basis-40 font-medium hover:underline">
          {status} · {startLabel} {appointment.title}
          {location && <span className="font-normal text-muted-foreground"> · {location}</span>}
        </Link>
        {appointment.category === "intern" && <span className={badge}>intern</span>}
        {!running && minutes !== null && <span className={cn(badge, green)}>{minutes === 0 ? "Jetzt" : `in ${minutes} Min.`}</span>}
        {next}
      </CardContent>
    </Card>
  );

  const contact = person.data?.contact || info?.linked;
  const partner = pd.conversation_partners?.[0];
  const plannedContact = info?.planning?.event_planning_contacts?.find(entry => entry.role === "contact_person");
  const contactName = contact?.name || partner?.name || pd.contact_name || pd.contact_person || plannedContact?.name;
  const contactRole = [contact?.position || partner?.role, contact?.organization || partner?.organization].filter(Boolean).join(" · ");
  const phone = (contact?.phone || plannedContact?.phone)?.replace(/[^+\d]/g, "");
  const contribution = text(info?.settings?.dashboard_contribution);
  const compact = ready ? mergeLegacy(pd) : undefined;
  const points = [...new Set([compact?.compact_goal, compact?.compact_positions, compact?.compact_facts]
    .flatMap(value => text(value).split("\n")).map(value => value.replace(/^[-•*]\s*/, "").trim()).filter(Boolean))].slice(0, 3);
  const wordCount = compact ? Object.entries(compact).filter(([key]) => key !== "compact_debrief")
    .flatMap(([, value]) => text(value).split(/\s+/)).filter(Boolean).length + text(info?.prep?.notes).split(/\s+/).filter(Boolean).length : 0;
  const reading = Math.max(1, Math.ceil(wordCount / 200));
  const briefingPath = info?.prep ? `/appointment-preparation/${info.prep.id}?view=briefing` : null;
  const livePath = info?.prep ? `/briefing-live?preparationId=${info.prep.id}&appointmentId=${id}#notes` : null;
  const memory = person.data?.memory ?? [];
  const shortDescription = text(description).slice(0, 240);

  return (
    <Card className={cn("rounded-dashboard-card border-l-4 py-0 shadow-dashboard-card", imminent ? "border-l-[#965806]" : "border-l-[#38761c]")}>
      <CardContent className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="shrink-0">
            <p className={cn("text-xs font-bold uppercase tracking-wide", imminent ? "text-[#965806] dark:text-amber-300" : "text-[#38761c] dark:text-green-300")}>{status}</p>
            <p className={cn("tabular-nums font-semibold leading-tight", mode === "detailed" ? "text-4xl" : "text-2xl")}>{berlinClock(appointment.start_time)}</p>
            <p className="text-xs text-muted-foreground">{berlinDayKey(appointment.start_time) === berlinDayKey(now) ? "Uhr" : berlinWeekdayShortDate(appointment.start_time)}
              {appointment.original !== appointment.start_time && ` · vorher ${berlinClock(appointment.original)}`}</p>
          </div>
          <div className="min-w-0 flex-1 basis-32">
            <h3 className={cn("break-words font-semibold leading-tight", mode === "detailed" ? "text-xl" : "text-lg")}>
              <Link to={calendar} className="hover:underline">{appointment.title}</Link>
            </h3>
            {location && <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="break-words">{location}{mode === "compact" && departure && ` · ${departure.travel} Min. Fahrt`}</span>
            </p>}
            <div className="mt-2 flex flex-wrap gap-1">
              <span className={cn(badge, ready && "bg-[#e7f3df] text-[#326a1c]")}>{ready ? "Briefing liegt bereit" : briefing?.label || "Kein Briefing"}</span>
              {ready && <span className={badge}>{reading} Min. Lesezeit</span>}
            </div>
          </div>
          {!running && departure && <div className="min-w-16 text-center">
            {due !== null && <div className="mx-auto grid size-14 place-items-center rounded-full p-1"
              style={{ background: imminent ? "#965806" : `conic-gradient(#38761c ${Math.min(100, due / 120 * 100)}%, hsl(var(--muted)) 0)` }}>
              <span className="grid size-full place-content-center rounded-full bg-card text-sm font-semibold leading-tight tabular-nums">
                {imminent ? "Jetzt" : <>{due}<span className="text-xs font-normal text-muted-foreground">Min.</span></>}
              </span>
            </div>}
            <p className="mt-1 text-xs text-muted-foreground">Losfahren</p>
            <p className="text-sm font-semibold tabular-nums">{clockWithDay(departure.at.toISOString(), now)}</p>
          </div>}
        </div>
        {running && next}
        {mode === "detailed" && (contactName || contribution || pd.dress_code || departure) && (
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2 text-sm">
            {contactName && <div className="min-w-0 rounded-xl bg-muted px-3 py-2">
              <dt className="text-muted-foreground">Ansprechperson</dt>
              <dd className="break-words font-medium">{contactName}</dd>
              {contactRole && <dd className="break-words text-muted-foreground">{contactRole}</dd>}
              {phone && <dd><a href={`tel:${phone}`} className="mt-1 inline-flex items-center gap-1 text-sm underline"><Phone aria-hidden="true" className="size-3.5" />Anrufen</a></dd>}
            </div>}
            {(contribution || pd.dress_code) && <div className="min-w-0 rounded-xl bg-muted px-3 py-2">
              <dt className="text-muted-foreground">{contribution ? "Dein Beitrag" : "Dresscode"}</dt>
              {contribution && <dd className="break-words font-medium">{contribution}</dd>}
              {pd.dress_code && <dd className="break-words">{contribution && "Dresscode: "}{pd.dress_code}</dd>}
            </div>}
            {departure && <div className="rounded-xl bg-muted px-3 py-2"><dt className="text-muted-foreground">Fahrt</dt><dd className="font-medium">{departure.travel} Min.</dd></div>}
          </dl>
        )}
        {mode === "detailed" && (points.length > 0 || memory.length > 0) && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-3 text-sm">
            {points.length > 0 && <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Das Wichtigste</h4>
              <ul className="space-y-1">{points.map(point => <li key={point} className="flex gap-1.5 break-words"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#38761c]" /><span className="min-w-0">{point}</span></li>)}</ul>
            </div>}
            {memory.length > 0 && <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gedächtnis zur Person</h4>
              <ul className="space-y-1">{memory.map(item => <li key={item.id} className="break-words">{item.content || [item.question, item.answer].filter(Boolean).join(" · ")}</li>)}</ul>
            </div>}
          </div>
        )}
        {!ready && shortDescription && <p className="rounded-xl bg-muted p-2.5 text-sm text-muted-foreground">{shortDescription}</p>}
        <div className="flex flex-wrap gap-2">
          {running && livePath && <Button asChild className={cn(action, green)}><Link to={livePath}><Mic aria-hidden="true" />Notiz diktieren</Link></Button>}
          {!running && route && <Button asChild variant={routeFirst ? "default" : "secondary"}
            className={cn(action, imminent ? amber : routeFirst && green)}>
            <a href={route} target="_blank" rel="noreferrer"><Navigation aria-hidden="true" />{imminent ? "Jetzt losfahren · Route starten" : routeFirst ? "Route starten" : "Route ansehen"}</a>
          </Button>}
          {briefingPath && <Button asChild variant="secondary" className={cn(action, !running && (!route || !routeFirst) && green)}>
            <Link to={briefingPath}>{running || imminent ? "Briefing" : `Briefing lesen · ${reading} Min.`}</Link>
          </Button>}
          {canRequest && internal && ["undecided", "none"].includes(briefingStatus ?? "") && (
            <BriefingRequestPopover appointmentId={id} startTime={appointment.start_time}
              trigger={<Button variant="secondary" className={action}>Büro um Briefing bitten</Button>} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
