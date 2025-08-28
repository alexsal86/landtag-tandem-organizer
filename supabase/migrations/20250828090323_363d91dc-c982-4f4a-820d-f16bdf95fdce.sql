-- Completely rebuild the RLS policies for task_decisions and task_decision_participants
-- to ensure they work correctly together

-- First, let's disable RLS temporarily to check if there are any structural issues
ALTER TABLE public.task_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_decision_participants DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "task_decisions_access_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_delete_clean" ON public.task_decisions;  
DROP POLICY IF EXISTS "task_decisions_insert_policy" ON public.task_decisions;
DROP POLICY IF EXISTS "task_decisions_update_clean" ON public.task_decisions;

DROP POLICY IF EXISTS "task_decision_participants_select" ON public.task_decision_participants;
DROP POLICY IF EXISTS "task_decision_participants_insert" ON public.task_decision_participants;
DROP POLICY IF EXISTS "task_decision_participants_update" ON public.task_decision_participants;
DROP POLICY IF EXISTS "task_decision_participants_delete" ON public.task_decision_participants;

-- Re-enable RLS
ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_decision_participants ENABLE ROW LEVEL SECURITY;

-- Create simple, working policies for task_decisions
CREATE POLICY "Users can manage their own task decisions" 
ON public.task_decisions 
FOR ALL 
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Create simple, working policies for task_decision_participants  
CREATE POLICY "Users can manage participants for their decisions" 
ON public.task_decision_participants 
FOR ALL 
USING (
  decision_id IN (
    SELECT id FROM public.task_decisions 
    WHERE created_by = auth.uid()
  )
)
WITH CHECK (
  decision_id IN (
    SELECT id FROM public.task_decisions 
    WHERE created_by = auth.uid()
  )
);

-- Allow participants to view their own participation
CREATE POLICY "Users can view their own participation" 
ON public.task_decision_participants 
FOR SELECT 
USING (user_id = auth.uid());