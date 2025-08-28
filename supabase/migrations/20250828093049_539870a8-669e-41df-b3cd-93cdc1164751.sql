-- Fix critical RLS issues for task decisions functionality

-- Ensure all task decision related tables have proper RLS policies
-- First, make sure task_decision_participants table has proper policies

-- Drop existing policies to recreate them properly
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

-- Ensure notification policies are in place
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications" 
ON public.notifications 
FOR DELETE 
USING (user_id = auth.uid());