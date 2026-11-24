-- Dashboard aggregator: only the authenticated person may read their own dashboard,
-- and only for an office they are an active member of. Task figures are tenant-scoped,
-- so an office switch can never mix task counts from another Büro.

CREATE OR REPLACE FUNCTION public.get_dashboard_data(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  v_actor UUID := auth.uid();
  v_display_name TEXT;
  v_role TEXT;
  v_open_tasks_count INT;
  v_completed_today INT;
  v_open_task_titles JSONB;
  v_today TIMESTAMPTZ;
  v_tomorrow TIMESTAMPTZ;
  v_yesterday TIMESTAMPTZ;
  v_day_after_tomorrow TIMESTAMPTZ;
  v_appointments JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Dashboard-Daten sind nur für die eigene Person abrufbar' USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id IS NULL OR NOT public.is_tenant_member(p_tenant_id, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  -- Timestamps
  v_today := date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin';
  v_tomorrow := v_today + INTERVAL '1 day';
  v_yesterday := v_today - INTERVAL '1 day';
  v_day_after_tomorrow := v_today + INTERVAL '2 days';

  -- Profile + Role (2 queries → 1)
  SELECT p.display_name INTO v_display_name
  FROM profiles p WHERE p.user_id = p_user_id;

  SELECT ur.role INTO v_role
  FROM user_roles ur WHERE ur.user_id = p_user_id
  LIMIT 1;

  -- Open tasks count (head: true equivalent)
  SELECT COUNT(*) INTO v_open_tasks_count
  FROM tasks t
  WHERE t.tenant_id = p_tenant_id
    AND (t.assigned_to = p_user_id::text 
         OR t.assigned_to ILIKE '%' || p_user_id::text || '%' 
         OR t.user_id = p_user_id)
    AND t.status != 'completed';

  -- Completed today
  SELECT COUNT(*) INTO v_completed_today
  FROM tasks t
  WHERE t.tenant_id = p_tenant_id
    AND (t.assigned_to = p_user_id::text 
         OR t.assigned_to ILIKE '%' || p_user_id::text || '%' 
         OR t.user_id = p_user_id)
    AND t.status = 'completed'
    AND t.updated_at >= v_today;

  -- Open task titles (top 20 by due_date)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', sub.id, 'title', sub.title)), '[]'::jsonb)
  INTO v_open_task_titles
  FROM (
    SELECT t.id, t.title
    FROM tasks t
    WHERE t.tenant_id = p_tenant_id
      AND (t.assigned_to = p_user_id::text 
           OR t.assigned_to ILIKE '%' || p_user_id::text || '%' 
           OR t.user_id = p_user_id)
      AND t.status != 'completed'
      AND t.title IS NOT NULL AND trim(t.title) != ''
    ORDER BY t.due_date ASC NULLS LAST
    LIMIT 20
  ) sub;

  -- Appointments (today + tomorrow range, both normal and all-day)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'title', a.title, 
    'start_time', a.start_time, 'end_time', a.end_time, 
    'is_all_day', a.is_all_day
  ) ORDER BY a.start_time), '[]'::jsonb)
  INTO v_appointments
  FROM appointments a
  WHERE a.tenant_id = p_tenant_id
    AND a.start_time >= v_yesterday
    AND a.start_time < v_day_after_tomorrow + INTERVAL '1 day';

  -- Build result
  result := jsonb_build_object(
    'display_name', COALESCE(v_display_name, ''),
    'role', COALESCE(v_role, ''),
    'open_tasks_count', v_open_tasks_count,
    'completed_today', v_completed_today,
    'open_task_titles', v_open_task_titles,
    'appointments', v_appointments
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_data(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_data(uuid, uuid) TO authenticated;
