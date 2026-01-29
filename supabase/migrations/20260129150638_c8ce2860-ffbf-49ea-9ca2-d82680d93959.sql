-- Trigger erstellen für automatische Netto-Berechnung
DROP TRIGGER IF EXISTS time_entries_calculate_net ON time_entries;

CREATE TRIGGER time_entries_calculate_net
BEFORE INSERT OR UPDATE ON time_entries
FOR EACH ROW EXECUTE FUNCTION ensure_net_minutes();

-- Bestehende Einträge korrigieren (Netto = Brutto - Pause)
UPDATE time_entries
SET minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60) - COALESCE(pause_minutes, 0)
WHERE started_at IS NOT NULL 
  AND ended_at IS NOT NULL;