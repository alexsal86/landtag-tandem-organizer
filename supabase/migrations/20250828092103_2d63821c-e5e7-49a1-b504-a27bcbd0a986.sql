-- Fix the INSERT policy to properly check authentication
DROP POLICY IF EXISTS "Allow authenticated users to create task decisions" ON public.task_decisions;

-- Create a policy that ensures created_by matches the authenticated user
CREATE POLICY "Allow authenticated users to create task decisions" 
ON public.task_decisions 
FOR INSERT 
WITH CHECK (created_by = auth.uid());