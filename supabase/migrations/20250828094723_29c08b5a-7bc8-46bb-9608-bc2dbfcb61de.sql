-- First enable RLS on task_decisions
ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "authenticated_users_can_insert_task_decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can create their own task decisions" ON public.task_decisions;
DROP POLICY IF EXISTS "Allow authenticated users to insert task decisions" ON public.task_decisions;

-- Create complete set of RLS policies for task_decisions
CREATE POLICY "Users can create their own task decisions" ON public.task_decisions
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view accessible task decisions" ON public.task_decisions
  FOR SELECT USING (user_can_access_task_decision(id, auth.uid()));

CREATE POLICY "Users can update their own task decisions" ON public.task_decisions
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own task decisions" ON public.task_decisions
  FOR DELETE USING (created_by = auth.uid());