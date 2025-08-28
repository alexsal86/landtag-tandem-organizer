-- Fix the RLS policy for creating task decisions
-- The issue is that auth.role() = 'authenticated' is not the correct way to check authentication
DROP POLICY IF EXISTS "Users can create task decisions for any task" ON public.task_decisions;

CREATE POLICY "Users can create task decisions for any task" 
ON public.task_decisions 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);