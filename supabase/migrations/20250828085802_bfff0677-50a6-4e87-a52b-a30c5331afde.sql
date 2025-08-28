-- Fix the RLS policy for task_decisions insert
-- The current policy requires created_by = auth.uid() but the insert doesn't await the auth call properly

-- Drop existing problematic policy
DROP POLICY IF EXISTS "task_decisions_insert_clean" ON public.task_decisions;

-- Create new simplified insert policy
CREATE POLICY "task_decisions_insert_policy" 
ON public.task_decisions 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND created_by = auth.uid()
);