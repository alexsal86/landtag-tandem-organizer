import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleAppError } from "@/utils/errorHandler";
import type { CalendarEvent } from "../types";

export function useCalendarOperations(refreshAppointments: () => void) {
  const { toast } = useToast();

  const handleEventDrop = async (event: CalendarEvent, start: Date, end: Date) => {
    if (!event.id || event.id.startsWith("blocked-")) return;
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ start_time: start.toISOString(), end_time: end.toISOString() })
        .eq("id", event.id);
      if (error) throw error;
      refreshAppointments();
      toast({ title: "Termin verschoben", description: `${event.title} wurde erfolgreich verschoben.` });
    } catch {
      toast({ title: "Fehler", description: "Der Termin konnte nicht verschoben werden.", variant: "destructive" });
    }
  };

  const handleEventResize = async (event: CalendarEvent, _start: Date, end: Date) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ end_time: end.toISOString() })
        .eq("id", event.id);
      if (error) throw error;
      refreshAppointments();
      toast({ title: "Termin angepasst", description: "Die Terminlänge wurde erfolgreich angepasst." });
    } catch {
      toast({ title: "Fehler", description: "Der Termin konnte nicht angepasst werden.", variant: "destructive" });
    }
  };

  return { handleEventDrop, handleEventResize };
}
