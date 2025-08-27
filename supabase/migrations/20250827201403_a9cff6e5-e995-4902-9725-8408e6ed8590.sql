-- Update RLS policy for task_decision_participants to allow task creators to see all participants
DROP POLICY IF EXISTS "Users can view their own participant entries" ON task_decision_participants;

CREATE POLICY "Users can view their participation and creators can view all participants"
ON task_decision_participants FOR SELECT
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM task_decisions td 
    WHERE td.id = task_decision_participants.decision_id 
    AND td.created_by = auth.uid()
  )
);