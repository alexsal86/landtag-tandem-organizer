-- Erstelle Tabelle für Änderungshistorie der Arbeitsverhältnisse
CREATE TABLE IF NOT EXISTS public.employee_settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Kopierte Felder aus employee_settings
  hours_per_week NUMERIC(5,2) NOT NULL,
  days_per_week INTEGER NOT NULL,
  hours_per_month NUMERIC(6,2) NOT NULL,
  days_per_month INTEGER NOT NULL,
  annual_vacation_days INTEGER NOT NULL,
  
  -- Metadaten
  valid_from DATE NOT NULL,
  valid_until DATE,  -- NULL = aktuell gültig
  changed_by UUID,
  change_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_date_check CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Indexes für Performance
CREATE INDEX IF NOT EXISTS idx_employee_settings_history_user 
  ON public.employee_settings_history(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_settings_history_dates 
  ON public.employee_settings_history(user_id, valid_from, valid_until);

-- Enable RLS
ALTER TABLE public.employee_settings_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Mitarbeiter können ihre eigene Historie sehen
CREATE POLICY "Users can view own history"
  ON public.employee_settings_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Admins können alle Historien sehen
CREATE POLICY "Admins can view all history"
  ON public.employee_settings_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_settings
      WHERE employee_settings.user_id = employee_settings_history.user_id
      AND employee_settings.admin_id = auth.uid()
    )
  );

-- RLS Policy: System kann Historie erstellen
CREATE POLICY "System can insert history"
  ON public.employee_settings_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policy: System kann Historie updaten (valid_until setzen)
CREATE POLICY "System can update history"
  ON public.employee_settings_history FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger-Funktion: Automatisches Erstellen von History-Einträgen
CREATE OR REPLACE FUNCTION public.track_employee_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Nur bei Änderung relevanter Felder
  IF (OLD.hours_per_week IS DISTINCT FROM NEW.hours_per_week OR 
      OLD.days_per_week IS DISTINCT FROM NEW.days_per_week OR
      OLD.hours_per_month IS DISTINCT FROM NEW.hours_per_month OR
      OLD.days_per_month IS DISTINCT FROM NEW.days_per_month OR
      OLD.annual_vacation_days IS DISTINCT FROM NEW.annual_vacation_days) THEN
    
    -- Schließe vorherige History (setze valid_until auf heute)
    UPDATE public.employee_settings_history
    SET valid_until = CURRENT_DATE
    WHERE user_id = OLD.user_id AND valid_until IS NULL;
    
    -- Erstelle neuen History-Eintrag
    INSERT INTO public.employee_settings_history (
      user_id, hours_per_week, days_per_week, hours_per_month, 
      days_per_month, annual_vacation_days, valid_from, 
      changed_by, change_reason
    ) VALUES (
      NEW.user_id, NEW.hours_per_week, NEW.days_per_week, 
      NEW.hours_per_month, NEW.days_per_month, NEW.annual_vacation_days,
      CURRENT_DATE, auth.uid(), 
      'Änderung durch Admin'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger auf employee_settings Tabelle
DROP TRIGGER IF EXISTS employee_settings_history_trigger ON public.employee_settings;
CREATE TRIGGER employee_settings_history_trigger
  AFTER UPDATE ON public.employee_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.track_employee_settings_changes();

-- Initiale Historie für alle bestehenden Mitarbeiter erstellen
INSERT INTO public.employee_settings_history (
  user_id, hours_per_week, days_per_week, hours_per_month,
  days_per_month, annual_vacation_days, valid_from, change_reason
)
SELECT 
  user_id, 
  hours_per_week, 
  days_per_week, 
  hours_per_month,
  days_per_month, 
  annual_vacation_days,
  COALESCE(employment_start_date, created_at::DATE) as valid_from,
  'Initiale Erfassung beim System-Upgrade'
FROM public.employee_settings
WHERE NOT EXISTS (
  SELECT 1 FROM public.employee_settings_history h
  WHERE h.user_id = employee_settings.user_id
);