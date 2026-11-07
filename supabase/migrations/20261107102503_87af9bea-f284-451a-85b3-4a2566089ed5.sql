ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reminder_at timestamptz, ADD COLUMN IF NOT EXISTS reminder_note text;

CREATE OR REPLACE FUNCTION public.return_task_ball_after_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; t record; label text;
BEGIN
  IF NEW.parent_response_id IS NOT NULL OR COALESCE(NEW.creator_response,'') <> '' AND TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  SELECT id, task_id, created_by, title INTO d FROM task_decisions WHERE id = NEW.decision_id;
  IF d.task_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, ball_owner, ball_assignee_id, timeline, user_id INTO t FROM tasks WHERE id = d.task_id;
  IF t.id IS NULL THEN RETURN NEW; END IF;
  label := CASE NEW.response_type WHEN 'yes' THEN 'Freigegeben' WHEN 'no' THEN 'Abgelehnt' WHEN 'question' THEN 'Rückfrage' ELSE COALESCE(NEW.response_type,'Votum') END;
  UPDATE tasks SET
    ball_owner = 'office',
    ball_assignee_id = COALESCE(d.created_by, t.user_id),
    next_action = CASE WHEN NEW.response_type = 'yes' THEN 'Freigabe umsetzen' WHEN NEW.response_type = 'question' THEN 'Rückfrage beantworten' ELSE 'Votum umsetzen' END,
    next_action_due = NULL,
    timeline = COALESCE(t.timeline,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text, 'type','system', 'at', now(),
      'text', 'Votum zu „' || d.title || '“: ' || label || COALESCE(' – ' || NULLIF(NEW.comment,''), '') || ' · Am Zug: Büro'))
  WHERE id = t.id;
  IF d.created_by IS NOT NULL THEN
    PERFORM create_notification(d.created_by, 'task_decision_response', 'Votum eingegangen: ' || label, d.title, jsonb_build_object('task_id', t.id, 'decision_id', d.id), 'medium');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'return_task_ball_after_vote failed: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_return_task_ball_after_vote ON public.task_decision_responses;
CREATE TRIGGER trg_return_task_ball_after_vote AFTER INSERT OR UPDATE OF response_type ON public.task_decision_responses
FOR EACH ROW EXECUTE FUNCTION public.return_task_ball_after_vote();