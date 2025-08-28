-- Drop the existing INSERT policy and create a simpler one
DROP POLICY IF EXISTS "task_decisions_insert_policy" ON public.task_decisions;

-- Create a very simple INSERT policy that only checks authentication
CREATE POLICY "simple_task_decisions_insert" ON public.task_decisions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = created_by);

-- Also check if RLS is properly enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'task_decisions';