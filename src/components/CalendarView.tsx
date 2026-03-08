import { useState, useEffect, useRef, startTransition } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProperReactBigCalendar } from "./calendar/ProperReactBigCalendar";
import { AppointmentDetailsSidebar } from "./calendar/AppointmentDetailsSidebar";
import AppointmentPreparationSidebar from "./AppointmentPreparationSidebar";
import { PollListView } from "./poll/PollListView";
import { CalendarHeader } from "./calendar/CalendarHeader";
import { useCalendarData } from "./calendar/hooks/useCalendarData";
import { useCalendarOperations } from "./calendar/hooks/useCalendarOperations";
import type { CalendarEvent } from "./calendar/types";

// Re-export for backward compatibility
export type { CalendarEvent } from "./calendar/types";

export function CalendarView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month" | "agenda" | "polls">("day");
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarEvent | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [preparationSidebarOpen, setPreparationSidebarOpen] = useState(false);
  const [selectedAppointmentForPreparation, setSelectedAppointmentForPreparation] = useState<CalendarEvent | null>(null);
  const handledHighlightRef = useRef<string | null>(null);

  const { appointments, loading, refreshAppointments } = useCalendarData(currentDate, view);
  const { handleEventDrop, handleEventResize } = useCalendarOperations(refreshAppointments);

  // Deep-link support: /calendar?highlight=<id>
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

      let data: any = null;
      let error: any = null;

      if (isExt) {
        const res = await supabase.from("external_events").select("id, title, start_time, end_time, location, all_day").eq("id", id).maybeSingle();
        data = res.data; error = res.error;
      } else {
        const res = await supabase.from("appointments").select("id, title, start_time, end_time, location, is_all_day").eq("id", id).maybeSingle();
        data = res.data; error = res.error;
      }

      if (!active || error || !data) { handledHighlightRef.current = highlightId; return; }

      const startDate = new Date(data.start_time);
      const endDate = data.end_time ? new Date(data.end_time) : startDate;
      const allDay = (data as any).all_day || (data as any).is_all_day || false;

      handledHighlightRef.current = highlightId;
      setCurrentDate(startDate);
      setSelectedAppointment({
        id: isExt ? `external-${data.id}` : data.id,
        title: isExt ? `📅 ${data.title}` : data.title,
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

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onNavigateDate={navigateDate}
        onToday={() => setCurrentDate(new Date())}
        onViewChange={(v) => setView(v as typeof view)}
        onShowPolls={() => setView("polls")}
      />

      <div className="flex gap-0 transition-all duration-300">
        {sidebarOpen && selectedAppointment && (
          <div className="w-[420px] shrink-0 border border-border rounded-lg mr-4 overflow-hidden" style={{ height: "calc(600px + 57px)" }}>
            <AppointmentDetailsSidebar
              appointment={selectedAppointment}
              open={sidebarOpen}
              onClose={() => { setSidebarOpen(false); setSelectedAppointment(null); }}
              onUpdate={refreshAppointments}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 transition-all duration-300">
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {view === "day" && "Tagesansicht"}
                {view === "week" && "Wochenansicht"}
                {view === "month" && "Monatsansicht"}
                {view === "agenda" && "Agenda"}
                {view === "polls" && "Terminabstimmungen"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[600px]">
              {view === "polls" ? (
                <PollListView />
              ) : loading ? (
                <div className="text-center py-8 text-muted-foreground">Termine werden geladen...</div>
              ) : isCalendarView(view) ? (
                <ProperReactBigCalendar
                  events={appointments}
                  view={view}
                  date={currentDate}
                  onNavigate={setCurrentDate}
                  onView={(v) => setView(v as typeof view)}
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
