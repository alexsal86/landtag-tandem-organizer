import { CollisionRadar } from "@/components/calendar/CollisionRadar";
import { overlaps } from "@/components/calendar/collisions";
import { useState, useEffect, useRef, startTransition, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOpenAppointmentRequests } from "@/features/appointment-requests/useAppointmentRequests";
import { REQUEST_EVENT_PREFIX, requestEnd, requestStart } from "@/features/appointment-requests/logic";
import { openAppointmentRequestCreate, openAppointmentRequestDetail } from "@/features/appointment-requests/events";
import { getISOWeek } from "date-fns";
import { de } from "date-fns/locale";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProperReactBigCalendar } from "@/components/calendar/ProperReactBigCalendar";
import { AppointmentDetailsSidebar } from "@/components/calendar/AppointmentDetailsSidebar";
import AppointmentPreparationSidebar from "@/features/appointments/components/AppointmentPreparationSidebar";
import { PollListView } from "@/components/poll/PollListView";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { useCalendarData } from "@/components/calendar/hooks/useCalendarData";
import { useCalendarOperations } from "@/components/calendar/hooks/useCalendarOperations";
import type { CalendarEvent } from "@/components/calendar/types";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { CalendarSource } from "@/components/calendar/CalendarSidebarSources";

export type { CalendarEvent } from "@/components/calendar/types";

type CalendarViewType = "day" | "week" | "month" | "agenda" | "polls";
type HighlightEventRow = {
  id: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  all_day?: boolean | null;
  is_all_day?: boolean | null;
};

export function CalendarView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("week");
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarEvent | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [preparationSidebarOpen, setPreparationSidebarOpen] = useState(false);
  const [selectedAppointmentForPreparation, setSelectedAppointmentForPreparation] = useState<CalendarEvent | null>(null);
  const handledHighlightRef = useRef<string | null>(null);
  const [hiddenSourceKeys, setHiddenSourceKeys] = usePersistentState<string[]>("calendar.hidden-source-keys", []);

  const { appointments, loading, refreshAppointments } = useCalendarData(currentDate, view);
  const { handleEventDrop, handleEventResize } = useCalendarOperations(refreshAppointments);
  const visibleAppointments = useMemo(
    () => appointments.filter((appointment) => !appointment.sourceScope || !appointment.sourceId || !hiddenSourceKeys.includes(`${appointment.sourceScope}:${appointment.sourceId}`)),
    [appointments, hiddenSourceKeys],
  );

  const [showRequests, setShowRequests] = usePersistentState<boolean>("calendar.show-requests", true);
  const [slotChoice, setSlotChoice] = useState<{ start: Date; end: Date } | null>(null);
  const { data: openRequests = [] } = useOpenAppointmentRequests();
  const requestEvents = useMemo<CalendarEvent[]>(() => {
    if (!showRequests) return [];
    return openRequests.map((r) => {
      const start = requestStart(r);
      return {
        id: `${REQUEST_EVENT_PREFIX}${r.id}`,
        title: `⏳ ${r.title}`,
        description: r.requester ? `Anfrage von ${r.requester}` : undefined,
        time: r.requested_time ? format(start, "HH:mm") : "Ganztägig",
        duration: `${(r.duration_minutes / 60).toFixed(1)}h`,
        date: start,
        endTime: requestEnd(r),
        location: r.location ?? undefined,
        type: "blocked",
        priority: "low",
        participants: [],
        attendees: 0,
        is_all_day: !r.requested_time,
        sourceScope: "system",
        sourceId: "appointment-requests",
      };
    });
  }, [openRequests, showRequests]);

  const radarAppointments = useMemo(() => [...visibleAppointments, ...requestEvents].map(event => ({ ...event, hasCollision: appointments.some(other => overlaps(event, other)) })), [visibleAppointments, appointments]);
  const currentAppointment = appointments.find(event => event.id === selectedAppointment?.id) ?? selectedAppointment;

  const handleToggleSourceVisibility = (source: CalendarSource) => {
    const key = `${source.scope}:${source.id}`;
    setHiddenSourceKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  // Deep-link support
  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    const dateParam = searchParams.get("date");

    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!Number.isNaN(parsed.getTime())) setCurrentDate(parsed);
    }

    if (!highlightId || handledHighlightRef.current === highlightId) return;

    const match = appointments.find((a) => a.id === highlightId);
    if (match) {
      handledHighlightRef.current = highlightId;
      setCurrentDate(new Date(match.date));
      setSelectedAppointment(match);
      setSidebarOpen(true);
      if (view === "polls") setView("day");
      return;
    }

    let active = true;
    (async () => {
      const isExt = highlightId.startsWith("external-");
      const id = isExt ? highlightId.replace(/^external-/, "") : highlightId;
      let data: HighlightEventRow | null;
      let error: unknown;

      if (isExt) {
        const res = await supabase.from("external_events").select("id, title, start_time, end_time, location, all_day").eq("id", id).maybeSingle();
        data = res.data as HighlightEventRow | null;
        error = res.error;
      } else {
        const res = await supabase.from("appointments").select("id, title, start_time, end_time, location, is_all_day").eq("id", id).maybeSingle();
        data = res.data as HighlightEventRow | null;
        error = res.error;
      }

      if (!active || error || !data) { handledHighlightRef.current = highlightId; return; }

      const startDate = new Date(data.start_time as string);
      const endDate = data.end_time ? new Date(data.end_time as string) : startDate;
      const allDay = data.all_day || data.is_all_day || false;

      handledHighlightRef.current = highlightId;
      setCurrentDate(startDate);
      setSelectedAppointment({
        id: isExt ? `external-${data.id}` : data.id,
        title: isExt ? `📅 ${data.title}` : (data.title as string),
        time: allDay ? "Ganztägig" : startDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
        duration: "",
        date: startDate,
        endTime: endDate,
        location: data.location || undefined,
        priority: "medium",
        type: "appointment",
        is_all_day: allDay,
        _isExternal: isExt,
      });
      setSidebarOpen(true);
      if (view === "polls") setView("day");
    })();

    return () => { active = false; };
  }, [appointments, searchParams, view]);

  const isCalendarView = (v: string): v is "day" | "week" | "month" | "agenda" =>
    ["day", "week", "month", "agenda"].includes(v);

  const navigateDate = (direction: "prev" | "next") => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + (direction === "next" ? 1 : -1));
    else if (view === "week") d.setDate(d.getDate() + (direction === "next" ? 7 : -7));
    else d.setDate(d.getDate() + (direction === "next" ? 1 : -1));
    startTransition(() => setCurrentDate(d));
  };

  const monthLabel = format(currentDate, "MMMM yyyy", { locale: de });
  const kwLabel = `KW ${getISOWeek(currentDate)}`;

  return (
    <div className="h-full overflow-hidden bg-gradient-subtle">
      <div className="flex h-full min-h-0 transition-all duration-300">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? "w-[60px]" : "w-[260px]"} shrink-0 min-h-0 transition-all duration-300`}>
          <CalendarHeader
            collapsed={sidebarOpen}
            selectedDate={currentDate}
            onSelectDate={(date) => {
              setCurrentDate(date);
              if (view === "polls") setView("week");
            }}
            onShowPolls={() => setView("polls")}
            hiddenSourceKeys={hiddenSourceKeys}
            onToggleSourceVisibility={handleToggleSourceVisibility}
          />
        </div>

        {/* Main calendar area */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col transition-all duration-300 overflow-hidden pl-5 pt-4 pb-1 pr-0">
          {/* Google-style toolbar */}
          <div className="flex items-center justify-between pr-4 pb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 text-sm font-medium"
                onClick={() => setCurrentDate(new Date())}
              >
                Heute
              </Button>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => navigateDate("prev")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => navigateDate("next")}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <h1 className="text-xl font-semibold text-foreground capitalize">
                {monthLabel}
              </h1>
              <span className="text-sm text-muted-foreground font-medium">
                {kwLabel}
              </span>
            </div>

            <div className="flex items-center gap-2">
            <Button
              variant={showRequests ? "secondary" : "ghost"}
              size="sm"
              className="h-9"
              onClick={() => setShowRequests(!showRequests)}
              aria-pressed={showRequests}
              title="Vorgemerkte Terminanfragen im Kalender ein- oder ausblenden"
            >
              <CalendarClock className="mr-1.5 h-4 w-4" />
              Anfragen{openRequests.length > 0 ? ` (${openRequests.length})` : ""}
            </Button>
            <Select
              value={view === "polls" ? "polls" : view}
              onValueChange={(v) => setView(v as CalendarViewType)}
            >
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Tag</SelectItem>
                <SelectItem value="week">Woche</SelectItem>
                <SelectItem value="month">Monat</SelectItem>
                <SelectItem value="agenda">Agenda</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </div>

          {/* Calendar card */}
          <Card className="bg-card shadow-card border-0 flex-1 min-h-0 flex flex-col">
            {view === "polls" && (
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Terminabstimmungen
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
              {view === "polls" ? (
                <PollListView />
              ) : loading ? (
                <div className="text-center py-8 text-muted-foreground">Termine werden geladen...</div>
              ) : isCalendarView(view) ? (
                <ProperReactBigCalendar
                  events={radarAppointments}
                  view={view}
                  date={currentDate}
                  onNavigate={setCurrentDate}
                  onView={(v) => setView(v as CalendarViewType)}
                  onEventSelect={(a) => {
                    if (a.id.startsWith(REQUEST_EVENT_PREFIX)) { openAppointmentRequestDetail(a.id.slice(REQUEST_EVENT_PREFIX.length)); return; }
                    setSelectedAppointment(a); setSidebarOpen(true);
                  }}
                  onEventDrop={handleEventDrop}
                  onEventResize={handleEventResize}
                  onSelectSlot={(slot) => setSlotChoice({ start: slot.start, end: slot.end })}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
        {/* Detail sidebar */}
        {sidebarOpen && selectedAppointment && (
          <div className="w-[420px] shrink-0 min-h-0 border-x border-border overflow-hidden flex flex-col">
            {currentAppointment && <CollisionRadar event={currentAppointment} events={appointments} onMove={handleEventDrop} />}
            <div className="flex-1 min-h-0">
              <AppointmentDetailsSidebar
              appointment={currentAppointment}
              open={sidebarOpen}
              onClose={() => { setSidebarOpen(false); setSelectedAppointment(null); }}
              onUpdate={refreshAppointments}
              />
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!slotChoice} onOpenChange={(o) => !o && setSlotChoice(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Was möchtest du eintragen?</DialogTitle>
            {slotChoice && (
              <DialogDescription>
                {format(slotChoice.start, "EEEE, d. MMMM, HH:mm 'Uhr'", { locale: de })}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              onClick={() => {
                if (!slotChoice) return;
                navigate(`/calendar?action=create-appointment&start=${slotChoice.start.toISOString()}&end=${slotChoice.end.toISOString()}`);
                setSlotChoice(null);
              }}
            >
              <Calendar className="mr-2 h-4 w-4" /> Fester Termin
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!slotChoice) return;
                const isMidnight = slotChoice.start.getHours() === 0 && slotChoice.start.getMinutes() === 0;
                openAppointmentRequestCreate({
                  date: format(slotChoice.start, "yyyy-MM-dd"),
                  time: isMidnight ? undefined : format(slotChoice.start, "HH:mm"),
                });
                setSlotChoice(null);
              }}
            >
              <CalendarClock className="mr-2 h-4 w-4" /> Als Anfrage vormerken
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AppointmentPreparationSidebar
        appointmentId={selectedAppointmentForPreparation?.id || null}
        appointmentTitle={selectedAppointmentForPreparation?.title}
        appointmentDate={selectedAppointmentForPreparation?.date.toISOString()}
        isOpen={preparationSidebarOpen}
        onClose={() => { setPreparationSidebarOpen(false); setSelectedAppointmentForPreparation(null); }}
      />
    </div>
  );
}
