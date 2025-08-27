-- Allow decision creators to update creator_response field
DROP POLICY IF EXISTS "Participants can update their responses" ON public.task_decision_responses;

CREATE POLICY "Participants and creators can update responses" 
ON public.task_decision_responses 
FOR UPDATE 
USING (
  -- Allow participants to update their own responses
  (EXISTS (
    SELECT 1 FROM task_decision_participants tdp
    WHERE tdp.id = task_decision_responses.participant_id 
    AND tdp.user_id = auth.uid()
  )) 
  OR 
  -- Allow decision creators to update creator_response field
  (EXISTS (
    SELECT 1 FROM task_decisions td
    JOIN task_decision_participants tdp ON tdp.decision_id = td.id
    WHERE tdp.id = task_decision_responses.participant_id 
    AND td.created_by = auth.uid()
  ))
);