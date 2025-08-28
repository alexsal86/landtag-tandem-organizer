-- Add only the missing RLS policies for task_decision_participants

-- Check existing policies first and only add what's missing
DROP POLICY IF EXISTS "Users can manage participants for their decisions" ON public.task_decision_participants;
DROP POLICY IF EXISTS "Participants can view their own records" ON public.task_decision_participants;

-- Create comprehensive policies for task_decision_participants
CREATE POLICY "Users can create participants for their decisions" 
ON public.task_decision_participants 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_decisions 
    WHERE id = task_decision_participants.decision_id 
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Users can view participants for accessible decisions" 
ON public.task_decision_participants 
FOR SELECT 
USING (
  user_can_access_task_decision(decision_id, auth.uid())
);

CREATE POLICY "Users can update participants for their decisions" 
ON public.task_decision_participants 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.task_decisions 
    WHERE id = task_decision_participants.decision_id 
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete participants for their decisions" 
ON public.task_decision_participants 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.task_decisions 
    WHERE id = task_decision_participants.decision_id 
    AND created_by = auth.uid()
  )
);