-- Fristverlängerung setzt die gespeicherten Erinnerungsstufen zurück.
--
-- Die Stufen in decision_deadline_reminders sind je Entscheidung, Person und Stufe
-- einmalig. Bisher blieben sie auch nach einer Verlängerung stehen; Teilnehmende und
-- Ersteller bekamen dadurch für die neue Frist keine 24-h- oder Überfälligkeitswarnung
-- mehr. Der Trigger löscht die Stufen gezielt, wenn die Frist nach hinten wandert
-- (oder erstmals gesetzt wird) und die Entscheidung noch offen ist. Beim Vorziehen
-- bleiben die Stufen erhalten, damit niemand eine bereits versendete Warnung doppelt
-- bekommt. Der stündliche Dispatcher legt danach nur die Stufen neu an, die zur neuen
-- Frist passen.

CREATE OR REPLACE FUNCTION public.rearm_decision_deadline_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.response_deadline IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.response_deadline IS NOT DISTINCT FROM OLD.response_deadline THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('active', 'open') THEN
    RETURN NEW;
  END IF;
  -- Nur eine spätere Frist ist eine Verlängerung; beim Vorziehen bleiben die
  -- bereits versendeten Stufen stehen.
  IF OLD.response_deadline IS NOT NULL AND NEW.response_deadline <= OLD.response_deadline THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.decision_deadline_reminders
  WHERE decision_id = NEW.id;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.rearm_decision_deadline_reminders() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rearm_decision_deadline_reminders ON public.task_decisions;
CREATE TRIGGER rearm_decision_deadline_reminders
  AFTER UPDATE OF response_deadline ON public.task_decisions
  FOR EACH ROW EXECUTE FUNCTION public.rearm_decision_deadline_reminders();
