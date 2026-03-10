CREATE OR REPLACE FUNCTION public.reconcile_employee_meeting_requests(
  p_tenant_id uuid,
  p_meeting_id uuid DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,
  p_explicit_request_id uuid DEFAULT NULL,
  p_source text DEFAULT 'unknown',
  p_time_window_days integer DEFAULT 45
)
RETURNS TABLE(updated_request_id uuid, linked_meeting_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_explicit_request_id IS NOT NULL THEN
    RETURN QUERY
    WITH updated AS (
      UPDATE public.employee_meeting_requests r
      SET
        status = 'completed',
        scheduled_meeting_id = p_meeting_id,
        updated_at = now()
      WHERE r.id = p_explicit_request_id
        AND r.tenant_id = p_tenant_id
        AND (p_employee_id IS NULL OR r.employee_id = p_employee_id)
        AND r.status = 'pending'
        AND r.scheduled_meeting_id IS NULL
      RETURNING r.id, r.scheduled_meeting_id
    )
    SELECT updated.id, updated.scheduled_meeting_id FROM updated;

    RETURN;
  END IF;

  IF p_source NOT IN ('manager_cleanup', 'scheduler_auto') THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH meetings AS (
    SELECT m.id, m.employee_id, m.tenant_id, m.meeting_type, m.meeting_date, m.created_at
    FROM public.employee_meetings m
    WHERE m.tenant_id = p_tenant_id
      AND (p_meeting_id IS NULL OR m.id = p_meeting_id)
      AND (p_employee_id IS NULL OR m.employee_id = p_employee_id)
  ),
  matching AS (
    SELECT
      r.id AS request_id,
      m.id AS meeting_id,
      r.created_at AS request_created_at,
      row_number() OVER (PARTITION BY m.id ORDER BY r.created_at ASC) AS rn
    FROM meetings m
    JOIN public.employee_meeting_requests r
      ON r.employee_id = m.employee_id
     AND r.tenant_id = m.tenant_id
    WHERE r.status = 'pending'
      AND r.scheduled_meeting_id IS NULL
      AND m.created_at >= r.created_at
      AND m.created_at <= r.created_at + make_interval(days => GREATEST(p_time_window_days, 1))
      AND (
        m.meeting_type = 'regular'
        OR (m.meeting_type = 'probation' AND r.reason ILIKE ANY (ARRAY['%probezeit%', '%onboarding%', '%einarbeitung%']))
        OR (m.meeting_type = 'development' AND r.reason ILIKE ANY (ARRAY['%entwicklung%', '%fortbildung%', '%perspektive%']))
        OR (m.meeting_type = 'performance' AND r.reason ILIKE ANY (ARRAY['%leistung%', '%feedback%', '%ziel%']))
        OR (m.meeting_type = 'conflict' AND r.reason ILIKE ANY (ARRAY['%konflikt%', '%klärung%', '%problem%']))
      )
  ),
  target AS (
    SELECT request_id, meeting_id
    FROM matching
    WHERE rn = 1
  ),
  updated AS (
    UPDATE public.employee_meeting_requests r
    SET
      status = 'completed',
      scheduled_meeting_id = t.meeting_id,
      updated_at = now()
    FROM target t
    WHERE r.id = t.request_id
    RETURNING r.id, r.scheduled_meeting_id
  )
  SELECT updated.id, updated.scheduled_meeting_id FROM updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_employee_meeting_requests(uuid, uuid, uuid, uuid, text, integer) TO authenticated;
