ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS nudged_at timestamptz,
  ADD COLUMN IF NOT EXISTS nudged_by uuid,
  ADD COLUMN IF NOT EXISTS nudge_note text,
  ADD COLUMN IF NOT EXISTS nudge_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nudge_seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.nudge_task(_task_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; me uuid := auth.uid(); my_name text; r uuid; n int := 0;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO t FROM tasks WHERE id = _task_id;
  IF t.id IS NULL OR NOT EXISTS (SELECT 1 FROM user_tenant_memberships m WHERE m.user_id = me AND m.tenant_id = t.tenant_id AND m.is_active) THEN
    RAISE EXCEPTION 'task not accessible';
  END IF;
  IF t.ball_owner = 'external' THEN RAISE EXCEPTION 'Externe können nicht angestupst werden'; END IF;
  IF t.nudged_by = me AND t.nudged_at > now() - interval '24 hours' THEN
    RAISE EXCEPTION 'Heute bereits angestupst';
  END IF;
  SELECT display_name INTO my_name FROM profiles WHERE user_id = me LIMIT 1;
  UPDATE tasks SET nudged_at = now(), nudged_by = me, nudge_note = NULLIF(trim(_note),''),
    nudge_count = CASE WHEN nudge_seen_at IS NULL OR nudge_seen_at < nudged_at THEN nudge_count + 1 ELSE 1 END,
    nudge_seen_at = NULL,
    timeline = COALESCE(timeline,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'type','system','at', now(), 'actorName', my_name,
      'text', 'Angestupst' || COALESCE(': „' || NULLIF(trim(_note),'') || '“', '')))
  WHERE id = _task_id;
  FOR r IN
    SELECT DISTINCT uid FROM (
      SELECT t.ball_assignee_id AS uid WHERE t.ball_assignee_id IS NOT NULL
      UNION SELECT m.user_id FROM user_tenant_memberships m JOIN user_roles ur ON ur.user_id = m.user_id
        WHERE t.ball_assignee_id IS NULL AND t.ball_owner = 'deputy' AND m.tenant_id = t.tenant_id AND m.is_active AND ur.role = 'abgeordneter'
      UNION SELECT t.user_id WHERE t.ball_assignee_id IS NULL AND t.ball_owner = 'office'
    ) x WHERE uid IS NOT NULL AND uid <> me
  LOOP
    BEGIN
      PERFORM create_notification(r, 'task_updated', 'Angestupst: ' || t.title,
        COALESCE(my_name,'Jemand') || ' wartet auf dich' || COALESCE(' – ' || NULLIF(trim(_note),''), ''),
        jsonb_build_object('task_id', t.id, 'nudge', true), 'high');
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'nudge notify failed: %', SQLERRM; END;
    n := n + 1;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ack_task_nudge(_task_id uuid, _reply text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; me uuid := auth.uid(); my_name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO t FROM tasks WHERE id = _task_id;
  IF t.id IS NULL OR NOT EXISTS (SELECT 1 FROM user_tenant_memberships m WHERE m.user_id = me AND m.tenant_id = t.tenant_id AND m.is_active) THEN
    RAISE EXCEPTION 'task not accessible';
  END IF;
  SELECT display_name INTO my_name FROM profiles WHERE user_id = me LIMIT 1;
  UPDATE tasks SET nudge_seen_at = now(),
    timeline = COALESCE(timeline,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,
      'type', CASE WHEN NULLIF(trim(_reply),'') IS NULL THEN 'system' ELSE 'note' END, 'at', now(), 'actorName', my_name,
      'text', COALESCE('Antwort aufs Anstupsen: ' || NULLIF(trim(_reply),''), 'Anstupsen gesehen')))
  WHERE id = _task_id;
  IF NULLIF(trim(_reply),'') IS NOT NULL AND t.nudged_by IS NOT NULL AND t.nudged_by <> me THEN
    BEGIN
      PERFORM create_notification(t.nudged_by, 'task_updated', 'Antwort: ' || t.title, COALESCE(my_name,'') || ': ' || trim(_reply), jsonb_build_object('task_id', t.id), 'medium');
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'ack notify failed: %', SQLERRM; END;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.nudge_task(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ack_task_nudge(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nudge_task(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ack_task_nudge(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.return_task_ball_after_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; t record; label text;
BEGIN
  IF NEW.parent_response_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT id, task_id, created_by, title INTO d FROM task_decisions WHERE id = NEW.decision_id;
  IF d.task_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, timeline, user_id INTO t FROM tasks WHERE id = d.task_id;
  IF t.id IS NULL THEN RETURN NEW; END IF;
  label := CASE NEW.response_type WHEN 'yes' THEN 'Freigegeben' WHEN 'no' THEN 'Abgelehnt' WHEN 'question' THEN 'Rückfrage' ELSE COALESCE(NEW.response_type,'Votum') END;
  UPDATE tasks SET ball_owner = 'office', ball_assignee_id = COALESCE(d.created_by, t.user_id),
    next_action = CASE WHEN NEW.response_type = 'yes' THEN 'Freigabe umsetzen' WHEN NEW.response_type = 'question' THEN 'Rückfrage beantworten' ELSE 'Votum umsetzen' END,
    next_action_due = NULL,
    timeline = COALESCE(t.timeline,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'type','system', 'at', now(),
      'text', 'Votum zu „' || d.title || '“: ' || label || COALESCE(' – ' || NULLIF(NEW.comment,''), '') || ' · Am Zug: Büro'))
  WHERE id = t.id;
  IF d.created_by IS NOT NULL THEN
    BEGIN
      PERFORM create_notification(d.created_by, 'task_updated', 'Votum eingegangen: ' || label, d.title, jsonb_build_object('task_id', t.id, 'decision_id', d.id), 'medium');
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'vote notify failed: %', SQLERRM; END;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.return_task_ball_after_vote() FROM PUBLIC, anon, authenticated;