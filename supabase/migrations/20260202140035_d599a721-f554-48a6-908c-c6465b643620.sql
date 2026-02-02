-- Fix: Remove circular dependency between meetings and meeting_participants RLS policies

-- Step 1: Create a SECURITY DEFINER function to check participant status
-- This breaks the recursion because it runs with elevated privileges
CREATE OR REPLACE FUNCTION public.is_meeting_participant(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meeting_participants
    WHERE meeting_id = p_meeting_id
    AND user_id = auth.uid()
  );
$$;

-- Step 2: Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Users can view meetings they own, participate in, or are public" ON public.meetings;

-- Step 3: Create a non-recursive policy using the SECURITY DEFINER function
CREATE POLICY "Users can view accessible meetings"
ON public.meetings FOR SELECT
USING (
  user_id = auth.uid()
  OR is_public = true
  OR public.is_meeting_participant(id)
  OR tenant_id = ANY (get_user_tenant_ids(auth.uid()))
);