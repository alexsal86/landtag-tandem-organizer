-- =====================================================
-- Migration: Zeiterfassung Korrekturen
-- 1. Trigger-Konflikt beheben (Nettozeit = Brutto - Pause)
-- 2. Admin-Bearbeitungsspalten hinzufügen
-- =====================================================

-- 1. Entferne den alten Trigger der die Bruttozeit berechnet (überschreibt korrekten Trigger)
DROP TRIGGER IF EXISTS trg_time_entries_set_minutes ON public.time_entries;
DROP FUNCTION IF EXISTS public.time_entries_set_minutes();

-- 2. Aktualisiere den ensure_net_minutes Trigger für korrekte Nettozeit-Berechnung
CREATE OR REPLACE FUNCTION public.ensure_net_minutes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.started_at IS NOT NULL AND NEW.ended_at IS NOT NULL THEN
    -- Validierung: Endzeit muss nach Startzeit liegen
    IF NEW.ended_at < NEW.started_at THEN
      RAISE EXCEPTION 'ended_at cannot be earlier than started_at';
    END IF;
    -- Berechne Nettozeit = Brutto - Pause
    NEW.minutes := ROUND(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))/60) 
                   - COALESCE(NEW.pause_minutes, 0);
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Stelle sicher, dass der Trigger existiert
DROP TRIGGER IF EXISTS time_entries_calculate_net ON public.time_entries;
CREATE TRIGGER time_entries_calculate_net
  BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.ensure_net_minutes();

-- 4. Korrigiere alle existierenden Einträge (Nettozeit = Brutto - Pause)
UPDATE public.time_entries 
SET minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60) - COALESCE(pause_minutes, 0)
WHERE started_at IS NOT NULL AND ended_at IS NOT NULL;

-- 5. Spalten für Admin-Bearbeitung hinzufügen
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edited_at timestamptz,
ADD COLUMN IF NOT EXISTS edit_reason text;

-- 6. Index für Performance bei Admin-Bearbeitungen
CREATE INDEX IF NOT EXISTS idx_time_entries_edited_by ON public.time_entries(edited_by) WHERE edited_by IS NOT NULL;