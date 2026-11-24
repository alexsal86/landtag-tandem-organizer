-- Strukturierte Terminänderungen: Zeit, Ort oder freier Hinweis.
-- Bestehende Meldungen bleiben als freie Hinweise ('note') gültig.
ALTER TABLE public.appointment_change_alerts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS new_start_time timestamptz,
  ADD COLUMN IF NOT EXISTS new_location text;

ALTER TABLE public.appointment_change_alerts
  ALTER COLUMN message SET DEFAULT '';

ALTER TABLE public.appointment_change_alerts
  DROP CONSTRAINT IF EXISTS appointment_change_alerts_kind_check,
  ADD CONSTRAINT appointment_change_alerts_kind_check
    CHECK (kind IN ('time', 'location', 'note'));

ALTER TABLE public.appointment_change_alerts
  DROP CONSTRAINT IF EXISTS appointment_change_alerts_time_check,
  ADD CONSTRAINT appointment_change_alerts_time_check
    CHECK (kind <> 'time' OR new_start_time IS NOT NULL);

ALTER TABLE public.appointment_change_alerts
  DROP CONSTRAINT IF EXISTS appointment_change_alerts_location_check,
  ADD CONSTRAINT appointment_change_alerts_location_check
    CHECK (kind <> 'location' OR nullif(btrim(new_location), '') IS NOT NULL);
