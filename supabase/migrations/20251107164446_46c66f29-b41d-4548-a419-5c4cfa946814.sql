-- Automatische Feedback-Erstellung für vergangene Termine
-- Erstellt automatisch einen Feedback-Eintrag wenn ein Termin vorbei ist

CREATE OR REPLACE FUNCTION create_feedback_for_past_appointment()
RETURNS TRIGGER AS $$
BEGIN
  -- Prüfe ob Termin vorbei ist und noch kein Feedback existiert
  IF NEW.end_time < NOW() THEN
    -- Prüfe ob bereits Feedback existiert
    IF NOT EXISTS (
      SELECT 1 FROM appointment_feedback 
      WHERE appointment_id = NEW.id
    ) THEN
      -- Erstelle Feedback-Eintrag mit pending Status
      INSERT INTO appointment_feedback (
        appointment_id, 
        user_id, 
        tenant_id, 
        feedback_status, 
        priority_score,
        reminder_dismissed
      ) VALUES (
        NEW.id, 
        NEW.user_id, 
        NEW.tenant_id,
        'pending', 
        0,
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger für neue Termine (INSERT)
DROP TRIGGER IF EXISTS auto_create_feedback_on_insert ON appointments;
CREATE TRIGGER auto_create_feedback_on_insert
AFTER INSERT ON appointments
FOR EACH ROW
EXECUTE FUNCTION create_feedback_for_past_appointment();

-- Trigger für bestehende Termine die aktualisiert werden (UPDATE)
DROP TRIGGER IF EXISTS auto_create_feedback_on_update ON appointments;
CREATE TRIGGER auto_create_feedback_on_update
AFTER UPDATE ON appointments
FOR EACH ROW
WHEN (NEW.end_time < NOW() AND OLD.end_time >= NOW())
EXECUTE FUNCTION create_feedback_for_past_appointment();

-- Erstelle Feedback-Einträge für alle existierenden vergangenen Termine ohne Feedback
INSERT INTO appointment_feedback (
  appointment_id,
  user_id,
  tenant_id,
  feedback_status,
  priority_score,
  reminder_dismissed
)
SELECT 
  a.id,
  a.user_id,
  a.tenant_id,
  'pending',
  0,
  false
FROM appointments a
WHERE a.end_time < NOW()
  AND NOT EXISTS (
    SELECT 1 FROM appointment_feedback af 
    WHERE af.appointment_id = a.id
  );

COMMENT ON FUNCTION create_feedback_for_past_appointment() IS 'Erstellt automatisch Feedback-Einträge für Termine deren end_time überschritten wurde';