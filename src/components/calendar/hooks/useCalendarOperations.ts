import { canMoveAppointment } from "../collisions";
import { toast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import { supabase } from "@/integrations/supabase/client";
import { handleAppError } from "@/utils/errorHandler";
import type { CalendarEvent } from "../types";
import { notify } from "@/lib/notify";

export function useCalendarOperations(refreshAppointments: () => void) {

  /**
   * Verschiebungen sind echte Zeitänderungen: eingeladene Gäste erhalten ein
   * Update auf dieselbe Kalender-UID. Ohne eingeladene Gäste überspringt die
   * Function den Versand.
   */
  const notifyGuestsAboutChange = async (appointmentId: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-appointment-invitation', {
        body: { appointmentId, reason: 'update' },
      });
      if (error) debugConsole.error('Terminänderung konnte nicht an Gäste gesendet werden:', error);
    } catch (error) {
      debugConsole.error('Terminänderung konnte nicht an Gäste gesendet werden:', error);
    }
  };

  const handleEventDrop = async (event: CalendarEvent, start: Date, end: Date) => {
    if (!canMoveAppointment(event)) { notify.error("Dieser Termin muss in seiner Quelle bearbeitet werden."); return; }
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ start_time: start.toISOString(), end_time: end.toISOString() })
        .eq("id", event.id);
      if (error) throw error;
      refreshAppointments();
      void notifyGuestsAboutChange(event.id);
      notify.success("Termin verschoben", { description: `${event.title} wurde erfolgreich verschoben.` 
});
    } catch {
      handleAppError(new Error('Termin konnte nicht verschoben werden'), { context: 'handleEventDrop', toast: { fn: toast, title: 'Fehler', description: 'Der Termin konnte nicht verschoben werden.' } });
    }
  };

  const handleEventResize = async (event: CalendarEvent, _start: Date, end: Date) => {
    if (!canMoveAppointment(event)) { notify.error("Dieser Termin muss in seiner Quelle bearbeitet werden."); return; }
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ end_time: end.toISOString() })
        .eq("id", event.id);
      if (error) throw error;
      refreshAppointments();
      void notifyGuestsAboutChange(event.id);
      notify.success("Termin angepasst", { description: "Die Terminlänge wurde erfolgreich angepasst." 
});
    } catch {
      handleAppError(new Error('Termin konnte nicht angepasst werden'), { context: 'handleEventResize', toast: { fn: toast, title: 'Fehler', description: 'Der Termin konnte nicht angepasst werden.' } });
    }
  };

  return { handleEventDrop, handleEventResize };
}
