ALTER TABLE public.appointments
  ADD COLUMN dashboard_focus text CHECK (dashboard_focus IN ('detailed','compact','hint')),
  ADD COLUMN dashboard_contribution text CHECK (char_length(dashboard_contribution) <= 200),
  ADD COLUMN travel_minutes integer CHECK (travel_minutes BETWEEN 1 AND 1440);

-- Use the existing calendar block as the confirmed calendar event. Invoker
-- permissions also apply to linked rows, including the discarded suggestions.
CREATE FUNCTION public.confirm_event_planning_calendar_date(_planning_id uuid, _date_id uuid, _calendar_user uuid DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  planning public.event_plannings;
  chosen public.event_planning_dates;
  calendar_user uuid;
  selected_appointment uuid;
  discarded uuid[];
BEGIN
  SELECT * INTO planning FROM public.event_plannings WHERE id = _planning_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_tenant_member(planning.tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Terminplanung nicht zugänglich';
  END IF;
  IF auth.uid() <> planning.user_id AND NOT EXISTS (
    SELECT 1 FROM public.event_planning_collaborators
    WHERE event_planning_id = _planning_id AND user_id = auth.uid() AND can_edit
  ) THEN RAISE EXCEPTION 'Keine Bearbeitungsberechtigung'; END IF;
  SELECT * INTO chosen FROM public.event_planning_dates
    WHERE id = _date_id AND event_planning_id = _planning_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Terminvorschlag fehlt'; END IF;
  IF _calendar_user IS NOT NULL AND NOT public.has_active_tenant_role(_calendar_user, planning.tenant_id, ARRAY['abgeordneter']) THEN
    RAISE EXCEPTION 'Abgeordnetenkalender nicht verfügbar';
  END IF;

  selected_appointment := chosen.appointment_id;
  IF selected_appointment IS NOT NULL THEN
    UPDATE public.appointments SET title = planning.title, location = coalesce(nullif(btrim(location),''), planning.location),
      category = CASE WHEN category = 'blocked' THEN 'appointment' ELSE category END, status = 'confirmed',
      user_id = coalesce(_calendar_user, user_id)
    WHERE id = selected_appointment AND tenant_id = planning.tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Kalenderblock nicht zugänglich'; END IF;
  ELSE
    calendar_user := coalesce(_calendar_user, planning.user_id);
    INSERT INTO public.appointments(tenant_id,user_id,title,location,start_time,end_time,category,status)
    VALUES (planning.tenant_id,calendar_user,planning.title,planning.location,chosen.date_time,
      chosen.date_time + interval '2 hours','appointment','confirmed') RETURNING id INTO selected_appointment;
  END IF;

  SELECT array_agg(appointment_id) INTO discarded FROM public.event_planning_dates
    WHERE event_planning_id = _planning_id AND id <> _date_id AND appointment_id <> selected_appointment;
  DELETE FROM public.event_planning_dates WHERE event_planning_id = _planning_id AND id <> _date_id;
  DELETE FROM public.appointments WHERE tenant_id = planning.tenant_id AND id = ANY(discarded)
    AND category = 'blocked' AND status = 'planned';
  UPDATE public.event_planning_dates SET is_confirmed = true, appointment_id = selected_appointment WHERE id = _date_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Terminbestätigung konnte nicht gespeichert werden'; END IF;
  UPDATE public.event_plannings SET confirmed_date = chosen.date_time WHERE id = _planning_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Terminplanung konnte nicht gespeichert werden'; END IF;
  RETURN chosen.date_time;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_event_planning_calendar_date(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_event_planning_calendar_date(uuid, uuid, uuid) TO authenticated;
