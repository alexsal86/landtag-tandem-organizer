-- Fix RLS policies for task_decisions
-- First drop all existing policies
DROP POLICY IF EXISTS "task_decisions_select_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_update_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_delete_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_insert_policy" ON public.task_decisions;

-- Disable and re-enable RLS to ensure clean state
ALTER TABLE public.task_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy that allows authenticated users to create decisions they own
CREATE POLICY "task_decisions_insert_policy" ON public.task_decisions
  FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = created_by
  );

-- Create SELECT policy using the existing function
CREATE POLICY "task_decisions_select_policy" ON public.task_decisions
  FOR SELECT 
  USING (user_can_access_task_decision(id, auth.uid()));

-- Create UPDATE policy for creators only
CREATE POLICY "task_decisions_update_policy" ON public.task_decisions
  FOR UPDATE 
  USING (created_by = auth.uid()) 
  WITH CHECK (created_by = auth.uid());

-- Create DELETE policy for creators only
CREATE POLICY "task_decisions_delete_policy" ON public.task_decisions
  FOR DELETE 
  USING (created_by = auth.uid());