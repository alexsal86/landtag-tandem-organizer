-- 1. Korrigiere bestehende Einträge wo Netto = Brutto (Pause nicht abgezogen)
UPDATE time_entries
SET minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60) - COALESCE(pause_minutes, 0)
WHERE started_at IS NOT NULL 
  AND ended_at IS NOT NULL
  AND pause_minutes IS NOT NULL
  AND pause_minutes > 0
  AND minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60);

-- 2. Erstelle Trigger-Funktion für automatische Netto-Berechnung
CREATE OR REPLACE FUNCTION ensure_net_minutes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.started_at IS NOT NULL AND NEW.ended_at IS NOT NULL THEN
    NEW.minutes := ROUND(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))/60) 
                   - COALESCE(NEW.pause_minutes, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Erstelle den Trigger (falls noch nicht vorhanden)
DROP TRIGGER IF EXISTS time_entries_calculate_net ON time_entries;
CREATE TRIGGER time_entries_calculate_net
BEFORE INSERT OR UPDATE ON time_entries
FOR EACH ROW EXECUTE FUNCTION ensure_net_minutes();

-- 4. Erweitere leave_type enum um medical und overtime_reduction
DO $$
BEGIN
  -- Check if 'medical' exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'medical' AND enumtypid = 'leave_type'::regtype) THEN
    ALTER TYPE leave_type ADD VALUE 'medical';
  END IF;
EXCEPTION WHEN others THEN
  -- Type might not exist or other issue, ignore
  NULL;
END $$;

DO $$
BEGIN
  -- Check if 'overtime_reduction' exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'overtime_reduction' AND enumtypid = 'leave_type'::regtype) THEN
    ALTER TYPE leave_type ADD VALUE 'overtime_reduction';
  END IF;
EXCEPTION WHEN others THEN
  -- Type might not exist or other issue, ignore
  NULL;
END $$;

-- 5. Füge medical_reason Spalte zu leave_requests hinzu (falls nicht vorhanden)
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS medical_reason TEXT;

-- 6. Füge start_time und end_time für Arzttermine hinzu
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS minutes_counted INTEGER;

-- 7. Stelle sicher, dass public_holidays eine unique constraint hat
ALTER TABLE public_holidays DROP CONSTRAINT IF EXISTS public_holidays_date_name_key;
ALTER TABLE public_holidays ADD CONSTRAINT public_holidays_date_name_key UNIQUE (holiday_date, name);

-- 8. Füge state Spalte zu public_holidays hinzu (für Bundesland-spezifische Feiertage)
ALTER TABLE public_holidays ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public_holidays ADD COLUMN IF NOT EXISTS is_nationwide BOOLEAN DEFAULT true;