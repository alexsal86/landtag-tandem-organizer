
-- 1. Neue Helper-Funktion (RETURNS void, nicht trigger)
CREATE OR REPLACE FUNCTION public.check_and_archive_decision(p_decision_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_participants INTEGER;
  total_responses INTEGER;
  open_questions INTEGER;
  decision_status TEXT;
  decision_title TEXT;
  decision_creator UUID;
BEGIN
  SELECT status, title, created_by INTO decision_status, decision_title, decision_creator
  FROM task_decisions WHERE id = p_decision_id;
  
  IF decision_status IS NULL OR decision_status NOT IN ('active', 'open') THEN RETURN; END IF;

  SELECT COUNT(*) INTO total_participants
  FROM task_decision_participants WHERE decision_id = p_decision_id;
  
  SELECT COUNT(DISTINCT participant_id) INTO total_responses
  FROM (
    SELECT DISTINCT ON (participant_id) participant_id, response_type
    FROM task_decision_responses WHERE decision_id = p_decision_id
    ORDER BY participant_id, created_at DESC
  ) latest_responses;
  
  SELECT COUNT(*) INTO open_questions
  FROM (
    SELECT DISTINCT ON (participant_id) *
    FROM task_decision_responses WHERE decision_id = p_decision_id
    ORDER BY participant_id, created_at DESC
  ) latest_responses
  WHERE response_type = 'question' AND creator_response IS NULL;
  
  IF total_participants > 0 AND total_participants = total_responses AND open_questions = 0 THEN
    UPDATE task_decisions SET status = 'archived', archived_at = NOW(), archived_by = decision_creator
    WHERE id = p_decision_id AND status IN ('active', 'open');
    
    BEGIN
      PERFORM create_notification(decision_creator, 'task_decision_completed',
        'Entscheidung automatisch archiviert',
        'Die Entscheidung "' || COALESCE(decision_title, '') || '" wurde automatisch archiviert.',
        jsonb_build_object('decision_id', p_decision_id), 'low');
    EXCEPTION WHEN OTHERS THEN
      -- Notification-Fehler sollen den Archivierungsprozess nicht blockieren
      NULL;
    END;
  END IF;
END;
$$;

-- 2. check_archive_after_creator_response reparieren (ruft jetzt RETURNS void Funktion auf)
CREATE OR REPLACE FUNCTION public.check_archive_after_creator_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.creator_response IS NOT NULL AND (OLD.creator_response IS NULL OR OLD.creator_response = '') THEN
    PERFORM check_and_archive_decision(NEW.decision_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 3. auto_archive_completed_decisions ebenfalls reparieren
CREATE OR REPLACE FUNCTION public.auto_archive_completed_decisions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM check_and_archive_decision(NEW.decision_id);
  RETURN NEW;
END;
$$;
