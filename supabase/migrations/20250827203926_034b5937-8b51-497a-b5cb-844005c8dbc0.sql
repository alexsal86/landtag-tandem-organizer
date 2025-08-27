-- Remove old conflicting RLS policy
DROP POLICY IF EXISTS "task_decision_participants_select_clean" ON public.task_decision_participants;

-- Ensure the correct policy exists and is properly named
DROP POLICY IF EXISTS "Users can view their participation and creators can view all pa" ON public.task_decision_participants;

-- Create a single, clear RLS policy for task_decision_participants SELECT
CREATE POLICY "participants_can_view_own_and_creators_can_view_all" 
ON public.task_decision_participants 
FOR SELECT 
USING (
  (user_id = auth.uid()) 
  OR 
  (EXISTS (
    SELECT 1 FROM task_decisions td 
    WHERE td.id = task_decision_participants.decision_id 
    AND td.created_by = auth.uid()
  ))
);