-- Fix the RLS policies for task_decision_participants
-- The current policies create circular dependencies

-- Drop all existing policies for task_decision_participants
DROP POLICY IF EXISTS "Decision creators can manage participants" ON public.task_decision_participants;
DROP POLICY IF EXISTS "Participants can view their own participation" ON public.task_decision_participants;
DROP POLICY IF EXISTS "task_decision_participants_delete_clean" ON public.task_decision_participants;
DROP POLICY IF EXISTS "task_decision_participants_insert_clean" ON public.task_decision_participants;
DROP POLICY IF EXISTS "task_decision_participants_update_clean" ON public.task_decision_participants;

-- Create new simplified policies that work better with the decision creation flow
CREATE POLICY "task_decision_participants_select" 
ON public.task_decision_participants 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.task_decisions td 
    WHERE td.id = task_decision_participants.decision_id 
    AND td.created_by = auth.uid()
  )
);

CREATE POLICY "task_decision_participants_insert" 
ON public.task_decision_participants 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_decisions td 
    WHERE td.id = task_decision_participants.decision_id 
    AND td.created_by = auth.uid()
  )
);

CREATE POLICY "task_decision_participants_update" 
ON public.task_decision_participants 
FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.task_decisions td 
    WHERE td.id = task_decision_participants.decision_id 
    AND td.created_by = auth.uid()
  )
);

CREATE POLICY "task_decision_participants_delete" 
ON public.task_decision_participants 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.task_decisions td 
    WHERE td.id = task_decision_participants.decision_id 
    AND td.created_by = auth.uid()
  )
);