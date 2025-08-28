-- Drop all existing policies first
DROP POLICY IF EXISTS "task_decisions_select_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_update_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_delete_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_insert_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_insert_allow_all" ON public.task_decisions;

-- Re-enable RLS
ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;

-- Create proper INSERT policy for authenticated users
CREATE POLICY "task_decisions_insert_policy" ON public.task_decisions
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    auth.uid() = created_by
  );

-- Create SELECT policy using the existing function
CREATE POLICY "task_decisions_select_policy" ON public.task_decisions
  FOR SELECT USING (user_can_access_task_decision(id, auth.uid()));

-- Create UPDATE policy for creators
CREATE POLICY "task_decisions_update_policy" ON public.task_decisions
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- Create DELETE policy for creators
CREATE POLICY "task_decisions_delete_policy" ON public.task_decisions
  FOR DELETE USING (created_by = auth.uid());