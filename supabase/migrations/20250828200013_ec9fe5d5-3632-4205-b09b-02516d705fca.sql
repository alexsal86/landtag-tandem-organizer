-- Fix infinite recursion in event_plannings RLS policy
-- First, drop the problematic policy
DROP POLICY IF EXISTS "Users can view event plannings" ON public.event_plannings;

-- Create a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.can_view_event_planning(_planning_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user is in the same tenant as the planning and has access
  RETURN EXISTS (
    SELECT 1 
    FROM event_plannings ep
    JOIN user_tenant_memberships utm ON utm.tenant_id = ep.tenant_id
    WHERE ep.id = _planning_id
    AND utm.user_id = _user_id 
    AND utm.is_active = true
    AND (
      ep.user_id = _user_id OR 
      NOT ep.is_private OR 
      EXISTS (
        SELECT 1 
        FROM event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = _user_id
      )
    )
  );
END;
$$;

-- Create new policy using the security definer function
CREATE POLICY "Users can view event plannings" 
ON public.event_plannings 
FOR SELECT 
USING (can_view_event_planning(id, auth.uid()));