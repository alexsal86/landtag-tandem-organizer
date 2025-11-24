-- Korrigiere hours_per_month Berechnung: Basiert nur auf hours_per_week
-- Formel: hours_per_week * 52 Wochen / 12 Monate = Monatsstunden
UPDATE employee_settings
SET hours_per_month = ROUND(hours_per_week * 52.0 / 12.0, 2)
WHERE hours_per_month != ROUND(hours_per_week * 52.0 / 12.0, 2);

-- Erstelle Funktion für automatische Berechnung bei Updates
CREATE OR REPLACE FUNCTION auto_calculate_hours_per_month()
RETURNS TRIGGER AS $$
BEGIN
  -- Berechne hours_per_month automatisch basierend nur auf hours_per_week
  -- Unabhängig von days_per_week: 39,5h/Woche auf 4 oder 5 Tage = gleiche Monatsstunden
  NEW.hours_per_month := ROUND(NEW.hours_per_week * 52.0 / 12.0, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Erstelle Trigger für automatische Berechnung
DROP TRIGGER IF EXISTS employee_settings_auto_calculate ON employee_settings;
CREATE TRIGGER employee_settings_auto_calculate
  BEFORE INSERT OR UPDATE OF hours_per_week
  ON employee_settings
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_hours_per_month();