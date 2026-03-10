CREATE OR REPLACE FUNCTION public.get_user_polls_with_aggregation()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  deadline timestamptz,
  status text,
  created_at timestamptz,
  participant_count bigint,
  response_count bigint,
  time_slots_count bigint,
  creator_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ap.id,
    ap.title,
    ap.description,
    ap.deadline,
    ap.status,
    ap.created_at,
    COALESCE(pp.participant_count, 0) AS participant_count,
    COALESCE(pr.response_count, 0) AS response_count,
    COALESCE(ts.time_slots_count, 0) AS time_slots_count,
    COALESCE(p.display_name, 'Unbekannt') AS creator_name
  FROM public.appointment_polls ap
  LEFT JOIN (
    SELECT poll_id, COUNT(*) AS participant_count
    FROM public.poll_participants
    GROUP BY poll_id
  ) pp ON pp.poll_id = ap.id
  LEFT JOIN (
    SELECT poll_id, COUNT(DISTINCT participant_id) AS response_count
    FROM public.poll_responses
    GROUP BY poll_id
  ) pr ON pr.poll_id = ap.id
  LEFT JOIN (
    SELECT poll_id, COUNT(*) AS time_slots_count
    FROM public.poll_time_slots
    GROUP BY poll_id
  ) ts ON ts.poll_id = ap.id
  LEFT JOIN public.profiles p ON p.user_id = ap.user_id
  WHERE ap.user_id = auth.uid()
  ORDER BY ap.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_polls_with_aggregation() TO authenticated;
