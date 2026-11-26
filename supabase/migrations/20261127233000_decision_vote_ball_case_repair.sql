-- return_task_ball_after_vote hatte in der Fassung aus 20261115075438 einen
-- einfachen CASE mit einem Booleschen WHEN: Postgres verglich dort
-- NEW.response_type (text) mit (NEW.response_type = 'question') (boolean) und
-- brach mit 42883 „operator does not exist: text = boolean“ ab. Die Funktion
-- läuft ohne Exception-Wrapper im Trigger, deshalb scheiterte jedes Votum zu
-- einer verknüpften Aufgabe – auch der Selbsttest „Votum holt den Ball zurück“.
-- Der CASE wird als durchsuchter CASE geschrieben; Mandantenprüfung,
-- Ball-Rückgabe und Benachrichtigung bleiben unverändert.
CREATE OR REPLACE FUNCTION public.return_task_ball_after_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; t record; label text;
BEGIN
  IF NEW.parent_response_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT id, task_id, created_by, title, tenant_id INTO d FROM task_decisions WHERE id = NEW.decision_id;
  IF d.task_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, timeline, user_id, tenant_id INTO t FROM tasks WHERE id = d.task_id AND tenant_id = d.tenant_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Decision task belongs to another tenant' USING ERRCODE = '42501'; END IF;
  label := CASE NEW.response_type WHEN 'yes' THEN 'Freigegeben' WHEN 'no' THEN 'Abgelehnt' WHEN 'question' THEN 'Rückfrage' ELSE COALESCE(NEW.response_type, 'Votum') END;
  UPDATE tasks SET ball_owner = 'office',
    ball_assignee_id = COALESCE(d.created_by, t.user_id),
    next_action = CASE
      WHEN NEW.response_type = 'yes' THEN 'Freigabe umsetzen'
      WHEN NEW.response_type = 'question' THEN 'Rückfrage beantworten'
      ELSE 'Votum umsetzen'
    END,
    next_action_due = NULL,
    timeline = COALESCE(t.timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text, 'type', 'system', 'at', now(),
      'text', 'Votum zu „' || d.title || '“: ' || label || COALESCE(' – ' || NULLIF(NEW.comment, ''), '') || ' · Am Zug: Büro'))
  WHERE id = t.id AND tenant_id = d.tenant_id;
  IF d.created_by IS NOT NULL AND EXISTS (
    SELECT 1 FROM user_tenant_memberships WHERE user_id = d.created_by AND tenant_id = d.tenant_id AND is_active
  ) THEN
    BEGIN
      PERFORM create_notification(d.created_by, 'task_updated', 'Votum eingegangen: ' || label, d.title,
        jsonb_build_object('task_id', t.id, 'decision_id', d.id, 'tenant_id', d.tenant_id), 'medium');
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'vote notification failed';
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.return_task_ball_after_vote() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_return_task_ball_after_vote ON public.task_decision_responses;
CREATE TRIGGER trg_return_task_ball_after_vote AFTER INSERT OR UPDATE OF response_type ON public.task_decision_responses
FOR EACH ROW EXECUTE FUNCTION public.return_task_ball_after_vote();
