-- Fix the infinite recursion in task_decisions RLS policies
-- The issue is likely that policies reference each other creating a loop

-- Drop all policies and recreate them with security definer functions
DROP POLICY IF EXISTS "Users can view task decisions they created or participate in" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can insert their own task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can update their own task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can delete their own task decisions" ON public.task_decisions;

-- Create a security definer function to check access
CREATE OR REPLACE FUNCTION public.user_can_access_task_decision(_decision_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user created the decision
  IF EXISTS (
    SELECT 1 FROM public.task_decisions 
    WHERE id = _decision_id AND created_by = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is a participant
  IF EXISTS (
    SELECT 1 FROM public.task_decision_participants 
    WHERE decision_id = _decision_id AND user_id = _user_id
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
  
  RETURN FALSE;
END;
$$;

-- Create new policies using the security definer function
CREATE POLICY "Users can view accessible task decisions" 
ON public.task_decisions 
FOR SELECT 
USING (user_can_access_task_decision(id, auth.uid()));

CREATE POLICY "Users can insert their own task decisions" 
ON public.task_decisions 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own task decisions" 
ON public.task_decisions 
FOR UPDATE 
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own task decisions" 
ON public.task_decisions 
FOR DELETE 
USING (created_by = auth.uid());