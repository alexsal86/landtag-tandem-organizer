-- create_appointment_feedback_entry() schreibt mit ON CONFLICT (appointment_id),
-- aber appointment_feedback hat auf appointment_id keinen Unique-Index (nur einen
-- normalen Index und eine UNIQUE auf external_event_id). Jeder Insert lief daher
-- in "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" – sobald ein vergangener Termin ohne Rückmeldung aktualisiert
-- wurde. Die Funktion prüft vorher bereits per EXISTS, ob Feedback existiert;
-- der ON CONFLICT-Zusatz ist damit redundant und wird entfernt.
DO $$
DECLARE
  definition text;
  patched text;
BEGIN
  IF to_regprocedure('public.create_appointment_feedback_entry()') IS NULL THEN
    RAISE NOTICE 'create_appointment_feedback_entry() fehlt – nichts zu tun';
    RETURN;
  END IF;

  SELECT pg_get_functiondef('public.create_appointment_feedback_entry()'::regprocedure)
  INTO definition;

  IF definition NOT LIKE '%ON CONFLICT (appointment_id) DO NOTHING%' THEN
    RAISE NOTICE 'create_appointment_feedback_entry(): kein ON CONFLICT (appointment_id) vorhanden';
    RETURN;
  END IF;

  patched := replace(definition, 'ON CONFLICT (appointment_id) DO NOTHING', '');

  IF patched LIKE '%ON CONFLICT (appointment_id)%' THEN
    RAISE EXCEPTION 'ON CONFLICT (appointment_id) konnte nicht vollständig entfernt werden';
  END IF;

  EXECUTE patched;
  RAISE NOTICE 'create_appointment_feedback_entry(): ON CONFLICT (appointment_id) entfernt';
END $$;
