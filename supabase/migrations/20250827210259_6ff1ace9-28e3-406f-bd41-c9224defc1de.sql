-- Add RLS policies for task_decision_participants table
-- Allow participants to view their own participant records
CREATE POLICY "Participants can view their own participation"
ON public.task_decision_participants
FOR SELECT
USING (user_id = auth.uid());

-- Allow decision creators to manage participants
CREATE POLICY "Decision creators can manage participants"
ON public.task_decision_participants
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.task_decisions td
  WHERE td.id = task_decision_participants.decision_id 
  AND td.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.task_decisions td
  WHERE td.id = task_decision_participants.decision_id 
  AND td.created_by = auth.uid()
));

-- Update task_decisions RLS policy to allow participants to view decisions they're involved in
DROP POLICY IF EXISTS "task_decisions_select_clean" ON public.task_decisions;

CREATE POLICY "task_decisions_select_participants"
ON public.task_decisions
FOR SELECT
USING (
  created_by = auth.uid() 
  OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_decisions.task_id AND t.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM task_decision_participants tdp WHERE tdp.decision_id = task_decisions.id AND tdp.user_id = auth.uid())
);