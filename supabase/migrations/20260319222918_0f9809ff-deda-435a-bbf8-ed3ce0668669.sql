
CREATE OR REPLACE FUNCTION public.get_unread_notification_counts(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_object_agg(navigation_context, cnt),
    '{}'::json
  )
  FROM (
    SELECT navigation_context, COUNT(*) AS cnt
    FROM notifications
    WHERE user_id = p_user_id
      AND is_read = false
      AND navigation_context IS NOT NULL
    GROUP BY navigation_context
  ) sub;
$$;
