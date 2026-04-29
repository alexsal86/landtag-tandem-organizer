import { useState, useEffect, useRef, startTransition, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
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

const viewLabels: Record<string, string> = {
  day: "Tag",
  week: "Woche",
  month: "Monat",
  agenda: "Agenda",
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
      let data: HighlightEventRow | null = null;
      let error: unknown = null;

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
        <div className="w-[260px] shrink-0 min-h-0">
          <CalendarHeader
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

        {/* Detail sidebar */}
        {sidebarOpen && selectedAppointment && (
          <div className="w-[420px] shrink-0 min-h-0 border-x border-border overflow-hidden">
            <AppointmentDetailsSidebar
              appointment={selectedAppointment}
              open={sidebarOpen}
              onClose={() => { setSidebarOpen(false); setSelectedAppointment(null); }}
              onUpdate={refreshAppointments}
            />
          </div>
        )}

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
                  events={visibleAppointments}
                  view={view}
                  date={currentDate}
                  onNavigate={setCurrentDate}
                  onView={(v) => setView(v as CalendarViewType)}
                  onEventSelect={(a) => { setSelectedAppointment(a); setSidebarOpen(true); }}
                  onEventDrop={handleEventDrop}
                  onEventResize={handleEventResize}
                  onSelectSlot={(slot) => {
                    navigate(`/calendar?action=create-appointment&start=${slot.start.toISOString()}&end=${slot.end.toISOString()}`);
                  }}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

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
