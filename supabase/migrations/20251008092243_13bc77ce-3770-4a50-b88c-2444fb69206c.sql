-- Function: Automatische Archivierung bei vollständiger Beantwortung
CREATE OR REPLACE FUNCTION auto_archive_completed_decisions()
RETURNS TRIGGER AS $$
DECLARE
  total_participants INTEGER;
  total_responses INTEGER;
  open_questions INTEGER;
  decision_status TEXT;
  decision_title TEXT;
  decision_creator UUID;
BEGIN
  -- Nur offene Entscheidungen prüfen
  SELECT status, title, created_by INTO decision_status, decision_title, decision_creator
  FROM task_decisions
  WHERE id = NEW.decision_id;
  
  IF decision_status != 'open' THEN
    RETURN NEW;
  END IF;

  -- Anzahl der Teilnehmer
  SELECT COUNT(*) INTO total_participants
  FROM task_decision_participants
  WHERE decision_id = NEW.decision_id;
  
  -- Anzahl der eindeutigen Antworten (neueste pro Teilnehmer)
  SELECT COUNT(DISTINCT participant_id) INTO total_responses
  FROM (
    SELECT DISTINCT ON (participant_id) participant_id, response_type
    FROM task_decision_responses
    WHERE decision_id = NEW.decision_id
    ORDER BY participant_id, created_at DESC
  ) latest_responses;
  
  -- Anzahl offener Fragen (ohne creator_response)
  SELECT COUNT(*) INTO open_questions
  FROM (
    SELECT DISTINCT ON (participant_id) *
    FROM task_decision_responses
    WHERE decision_id = NEW.decision_id
    ORDER BY participant_id, created_at DESC
  ) latest_responses
  WHERE response_type = 'question' AND creator_response IS NULL;
  
  -- Auto-Archivierung wenn:
  -- 1. Alle haben geantwortet
  -- 2. Keine offenen Fragen mehr
  IF total_participants = total_responses AND open_questions = 0 THEN
    UPDATE task_decisions
    SET 
      status = 'archived',
      archived_at = NOW(),
      archived_by = decision_creator
    WHERE id = NEW.decision_id;
    
    -- Notification an Creator
    PERFORM create_notification(
      decision_creator,
      'task_decision_completed',
      'Entscheidung automatisch archiviert',
      'Die Entscheidung "' || decision_title || '" wurde automatisch archiviert, da alle Teilnehmer geantwortet haben.',
      jsonb_build_object('decision_id', NEW.decision_id),
      'low'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger auf INSERT und UPDATE von Responses
DROP TRIGGER IF EXISTS trigger_auto_archive_decisions ON task_decision_responses;
CREATE TRIGGER trigger_auto_archive_decisions
AFTER INSERT OR UPDATE ON task_decision_responses
FOR EACH ROW
EXECUTE FUNCTION auto_archive_completed_decisions();

-- Trigger auch auf creator_response Updates
CREATE OR REPLACE FUNCTION check_archive_after_creator_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Wenn creator_response hinzugefügt wurde, prüfe ob archiviert werden kann
  IF NEW.creator_response IS NOT NULL AND (OLD.creator_response IS NULL OR OLD.creator_response = '') THEN
    PERFORM auto_archive_completed_decisions();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_archive_on_creator_response ON task_decision_responses;
CREATE TRIGGER trigger_check_archive_on_creator_response
AFTER UPDATE ON task_decision_responses
FOR EACH ROW
WHEN (NEW.creator_response IS NOT NULL AND (OLD.creator_response IS NULL OR OLD.creator_response = ''))
EXECUTE FUNCTION check_archive_after_creator_response();