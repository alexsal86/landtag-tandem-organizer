-- Clean up duplicate INSERT policies for task_decisions
DROP POLICY IF EXISTS "Allow authenticated users to create decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can create task decisions" ON public.task_decisions;

-- Create single correct INSERT policy
CREATE POLICY "Users can create task decisions" 
ON public.task_decisions 
FOR INSERT 
TO authenticated
WITH CHECK (created_by = auth.uid());