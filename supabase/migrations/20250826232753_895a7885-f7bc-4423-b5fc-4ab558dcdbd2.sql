-- Fix the recursive policy issue in task_decisions table
-- First, check what policies exist and drop them if they're causing recursion

-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Users can view decisions they created or participate in" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can create decisions for their own tasks" ON public.task_decisions;
DROP POLICY IF EXISTS "Users can update decisions they created" ON public.task_decisions;

-- Create simple, non-recursive RLS policies for task_decisions
CREATE POLICY "task_decisions_select_policy" 
ON public.task_decisions 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.task_decision_participants tdp 
    WHERE tdp.decision_id = id AND tdp.user_id = auth.uid()
  )
);

CREATE POLICY "task_decisions_insert_policy" 
ON public.task_decisions 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "task_decisions_update_policy" 
ON public.task_decisions 
FOR UPDATE 
USING (created_by = auth.uid());

-- Also ensure task_decision_participants has proper policies
DROP POLICY IF EXISTS "Users can view participants for decisions they're involved in" ON public.task_decision_participants;
DROP POLICY IF EXISTS "Users can add participants to decisions they created" ON public.task_decision_participants;

CREATE POLICY "task_decision_participants_select_policy" 
ON public.task_decision_participants 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.task_decisions td 
    WHERE td.id = decision_id AND td.created_by = auth.uid()
  )
);

CREATE POLICY "task_decision_participants_insert_policy" 
ON public.task_decision_participants 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_decisions td 
    WHERE td.id = decision_id AND td.created_by = auth.uid()
  )
);