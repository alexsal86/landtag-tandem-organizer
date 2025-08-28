-- Remove the wrongly named policy and create correct one
DROP POLICY IF EXISTS "Allow authenticated users to create decisions" ON public.task_decisions;

-- Create simple INSERT policy 
CREATE POLICY "Users can create task decisions" 
ON public.task_decisions 
FOR INSERT 
TO authenticated
WITH CHECK (created_by = auth.uid());