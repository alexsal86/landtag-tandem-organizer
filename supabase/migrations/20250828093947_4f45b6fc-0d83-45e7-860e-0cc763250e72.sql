-- Let's check what policies currently exist and fix the RLS properly
-- First check what policies exist for task_decisions
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'task_decisions';

-- Drop only the INSERT policy that's causing problems
DROP POLICY IF EXISTS "Users can create task decisions" ON public.task_decisions;

-- Create a simple INSERT policy with clear auth check
CREATE POLICY "Users can create task decisions" 
ON public.task_decisions 
FOR INSERT 
TO authenticated
WITH CHECK (created_by = auth.uid());