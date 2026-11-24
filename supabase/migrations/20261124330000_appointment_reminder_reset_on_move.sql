-- Neunummeriert (vorher 20261124270000): die Version war mit
-- social_approval_comments doppelt belegt, und Supabase führt schema_migrations
-- nur über die Version. Das Skript ist wiederholbar (CREATE OR REPLACE,
-- DROP TRIGGER IF EXISTS), ein zweiter Lauf ändert also nichts.
--
-- Terminverschiebung macht die Erinnerung wieder scharf.
--
-- appointment_reminder_dispatches verhindert Doppelversände über
-- UNIQUE (appointment_id, minutes_before). Wird ein Termin verschoben, blieb
-- der bereits verbuchte Versand bisher stehen – der neue Termin hätte nie
-- wieder erinnert. Deshalb räumt dieser Trigger die Versandzeilen des Termins
-- auf, sobald sich start_time ändert; der nächste Lauf von
-- dispatch_due_appointment_reminders greift den Termin dann erneut auf.
--
-- Bewusst nur bei start_time: eine Änderung von reminder_minutes erzeugt über
-- den neuen Schlüssel ohnehin eine eigene Erinnerung, und reine Metadaten-,
-- Titel- oder Ortskorrekturen sollen keine bereits verschickte Erinnerung
-- wiederholen. Die Bedingung entspricht appointmentReminderResetsOnMove in
-- supabase/functions/_shared/appointmentReminder.ts.

CREATE OR REPLACE FUNCTION public.reset_appointment_reminders_on_move()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- IS DISTINCT FROM behandelt NULL sicher und ignoriert Updates, die
  -- start_time nur erneut mitschreiben, ohne den Wert zu ändern.
  IF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
    DELETE FROM public.appointment_reminder_dispatches d
    WHERE d.appointment_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reset_appointment_reminders_on_move ON public.appointments;
CREATE TRIGGER reset_appointment_reminders_on_move
  AFTER UPDATE OF start_time ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_appointment_reminders_on_move();

REVOKE ALL ON FUNCTION public.reset_appointment_reminders_on_move() FROM PUBLIC, anon, authenticated;
