ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS briefing_status text NOT NULL DEFAULT 'undecided',
  ADD COLUMN IF NOT EXISTS briefing_assignee_id uuid,
  ADD COLUMN IF NOT EXISTS briefing_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS briefing_instructions text,
  ADD COLUMN IF NOT EXISTS briefing_task_id uuid;

CREATE OR REPLACE FUNCTION public.validate_appointment_briefing_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.briefing_status NOT IN ('undecided','none','assigned','in_review','approved') THEN
    RAISE EXCEPTION 'invalid briefing_status %', NEW.briefing_status;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_appointment_briefing_status ON public.appointments;
CREATE TRIGGER trg_validate_appointment_briefing_status BEFORE INSERT OR UPDATE OF briefing_status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_briefing_status();

CREATE OR REPLACE FUNCTION public._briefing_task_event(_task uuid, _text text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.tasks SET timeline = COALESCE(timeline,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text, 'type','system', 'at', now(),
    'actorName', COALESCE((SELECT display_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), 'System'),
    'text', _text)), updated_at = now()
  WHERE id = _task;
$$;
REVOKE ALL ON FUNCTION public._briefing_task_event(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_appointment_briefing(_appointment_id uuid, _decision text, _assignee uuid DEFAULT NULL, _due timestamptz DEFAULT NULL, _instructions text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_task uuid;
BEGIN
  IF _decision NOT IN ('none','assigned') THEN RAISE EXCEPTION 'invalid decision'; END IF;
  SELECT * INTO a FROM public.appointments WHERE id = _appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT public.has_active_tenant_role(auth.uid(), a.tenant_id, ARRAY['abgeordneter','bueroleitung']) THEN
    RAISE EXCEPTION 'Nur Abgeordnete oder Büroleitung dürfen Briefings vergeben';
  END IF;
  IF _decision = 'none' THEN
    IF a.briefing_task_id IS NOT NULL THEN
      UPDATE public.tasks SET status = 'completed', updated_at = now() WHERE id = a.briefing_task_id AND status <> 'completed';
      PERFORM public._briefing_task_event(a.briefing_task_id, 'Briefing nicht mehr nötig – Aufgabe geschlossen');
    END IF;
    UPDATE public.appointments SET briefing_status = 'none', briefing_assignee_id = NULL, briefing_due_at = NULL, briefing_task_id = NULL WHERE id = a.id;
    RETURN NULL;
  END IF;
  IF _assignee IS NULL THEN RAISE EXCEPTION 'Bitte eine Person wählen'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.user_id = _assignee AND m.tenant_id = a.tenant_id AND m.is_active) THEN
    RAISE EXCEPTION 'Person gehört nicht zum Büro';
  END IF;
  IF a.briefing_task_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tasks WHERE id = a.briefing_task_id AND status <> 'completed') THEN
    v_task := a.briefing_task_id;
    UPDATE public.tasks SET assigned_to = _assignee::text, ball_owner = 'office', ball_assignee_id = _assignee,
      due_date = _due, next_action = 'Briefing erstellen', next_action_due = _due::date,
      description = COALESCE(_instructions, description) WHERE id = v_task;
    PERFORM public._briefing_task_event(v_task, 'Briefing neu vergeben');
  ELSE
    v_task := gen_random_uuid();
    INSERT INTO public.tasks(id, user_id, tenant_id, title, description, assigned_to, status, priority, category, due_date,
      ball_owner, ball_assignee_id, next_action, next_action_due, source_type, source_id, timeline)
    VALUES (v_task, auth.uid(), a.tenant_id, 'Briefing: ' || a.title, _instructions, _assignee::text, 'todo', 'medium', 'personal', _due,
      'office', _assignee, 'Briefing erstellen', _due::date, 'appointment_briefing', a.id::text,
      jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'type','system','at', now(), 'text', 'Briefing beauftragt')));
  END IF;
  UPDATE public.appointments SET briefing_status = 'assigned', briefing_assignee_id = _assignee, briefing_due_at = _due,
    briefing_instructions = _instructions, briefing_task_id = v_task WHERE id = a.id;
  RETURN v_task;
END $$;
REVOKE ALL ON FUNCTION public.set_appointment_briefing(uuid, text, uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_appointment_briefing(uuid, text, uuid, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_appointment_briefing(_appointment_id uuid, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; is_decider boolean;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = _appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  is_decider := public.has_active_tenant_role(auth.uid(), a.tenant_id, ARRAY['abgeordneter','bueroleitung']);
  IF _action = 'submit' THEN
    IF a.briefing_status <> 'assigned' THEN RAISE EXCEPTION 'Briefing ist nicht in Zuarbeit'; END IF;
    IF NOT (is_decider OR a.briefing_assignee_id = auth.uid()) THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
    UPDATE public.appointments SET briefing_status = 'in_review' WHERE id = a.id;
    UPDATE public.tasks SET ball_owner = 'deputy', ball_assignee_id = NULL, next_action = 'Briefing freigeben' WHERE id = a.briefing_task_id;
    PERFORM public._briefing_task_event(a.briefing_task_id, 'Briefing zur Freigabe vorgelegt – Ball bei Abgeordnete/r');
  ELSIF _action = 'approve' THEN
    IF a.briefing_status <> 'in_review' THEN RAISE EXCEPTION 'Briefing liegt nicht zur Freigabe vor'; END IF;
    IF NOT is_decider THEN RAISE EXCEPTION 'Nur Abgeordnete oder Büroleitung dürfen freigeben'; END IF;
    UPDATE public.appointments SET briefing_status = 'approved' WHERE id = a.id;
    UPDATE public.tasks SET status = 'completed', next_action = NULL WHERE id = a.briefing_task_id;
    PERFORM public._briefing_task_event(a.briefing_task_id, 'Briefing freigegeben – Aufgabe erledigt');
  ELSIF _action = 'return' THEN
    IF a.briefing_status <> 'in_review' THEN RAISE EXCEPTION 'Briefing liegt nicht zur Freigabe vor'; END IF;
    IF NOT is_decider THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
    UPDATE public.appointments SET briefing_status = 'assigned' WHERE id = a.id;
    UPDATE public.tasks SET ball_owner = 'office', ball_assignee_id = a.briefing_assignee_id, next_action = 'Briefing überarbeiten' WHERE id = a.briefing_task_id;
    PERFORM public._briefing_task_event(a.briefing_task_id, 'Briefing mit Anmerkung zurück an Zuarbeit');
  ELSE
    RAISE EXCEPTION 'invalid action';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.advance_appointment_briefing(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_appointment_briefing(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.decide_appointment_request(uuid, text);
CREATE OR REPLACE FUNCTION public.decide_appointment_request(_request_id uuid, _decision text,
  _briefing text DEFAULT NULL, _briefing_assignee uuid DEFAULT NULL, _briefing_due timestamptz DEFAULT NULL, _briefing_instructions text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.appointment_requests; v_start timestamptz; v_appt uuid;
BEGIN
  IF _decision NOT IN ('accepted','declined') THEN RAISE EXCEPTION 'invalid decision'; END IF;
  SELECT * INTO r FROM public.appointment_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF r.status <> 'open' THEN RAISE EXCEPTION 'Anfrage wurde bereits entschieden'; END IF;
  IF NOT public.has_active_tenant_role(auth.uid(), r.tenant_id, ARRAY['abgeordneter','bueroleitung']) THEN
    RAISE EXCEPTION 'Nur Abgeordnete oder Büroleitung dürfen entscheiden';
  END IF;
  PERFORM set_config('app.request_decision', 'on', true);
  IF _decision = 'accepted' THEN
    v_start := ((r.requested_date + COALESCE(r.requested_time, time '09:00')) AT TIME ZONE 'Europe/Berlin');
    INSERT INTO public.appointments(user_id, tenant_id, title, description, start_time, end_time, location, is_all_day, status)
    VALUES (auth.uid(), r.tenant_id, r.title,
      concat_ws(E'\n', CASE WHEN r.requester IS NOT NULL THEN 'Anfrage von: ' || r.requester END, r.notes),
      v_start, v_start + make_interval(mins => r.duration_minutes), r.location, r.requested_time IS NULL, 'planned')
    RETURNING id INTO v_appt;
  END IF;
  UPDATE public.appointment_requests SET status = _decision, decided_by = auth.uid(), decided_at = now(), appointment_id = v_appt
  WHERE id = _request_id;
  PERFORM set_config('app.request_decision', 'off', true);
  IF v_appt IS NOT NULL AND _briefing IN ('none','assigned') THEN
    PERFORM public.set_appointment_briefing(v_appt, _briefing, _briefing_assignee, _briefing_due, _briefing_instructions);
  END IF;
  RETURN v_appt;
END $$;
REVOKE ALL ON FUNCTION public.decide_appointment_request(uuid, text, text, uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_appointment_request(uuid, text, text, uuid, timestamptz, text) TO authenticated;