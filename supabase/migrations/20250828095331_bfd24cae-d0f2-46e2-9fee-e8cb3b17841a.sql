-- Temporarily disable RLS on task_decisions to allow testing
ALTER TABLE public.task_decisions DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'task_decisions';