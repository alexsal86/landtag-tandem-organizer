-- Drop all policies for task_decisions and recreate them
DROP POLICY IF EXISTS "simple_task_decisions_insert" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_delete_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_select_policy" ON public.task_decisions;  
DROP POLICY IF EXISTS "task_decisions_update_policy" ON public.task_decisions;

-- Enable RLS on task_decisions
ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;

-- Create very permissive INSERT policy for testing
CREATE POLICY "task_decisions_insert_allow_all" ON public.task_decisions
  FOR INSERT WITH CHECK (true);

-- Create other policies
CREATE POLICY "task_decisions_select_policy" ON public.task_decisions
  FOR SELECT USING (user_can_access_task_decision(id, auth.uid()));

CREATE POLICY "task_decisions_update_policy" ON public.task_decisions
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "task_decisions_delete_policy" ON public.task_decisions
  FOR DELETE USING (created_by = auth.uid());