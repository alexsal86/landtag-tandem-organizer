import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { startOfDay, endOfDay, format } from "date-fns";
import { NotebookPen, Plus, X } from "lucide-react";
import { useCalendarData } from "@/components/calendar/hooks/useCalendarData";
import type { CalendarEvent } from "@/components/calendar/types";
import { useAuth } from "@/hooks/useAuth";
import { sendToDaySlip } from "@/lib/daySlipBridge";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { minutesUntil, splitDayEvents } from "./daySlipAppointmentState";

const cleanTitle = (t: string) => t.replace(/^[^\p{L}\p{N}]+/u, "").trim() || t;

function useFollowUpMemory(userId: string | undefined) {
  const key = `dayslip.followup-asked.${userId ?? "anon"}`;
  const [asked, setAsked] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]") as string[]; } catch { return []; }
  });
  const markAsked = (id: string) => {
    setAsked((prev) => {
      const next = [...prev, id].slice(-200);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });
  };
  return { asked, markAsked };
}

export function DaySlipAppointments() {
  const [now, setNow] = useState(() => new Date());
  const [showPast, setShowPast] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { asked, markAsked } = useFollowUpMemory(user?.id);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { appointments, loading, isError, refreshAppointments } = useCalendarData(now, "day");
  const todays = useMemo(
    () => appointments.filter((e) => e.date <= endOfDay(now) && (e.endTime ?? e.date) >= startOfDay(now)),
    [appointments, now],
  );
  const { remaining, past, runningIds, next } = splitDayEvents(todays, now);

  // Ask once per finished internal appointment (not leave, birthdays, blocked or external entries).
  const followUp = past.find(
    (e) => !e.is_all_day && !e._isExternal && e.sourceScope === "internal" && e.type !== "birthday" && !asked.includes(e.id),
  );

  const addLine = (text: string) => {
    sendToDaySlip({ text });
    notify.success("Zum Tageszettel hinzugefügt");
  };

  const renderEvent = (event: CalendarEvent, muted = false) => {
    const running = runningIds.has(event.id);
    const isNext = next?.id === event.id;
    return (
      <div key={event.id} className={cn("group flex items-start gap-1 rounded-r border-l-2 pl-3 py-1 hover:bg-muted", running ? "border-primary bg-primary/5" : "border-primary/50", muted && "opacity-50")}>
        <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/calendar?highlight=${encodeURIComponent(event.id)}&date=${format(now, "yyyy-MM-dd")}`)}>
          <span className="text-xs text-muted-foreground tabular-nums">
            {event.is_all_day ? "Ganztägig" : `${format(event.date, "HH:mm")}–${format(event.endTime ?? event.date, "HH:mm")}`}
            {running && <span className="ml-2 font-semibold text-primary">Jetzt</span>}
            {isNext && <span className="ml-2 font-medium text-foreground">Als Nächstes in {minutesUntil(event.date, now)} Min.</span>}
          </span>
          <span className="block font-medium">{event.title}</span>
          {event.location && <span className="block text-xs text-muted-foreground">{event.location}</span>}
        </button>
        {!muted && (
          <button
            type="button"
            className="mt-1 rounded p-1 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Als Zeile in den Tageszettel übernehmen"
            title="Als Zeile übernehmen"
            onClick={() => addLine(`${event.is_all_day ? "" : format(event.date, "HH:mm") + " "}${cleanTitle(event.title)}`)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  const summary = todays.length === 0
    ? "Heutige Termine (0)"
    : remaining.length === 0
      ? "Für heute keine Termine mehr"
      : past.length > 0 ? `Heutige Termine (${remaining.length} von ${todays.length})` : `Heutige Termine (${remaining.length})`;

  return <details className="border-b px-4 py-2 text-sm" open>
    <summary className="cursor-pointer font-medium">{summary}</summary>
    {followUp && (
      <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs">
        <NotebookPen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">„{cleanTitle(followUp.title)}“ ist vorbei – Nachbereitung notieren?</span>
        <button type="button" className="rounded border border-border px-2 py-0.5 font-medium hover:bg-background" onClick={() => { addLine(`Nachbereitung: ${cleanTitle(followUp.title)}`); markAsked(followUp.id); }}>Notieren</button>
        <button type="button" className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Nicht nachbereiten" onClick={() => markAsked(followUp.id)}><X className="h-3.5 w-3.5" /></button>
      </div>
    )}
    <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
      {isError ? <button className="text-destructive underline" onClick={refreshAppointments}>Termine konnten nicht geladen werden. Erneut versuchen</button>
        : loading ? <p className="text-muted-foreground">Termine werden geladen …</p>
        : todays.length === 0 ? <p className="text-muted-foreground">Heute stehen keine Termine an.</p>
        : <>
          {remaining.map((e) => renderEvent(e))}
          {past.length > 0 && (
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowPast((v) => !v)}>
              {showPast ? "Vergangene ausblenden" : `${past.length} vorbei anzeigen`}
            </button>
          )}
          {showPast && past.map((e) => renderEvent(e, true))}
        </>}
    </div>
  </details>;
}
