CREATE OR REPLACE FUNCTION public.update_office_debrief(
  _tenant uuid, _action text, _id uuid, _text text DEFAULT NULL, _source text DEFAULT NULL,
  _promise text DEFAULT NULL, _due date DEFAULT NULL, _seconds integer DEFAULT NULL, _external boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); owner_id uuid; event_end timestamptz; feedback public.appointment_feedback;
  event_title text;
  task_source public.tasks.source_id%TYPE;
  internal_event boolean := false;
  body text := nullif(btrim(_text),''); commitment text := nullif(btrim(_promise),'');
  employee boolean := coalesce(public.has_active_tenant_role(auth.uid(), _tenant, ARRAY['mitarbeiter','bueroleitung','praktikant']), false);
  deputy boolean := coalesce(public.has_active_tenant_role(auth.uid(), _tenant, ARRAY['abgeordneter']), false);
BEGIN
  IF NOT (employee OR deputy) THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  IF length(body) > 12000 OR length(commitment) > 1000 OR _seconds NOT BETWEEN 1 AND 86400
    THEN RAISE EXCEPTION 'Ungültige Rückmeldung'; END IF;

  IF _action IN ('submit','proxy','skip') THEN
    IF _external THEN
      SELECT c.user_id,e.end_time INTO owner_id,event_end FROM public.external_events e
        JOIN public.external_calendars c ON c.id = e.external_calendar_id
        WHERE e.id = _id AND c.tenant_id = _tenant FOR UPDATE OF e;
    ELSIF NOT _external THEN
      SELECT a.user_id,a.end_time,a.category IS NOT DISTINCT FROM 'intern' INTO owner_id,event_end,internal_event FROM public.appointments a
        WHERE a.id = _id AND a.tenant_id = _tenant FOR UPDATE;
    END IF;
    IF owner_id IS NULL OR event_end IS NULL OR event_end > now()
      OR NOT coalesce(public.has_active_tenant_role(owner_id,_tenant,ARRAY['abgeordneter']),false)
      OR (_action = 'submit' AND actor <> owner_id)
      OR (_action = 'proxy' AND NOT employee)
      OR (_action = 'skip' AND actor <> owner_id AND NOT employee)
      OR (actor <> owner_id AND (internal_event OR (event_end AT TIME ZONE 'Europe/Berlin')::date
        > (now() AT TIME ZONE 'Europe/Berlin')::date - 2))
      THEN RAISE EXCEPTION 'Termin nicht zugänglich' USING ERRCODE = '42501'; END IF;
    IF (_action <> 'skip' AND body IS NULL)
      OR (_action = 'proxy' AND coalesce(_source,'') NOT IN ('phone','present','message','documents'))
      THEN RAISE EXCEPTION 'Bitte Quelle und Rückmeldung angeben'; END IF;

    SELECT f.* INTO feedback FROM public.appointment_feedback f WHERE f.tenant_id = _tenant AND f.user_id = owner_id
      AND CASE WHEN _external THEN f.external_event_id = _id ELSE f.appointment_id = _id END
      ORDER BY (f.feedback_status = 'pending' AND nullif(btrim(f.notes),'') IS NULL), f.created_at DESC, f.id LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      IF feedback.feedback_status <> 'pending' OR nullif(btrim(feedback.notes),'') IS NOT NULL
        THEN RAISE EXCEPTION 'Für diesen Termin liegt schon eine Rückmeldung vor'; END IF;
      UPDATE public.appointment_feedback SET notes = body, completed_at = now(),
        feedback_status = CASE WHEN _action = 'skip' THEN 'skipped' ELSE 'completed' END WHERE id = feedback.id;
    ELSE
      INSERT INTO public.appointment_feedback(tenant_id,user_id,appointment_id,external_event_id,event_type,feedback_status,notes,completed_at)
      VALUES (_tenant,owner_id,CASE WHEN NOT _external THEN _id END,CASE WHEN _external THEN _id END,
        CASE WHEN _external THEN 'external_event' ELSE 'appointment' END,
        CASE WHEN _action = 'skip' THEN 'skipped' ELSE 'completed' END,body,now())
      RETURNING id INTO feedback.id;
    END IF;
    IF _action <> 'skip' THEN
      INSERT INTO public.office_debrief_state(feedback_id,entered_by,source,promise,spoken_seconds)
      VALUES (feedback.id, actor, CASE WHEN _action = 'proxy' THEN _source END, commitment,
        CASE WHEN _action = 'submit' THEN _seconds END);
    END IF;
    RETURN;
  END IF;

  SELECT f.* INTO feedback FROM public.appointment_feedback f WHERE f.id = _id AND f.tenant_id = _tenant
    AND f.feedback_status = 'completed' AND nullif(btrim(f.notes),'') IS NOT NULL FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(public.has_active_tenant_role(feedback.user_id,_tenant,ARRAY['abgeordneter']),false)
    OR (NOT employee AND feedback.user_id <> actor)
    THEN RAISE EXCEPTION 'Rückmeldung nicht zugänglich' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = feedback.appointment_id AND a.tenant_id = _tenant AND a.user_id = feedback.user_id)
    AND NOT EXISTS (SELECT 1 FROM public.external_events e JOIN public.external_calendars c ON c.id = e.external_calendar_id
      WHERE e.id = feedback.external_event_id AND c.tenant_id = _tenant AND c.user_id = feedback.user_id)
    THEN RAISE EXCEPTION 'Termin nicht zugänglich' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.office_debrief_state(feedback_id) VALUES (_id) ON CONFLICT DO NOTHING;

  IF employee AND _action = 'done' THEN
    UPDATE public.office_debrief_state SET handled_at = now() WHERE feedback_id = _id AND handled_at IS NULL;
  ELSIF employee AND _action = 'edit_promise' THEN
    UPDATE public.office_debrief_state SET promise = commitment,
      due_on = CASE WHEN commitment IS NOT NULL THEN _due END
      WHERE feedback_id = _id AND handled_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Die Nachbereitung wurde bereits erledigt'; END IF;
  ELSIF employee AND _action = 'due' AND _due IS NOT NULL THEN
    UPDATE public.office_debrief_state SET due_on = _due WHERE feedback_id = _id AND promise IS NOT NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Es gibt keine offene Zusage mehr'; END IF;
  ELSIF employee AND _action = 'task' AND body IS NOT NULL THEN
    IF feedback.appointment_id IS NOT NULL THEN
      PERFORM public.create_briefing_follow_up_task(feedback.appointment_id, left(body,120), actor, NULL, body, 'medium', feedback.id);
    ELSE
      SELECT e.title INTO event_title FROM public.external_events e JOIN public.external_calendars c ON c.id = e.external_calendar_id
        WHERE e.id = feedback.external_event_id AND c.tenant_id = _tenant AND c.user_id = feedback.user_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Termin nicht zugänglich' USING ERRCODE = '42501'; END IF;
      task_source := feedback.id;
      INSERT INTO public.tasks (user_id, tenant_id, title, description, assigned_to, status, priority, category,
        ball_owner, ball_assignee_id, next_action, source_type, source_id, timeline)
      VALUES (actor, _tenant, left(body,120), body, actor::text, 'todo', 'medium', 'personal',
        'office', actor, left(body,120), 'appointment_feedback', task_source,
        jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'type','system','at',now(),
          'actorName','System','text','Folgeaufgabe aus Termin „' || event_title || '“ angelegt')));
      UPDATE public.appointment_feedback SET has_tasks = true WHERE id = _id;
    END IF;
  ELSIF employee AND _action = 'question' AND body IS NOT NULL THEN
    UPDATE public.office_debrief_state SET question = body, handled_at = NULL WHERE feedback_id = _id AND question IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Es gibt bereits eine offene Rückfrage'; END IF;
    PERFORM public.create_notification(user_id_param => feedback.user_id, type_name => 'appointment_feedback',
      title_param => 'Rückfrage zur Termin-Nachbereitung', message_param => 'Im Dashboard wartet eine Rückfrage aus dem Büro.',
      data_param => jsonb_build_object('feedback_id',_id,'office_debrief_question',true), priority_param => 'medium', tenant_id_param => _tenant);
  ELSIF deputy AND _action = 'confirm' THEN
    UPDATE public.office_debrief_state SET confirmed_at = now()
    WHERE feedback_id = _id AND source IS NOT NULL AND confirmed_at IS NULL;
  ELSIF deputy AND _action IN ('correct','answer') AND body IS NOT NULL THEN
    IF _action = 'answer' THEN
      UPDATE public.office_debrief_state SET question = NULL, handled_at = NULL WHERE feedback_id = _id AND question IS NOT NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Die Rückfrage wurde bereits beantwortet'; END IF;
      UPDATE public.appointment_feedback SET notes = notes || E'\n\nAntwort auf Rückfrage: ' || body WHERE id = _id;
    ELSE
      UPDATE public.office_debrief_state SET confirmed_at = now(), handled_at = NULL, promise = commitment,
        due_on = CASE WHEN promise IS NOT DISTINCT FROM commitment THEN due_on END
        WHERE feedback_id = _id AND source IS NOT NULL AND confirmed_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Die Rückmeldung wurde bereits bestätigt'; END IF;
      UPDATE public.appointment_feedback SET notes = body WHERE id = _id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Aktion nicht verfügbar' USING ERRCODE = '42501';
  END IF;
END;
$$;
