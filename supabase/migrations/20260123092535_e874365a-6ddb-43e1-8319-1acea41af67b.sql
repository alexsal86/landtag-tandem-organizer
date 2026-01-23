-- 1. Neues Feld für Resturlaub-Verfall in employee_settings
ALTER TABLE employee_settings 
ADD COLUMN IF NOT EXISTS carry_over_expires_at DATE DEFAULT NULL;

-- 2. Urlaubshistorie-Tabelle für Mitarbeiter und Admin
CREATE TABLE IF NOT EXISTS vacation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  annual_entitlement INTEGER NOT NULL DEFAULT 0,
  carry_over_from_previous INTEGER DEFAULT 0,
  total_taken INTEGER DEFAULT 0,
  carry_over_to_next INTEGER DEFAULT 0,
  expired_days INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year)
);

-- RLS aktivieren
ALTER TABLE vacation_history ENABLE ROW LEVEL SECURITY;

-- Policy: Mitarbeiter sehen eigene Historie
CREATE POLICY "Users can view own vacation history"
  ON vacation_history FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins (abgeordneter) sehen alle
CREATE POLICY "Admins can view all vacation history"
  ON vacation_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() AND role = 'abgeordneter'
    )
  );

-- Policy: System kann Einträge erstellen/aktualisieren
CREATE POLICY "System can insert vacation history"
  ON vacation_history FOR INSERT
  WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() AND role = 'abgeordneter'
  ));

CREATE POLICY "System can update vacation history"
  ON vacation_history FOR UPDATE
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() AND role = 'abgeordneter'
  ));

-- Trigger für updated_at
CREATE TRIGGER update_vacation_history_updated_at
  BEFORE UPDATE ON vacation_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. Funktion zum Berechnen des Resturlaub-Verfalls am 1. April
CREATE OR REPLACE FUNCTION expire_carry_over_vacation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_yr INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  emp RECORD;
BEGIN
  -- Nur ausführen wenn nach dem 31. März
  IF CURRENT_DATE > make_date(current_yr, 3, 31) THEN
    FOR emp IN 
      SELECT es.user_id, es.carry_over_days, es.carry_over_expires_at
      FROM employee_settings es
      WHERE es.carry_over_days > 0 
        AND es.carry_over_expires_at IS NOT NULL
        AND es.carry_over_expires_at < CURRENT_DATE
    LOOP
      -- In Historie speichern
      INSERT INTO vacation_history (user_id, year, expired_days, notes)
      VALUES (emp.user_id, current_yr - 1, emp.carry_over_days, 'Automatisch verfallen am 01.04.')
      ON CONFLICT (user_id, year) 
      DO UPDATE SET 
        expired_days = vacation_history.expired_days + EXCLUDED.expired_days,
        updated_at = now();
      
      -- Resturlaub auf 0 setzen
      UPDATE employee_settings 
      SET carry_over_days = 0, carry_over_expires_at = NULL
      WHERE user_id = emp.user_id;
    END LOOP;
  END IF;
END;
$$;

-- 4. Initiale Werte für carry_over_expires_at setzen (für bestehende Resturlaub-Tage)
UPDATE employee_settings
SET carry_over_expires_at = make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, 3, 31)
WHERE carry_over_days > 0 AND carry_over_expires_at IS NULL;