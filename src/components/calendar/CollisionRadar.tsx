import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { canMoveAppointment, nextFreeSlot, overlaps } from "./collisions";
import type { CalendarEvent } from "./types";

export function CollisionRadar({ event, events, onMove }: { event: CalendarEvent; events: CalendarEvent[]; onMove: (event: CalendarEvent, start: Date, end: Date) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const conflicts = events.filter(other => overlaps(event, other));
  if (!conflicts.length) return null;
  const next = canMoveAppointment(event) ? nextFreeSlot(event, events) : null;
  return <div className="shrink-0 border-b border-destructive/40 bg-destructive/10 p-3 space-y-2" role="status">
    <p className="font-semibold text-destructive">⚠ Terminkollision</p>
    <p className="text-sm">Überschneidung mit: {conflicts.map(other => other.title).join(", ")}</p>
    {next && event.endTime ? <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await onMove(event, next, new Date(next.getTime() + event.endTime!.getTime() - event.date.getTime())); } finally { setBusy(false); }
    }}>{busy ? "Wird verschoben …" : `Auf ${format(next, "dd.MM. HH:mm")} verschieben`}</Button> : <p className="text-xs">Bitte diesen Termin in seiner Quelle bearbeiten oder einen anderen kollidierenden Termin verschieben.</p>}
  </div>;
}
