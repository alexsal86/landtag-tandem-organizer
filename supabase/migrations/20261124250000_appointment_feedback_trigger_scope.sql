-- Feedback-Eintrag nur noch anlegen, wenn sich für die Rückmeldung etwas
-- geändert hat, und den Dublettenschutz an der tatsächlichen Unique-Constraint
-- ausrichten.
--
-- Ausgangslage: create_appointment_feedback_entry() hing als
-- AFTER INSERT OR UPDATE an jedem Update eines Termins. Seit 20261124210000
-- schreibt der Einladungsversand die stabile calendar_uid nach; dadurch bekamen
-- auch alte, nie bewertete Termine bei jedem Update einen Feedback-Eintrag.
-- Außerdem lautete der Konfliktschutz auf ON CONFLICT (appointment_id), obwohl
-- appointment_feedback nur UNIQUE(appointment_id, user_id) besitzt
-- (20251026225547). 20261124205000 hat die fehlerhafte Angabe entfernt; hier
-- kommt sie korrekt wieder hinzu, damit parallele Updates weiterhin sicher sind.
--
-- Feedback für Termine, die erst nach dem Anlegen in die Vergangenheit rutschen,
-- legt weiterhin create-daily-appointment-feedback an; der Trigger ist dafür
-- nicht zuständig.

CREATE OR REPLACE FUNCTION public.create_appointment_feedback_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_settings RECORD;
  calculated_priority INTEGER := 0;
BEGIN
  -- Nur für beendete Termine
  IF NEW.end_time > now() THEN
    RETURN NEW;
  END IF;

  -- Genau ein Feedback pro Termin und Person (UNIQUE(appointment_id, user_id)).
  IF EXISTS (
    SELECT 1
    FROM appointment_feedback
    WHERE appointment_id = NEW.id
      AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Einstellungen gehören zur Person im selben Mandanten.
  SELECT * INTO user_settings
  FROM appointment_feedback_settings
  WHERE user_id = NEW.user_id
    AND tenant_id = NEW.tenant_id
  LIMIT 1;

  -- Ohne Einstellungen: Standard-Feedback
  IF user_settings IS NULL THEN
    INSERT INTO appointment_feedback (
      appointment_id,
      user_id,
      tenant_id,
      feedback_status,
      priority_score
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.tenant_id,
      'pending',
      1
    )
    ON CONFLICT (appointment_id, user_id) DO NOTHING;

    RETURN NEW;
  END IF;

  -- Auto-Skip für interne Termine, wenn aktiviert
  IF user_settings.auto_skip_internal
     AND NEW.category = 'intern' THEN
    INSERT INTO appointment_feedback (
      appointment_id,
      user_id,
      tenant_id,
      feedback_status,
      priority_score
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.tenant_id,
      'skipped',
      0
    )
    ON CONFLICT (appointment_id, user_id) DO NOTHING;

    RETURN NEW;
  END IF;

  -- Priorität aus den hinterlegten Kategorien
  IF NEW.category = ANY(user_settings.priority_categories) THEN
    calculated_priority := 3;
  ELSE
    calculated_priority := 1;
  END IF;

  INSERT INTO appointment_feedback (
    appointment_id,
    user_id,
    tenant_id,
    feedback_status,
    priority_score
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.tenant_id,
    'pending',
    calculated_priority
  )
  ON CONFLICT (appointment_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Nur Anlegen sowie echte Änderungen an Ende, Status oder Kategorie können eine
-- Rückmeldung auslösen. Reine Metadaten-Updates (calendar_uid, Notizen, Gäste)
-- lösen keinen Eintrag mehr aus.
DROP TRIGGER IF EXISTS trigger_create_appointment_feedback ON public.appointments;
CREATE TRIGGER trigger_create_appointment_feedback
  AFTER INSERT OR UPDATE OF end_time, status, category ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_appointment_feedback_entry();
