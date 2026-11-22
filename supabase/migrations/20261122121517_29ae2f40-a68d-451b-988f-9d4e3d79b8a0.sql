CREATE OR REPLACE FUNCTION public.close_office_feedback_reminder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.feedback_status IN ('completed','skipped') OR NULLIF(btrim(NEW.notes),'') IS NOT NULL THEN
    UPDATE public.tasks SET status = 'completed', next_action = NULL, next_action_due = NULL
    WHERE tenant_id = NEW.tenant_id AND source_type = 'appointment_feedback_reminder'
      AND source_id = NEW.id AND status <> 'completed';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.dispatch_office_feedback_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE feedback record; owner_id uuid; task_id uuid;
BEGIN
  INSERT INTO public.appointment_feedback(appointment_id,user_id,tenant_id,event_type,feedback_status)
  SELECT a.id,a.user_id,a.tenant_id,'appointment',
    CASE WHEN a.category = 'intern' AND EXISTS (
      SELECT 1 FROM public.appointment_feedback_settings s
      WHERE s.user_id = a.user_id AND s.tenant_id = a.tenant_id AND s.auto_skip_internal
    ) THEN 'skipped' ELSE 'pending' END
  FROM public.appointments a
  JOIN public.user_tenant_memberships m ON m.user_id = a.user_id AND m.tenant_id = a.tenant_id
    AND m.is_active AND m.role = 'abgeordneter'
  WHERE a.end_time <= now() AND a.start_time >= ((date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') - interval '7 days') AT TIME ZONE 'Europe/Berlin')
    AND COALESCE(a.status,'') NOT IN ('cancelled','canceled')
    AND NOT EXISTS (SELECT 1 FROM public.appointment_feedback f WHERE f.appointment_id = a.id AND f.user_id = a.user_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.appointment_feedback(external_event_id,user_id,tenant_id,event_type,feedback_status)
  SELECT e.id,c.user_id,c.tenant_id,'external_event','pending' FROM public.external_events e
  JOIN public.external_calendars c ON c.id = e.external_calendar_id
  JOIN public.user_tenant_memberships m ON m.user_id = c.user_id AND m.tenant_id = c.tenant_id
    AND m.is_active AND m.role = 'abgeordneter'
  WHERE e.end_time <= now() AND e.start_time >= now() - interval '7 days'
    AND NOT EXISTS (SELECT 1 FROM public.appointment_feedback f WHERE f.external_event_id = e.id)
  ON CONFLICT DO NOTHING;

  FOR feedback IN
    SELECT f.*, COALESCE(a.title,e.title) AS event_title
    FROM public.appointment_feedback f
    LEFT JOIN public.appointments a ON a.id = f.appointment_id AND a.tenant_id = f.tenant_id
    LEFT JOIN public.external_events e ON e.id = f.external_event_id
    LEFT JOIN public.external_calendars c ON c.id = e.external_calendar_id AND c.tenant_id = f.tenant_id
    WHERE f.feedback_status = 'pending' AND NULLIF(btrim(f.notes),'') IS NULL
      AND EXISTS (SELECT 1 FROM public.user_tenant_memberships m
        WHERE m.user_id = f.user_id AND m.tenant_id = f.tenant_id AND m.is_active AND m.role = 'abgeordneter')
      AND COALESCE(a.end_time, CASE WHEN c.id IS NOT NULL THEN e.end_time END) <= now() - interval '48 hours'
      AND COALESCE(a.start_time,e.start_time) >= now() - interval '7 days'
      AND COALESCE(a.status,'') NOT IN ('cancelled','canceled')
      AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.tenant_id = f.tenant_id
        AND t.source_type = 'appointment_feedback_reminder' AND t.source_id = f.id)
    FOR UPDATE OF f SKIP LOCKED
  LOOP
    SELECT m.user_id INTO owner_id FROM public.user_tenant_memberships m
    WHERE m.tenant_id = feedback.tenant_id AND m.is_active AND m.role IN ('bueroleitung','mitarbeiter')
    ORDER BY (m.role = 'bueroleitung') DESC,m.created_at,m.user_id LIMIT 1;
    IF owner_id IS NULL THEN CONTINUE; END IF;
    task_id := gen_random_uuid();
    INSERT INTO public.tasks(id,user_id,tenant_id,title,description,assigned_to,status,priority,category,
      ball_owner,ball_assignee_id,next_action,source_type,source_id,timeline)
    VALUES(task_id,feedback.user_id,feedback.tenant_id,'Terminrückmeldung einholen: ' || feedback.event_title,
      'Seit zwei Tagen fehlt die Rückmeldung. Bitte beim Abgeordneten nachfragen. '
        || '/mywork?tab=feedbackfeed&highlight=' || feedback.id,
      owner_id::text,'todo','medium','personal','office',owner_id,'Terminrückmeldung einholen',
      'appointment_feedback_reminder',feedback.id,
      jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','system','at',now(),
        'text','Offene Terminrückmeldung nach zwei Tagen ans Büro übergeben.')))
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.dispatch_office_feedback_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_office_feedback_reminders() TO service_role;
REVOKE ALL ON FUNCTION public.close_office_feedback_reminder() FROM PUBLIC,anon,authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.external_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_decisions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_decision_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_decision_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_decision_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_planning_timeline_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_planning_checklist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_plannings;