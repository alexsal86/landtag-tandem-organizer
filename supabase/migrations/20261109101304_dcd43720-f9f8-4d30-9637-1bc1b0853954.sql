ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS briefing_depth text NOT NULL DEFAULT 'compact';

CREATE OR REPLACE FUNCTION public.validate_appointment_briefing_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.briefing_status NOT IN ('undecided','none','assigned','in_review','approved','completed') THEN
    RAISE EXCEPTION 'invalid briefing_status %', NEW.briefing_status;
  END IF;
  IF NEW.briefing_depth NOT IN ('compact','full') THEN
    RAISE EXCEPTION 'invalid briefing_depth %', NEW.briefing_depth;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_appointment_briefing_depth(_appointment_id uuid, _depth text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments;
BEGIN
  IF _depth NOT IN ('compact','full') THEN RAISE EXCEPTION 'invalid depth'; END IF;
  SELECT * INTO a FROM public.appointments WHERE id = _appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (public.has_active_tenant_role(auth.uid(), a.tenant_id, ARRAY['abgeordneter','bueroleitung']) OR a.briefing_assignee_id = auth.uid()) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  UPDATE public.appointments SET briefing_depth = _depth WHERE id = a.id;
END $$;
REVOKE ALL ON FUNCTION public.set_appointment_briefing_depth(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_appointment_briefing_depth(uuid, text) TO authenticated;

-- Follow-up task from live briefing / debrief, with stafette fields and timeline.
CREATE OR REPLACE FUNCTION public.create_briefing_follow_up_task(_appointment_id uuid, _title text, _assignee uuid DEFAULT NULL,
  _due date DEFAULT NULL, _description text DEFAULT NULL, _priority text DEFAULT 'medium', _feedback_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_task uuid := gen_random_uuid(); v_owner uuid;
BEGIN
  IF COALESCE(btrim(_title),'') = '' THEN RAISE EXCEPTION 'Titel fehlt'; END IF;
  IF _priority NOT IN ('low','medium','high') THEN RAISE EXCEPTION 'invalid priority'; END IF;
  SELECT * INTO a FROM public.appointments WHERE id = _appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = a.tenant_id AND m.is_active) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  v_owner := COALESCE(_assignee, auth.uid());
  IF NOT EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.user_id = v_owner AND m.tenant_id = a.tenant_id AND m.is_active) THEN
    RAISE EXCEPTION 'Person gehört nicht zum Büro';
  END IF;
  INSERT INTO public.tasks(id, user_id, tenant_id, title, description, assigned_to, status, priority, category, due_date,
    ball_owner, ball_assignee_id, next_action, next_action_due, source_type, source_id, timeline)
  VALUES (v_task, auth.uid(), a.tenant_id, btrim(_title), COALESCE(_description, 'Folgeaufgabe aus Termin: ' || a.title),
    v_owner::text, 'todo', _priority, 'personal', _due, 'office', v_owner, btrim(_title), _due,
    'appointment_briefing_followup', a.id::text,
    jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'type','system','at', now(),
      'actorName', COALESCE((SELECT display_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), 'System'),
      'text', 'Folgeaufgabe aus Termin „' || a.title || '“ angelegt')));
  IF _feedback_id IS NOT NULL THEN
    UPDATE public.appointment_feedback SET has_tasks = true, updated_at = now() WHERE id = _feedback_id AND appointment_id = a.id;
  END IF;
  RETURN v_task;
END $$;
REVOKE ALL ON FUNCTION public.create_briefing_follow_up_task(uuid, text, uuid, date, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_briefing_follow_up_task(uuid, text, uuid, date, text, text, uuid) TO authenticated;

-- Close briefing after debrief (approved -> completed).
CREATE OR REPLACE FUNCTION public.complete_appointment_briefing(_appointment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = _appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF a.briefing_status <> 'approved' THEN RAISE EXCEPTION 'Briefing ist nicht freigegeben'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = a.tenant_id AND m.is_active) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  UPDATE public.appointments SET briefing_status = 'completed' WHERE id = a.id;
  IF a.briefing_task_id IS NOT NULL THEN
    UPDATE public.tasks SET status = 'completed', next_action = NULL WHERE id = a.briefing_task_id AND status <> 'completed';
    PERFORM public._briefing_task_event(a.briefing_task_id, 'Termin nachbereitet – Briefing abgeschlossen');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.complete_appointment_briefing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_appointment_briefing(uuid) TO authenticated;