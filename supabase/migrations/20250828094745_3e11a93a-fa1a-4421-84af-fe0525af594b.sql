-- First, drop ALL existing policies on task_decisions
DROP POLICY IF EXISTS "authenticated_users_can_insert_task_decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can create their own task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can view accessible task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can update their own task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can delete their own task decisions" ON public.task_decisions;

-- Create a complete, clean set of RLS policies
CREATE POLICY "task_decisions_insert_policy" ON public.task_decisions
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "task_decisions_select_policy" ON public.task_decisions
  FOR SELECT USING (user_can_access_task_decision(id, auth.uid()));

CREATE POLICY "task_decisions_update_policy" ON public.task_decisions
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "task_decisions_delete_policy" ON public.task_decisions
  FOR DELETE USING (created_by = auth.uid());