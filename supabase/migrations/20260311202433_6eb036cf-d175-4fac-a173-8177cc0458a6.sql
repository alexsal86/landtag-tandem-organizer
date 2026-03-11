
-- Fix security definer view by dropping and recreating as regular view with RLS-safe function
DROP VIEW IF EXISTS public.active_deputyships;

-- Instead use a security definer function to get active deputyships
CREATE OR REPLACE FUNCTION public.get_active_deputyships_for_user(_user_id uuid)
RETURNS TABLE(
  absent_user_id uuid,
  leave_type text,
  start_date date,
  end_date date,
  leave_request_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lr.user_id AS absent_user_id,
    lr.type::text AS leave_type,
    lr.start_date,
    lr.end_date,
    lr.id AS leave_request_id
  FROM public.leave_requests lr
  WHERE lr.deputy_user_id = _user_id
    AND lr.status = 'approved'
    AND lr.start_date <= CURRENT_DATE
    AND lr.end_date >= CURRENT_DATE
$$;
