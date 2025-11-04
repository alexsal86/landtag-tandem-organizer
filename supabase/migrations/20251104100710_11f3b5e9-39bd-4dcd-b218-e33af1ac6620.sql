-- Drop existing policy for task_decision_responses
DROP POLICY IF EXISTS "Users can view responses for accessible decisions" ON task_decision_responses;

-- Create new policy with extended visibility for public decisions
CREATE POLICY "Users can view responses for accessible decisions"
ON task_decision_responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM task_decisions td
    WHERE td.id = task_decision_responses.decision_id 
    AND (
      -- Decision creator can see all responses
      td.created_by = auth.uid()
      -- Participants can see all responses
      OR EXISTS (
        SELECT 1 
        FROM task_decision_participants tdp
        WHERE tdp.decision_id = td.id 
        AND tdp.user_id = auth.uid()
      )
      -- If decision is visible_to_all, all active tenant members can see responses
      OR (
        td.visible_to_all = true 
        AND EXISTS (
          SELECT 1 
          FROM user_tenant_memberships utm
          WHERE utm.user_id = auth.uid()
          AND utm.tenant_id = td.tenant_id
          AND utm.is_active = true
        )
      )
    )
  )
);