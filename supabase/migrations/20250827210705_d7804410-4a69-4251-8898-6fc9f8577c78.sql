-- Fix infinite recursion by using security definer functions
-- First, drop the problematic policy
DROP POLICY IF EXISTS "task_decisions_select_participants" ON public.task_decisions;

-- Create security definer functions to check access
CREATE OR REPLACE FUNCTION public.user_can_access_task_decision(_decision_id uuid, _user_id uuid)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user created the decision
  IF EXISTS (
    SELECT 1 FROM public.task_decisions 
    WHERE id = _decision_id AND created_by = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user owns the task
  IF EXISTS (
    SELECT 1 FROM public.task_decisions td
    JOIN public.tasks t ON t.id = td.task_id
    WHERE td.id = _decision_id AND t.user_id = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is a participant
  IF EXISTS (
    SELECT 1 FROM public.task_decision_participants tdp
    WHERE tdp.decision_id = _decision_id AND tdp.user_id = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create the new policy using the security definer function
CREATE POLICY "task_decisions_access_policy"
ON public.task_decisions
FOR SELECT
USING (public.user_can_access_task_decision(id, auth.uid()));