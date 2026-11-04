import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { startOfDay, endOfDay, format } from "date-fns";
import { useCalendarData } from "@/components/calendar/hooks/useCalendarData";

export function DaySlipAppointments() {
  const [today, setToday] = useState(() => new Date());
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const { appointments, loading, isError, refreshAppointments } = useCalendarData(today, "day");
  const events = appointments.filter(event => event.date <= endOfDay(today) && (event.endTime ?? event.date) >= startOfDay(today)).sort((a, b) => a.date.getTime() - b.date.getTime());
  return <details className="border-b px-4 py-2 text-sm" open>
    <summary className="cursor-pointer font-medium">Heutige Termine ({events.length})</summary>
    <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
      {isError ? <button className="text-destructive underline" onClick={refreshAppointments}>Termine konnten nicht geladen werden. Erneut versuchen</button> : loading ? <p className="text-muted-foreground">Termine werden geladen …</p> : events.length === 0 ? <p className="text-muted-foreground">Heute stehen keine Termine an.</p> : events.map(event => <button key={event.id} className="block w-full border-l-2 border-primary pl-3 py-1 text-left hover:bg-muted rounded-r" onClick={() => navigate(`/calendar?highlight=${encodeURIComponent(event.id)}&date=${format(today, "yyyy-MM-dd")}`)}>
        <span className="text-xs text-muted-foreground">{event.is_all_day ? "Ganztägig" : `${format(event.date, "HH:mm")}–${format(event.endTime ?? event.date, "HH:mm")}`}</span>
        <span className="block font-medium">{event.title}</span>
        {event.location && <span className="block text-xs text-muted-foreground">{event.location}</span>}
      </button>)}
    </div>
  </details>;
}
