-- Allow users to create decision requests for any task, not just their own
DROP POLICY IF EXISTS "Users can insert their own task decisions" ON public.task_decisions;

CREATE POLICY "Users can create task decisions for any task" 
ON public.task_decisions 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);