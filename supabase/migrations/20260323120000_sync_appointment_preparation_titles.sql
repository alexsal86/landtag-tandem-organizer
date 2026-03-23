CREATE OR REPLACE FUNCTION public.sync_appointment_preparation_titles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.title IS NOT DISTINCT FROM OLD.title THEN
    RETURN NEW;
  END IF;

  UPDATE public.appointment_preparations
  SET
    title = CASE
      WHEN title = 'Terminplanung: ' || OLD.title THEN 'Terminplanung: ' || NEW.title
      WHEN title = 'Vorbereitung: ' || OLD.title THEN 'Vorbereitung: ' || NEW.title
      ELSE title
    END,
    updated_at = now()
  WHERE appointment_id = NEW.id
    AND title IN (
      'Terminplanung: ' || OLD.title,
      'Vorbereitung: ' || OLD.title
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_appointment_preparation_titles_on_appointment_update ON public.appointments;

CREATE TRIGGER sync_appointment_preparation_titles_on_appointment_update
AFTER UPDATE OF title ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_appointment_preparation_titles();
