CREATE OR REPLACE FUNCTION public.get_latest_employee_meetings(p_employee_ids uuid[])
RETURNS TABLE (
  employee_id uuid,
  meeting_id uuid,
  meeting_date date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (em.employee_id)
    em.employee_id,
    em.id AS meeting_id,
    em.meeting_date
  FROM public.employee_meetings em
  WHERE em.employee_id = ANY(COALESCE(p_employee_ids, ARRAY[]::uuid[]))
  ORDER BY em.employee_id, em.meeting_date DESC, em.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_latest_employee_meetings(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_latest_time_entry_dates(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  last_work_date date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    te.user_id,
    MAX(te.work_date) AS last_work_date
  FROM public.time_entries te
  WHERE te.user_id = ANY(COALESCE(p_user_ids, ARRAY[]::uuid[]))
  GROUP BY te.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_latest_time_entry_dates(uuid[]) TO authenticated;
