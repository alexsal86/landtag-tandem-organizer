-- Add visible_to_all column to task_decisions
ALTER TABLE public.task_decisions 
ADD COLUMN visible_to_all boolean NOT NULL DEFAULT false;

-- Update RLS policy to allow viewing public decisions
DROP POLICY IF EXISTS "Users can view decisions they're involved in" ON public.task_decisions;

CREATE POLICY "Users can view decisions they're involved in"
ON public.task_decisions
FOR SELECT
TO authenticated
USING (
  -- Creator can always view
  created_by = auth.uid()
  OR
  -- Visible to all decisions can be viewed by anyone
  visible_to_all = true
  OR
  -- Participant can view
  EXISTS (
    SELECT 1 FROM public.task_decision_participants
    WHERE decision_id = task_decisions.id
    AND user_id = auth.uid()
  )
  OR
  -- Task owner can view
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE id = task_decisions.task_id
    AND (user_id = auth.uid() OR assigned_to::text LIKE '%' || auth.uid()::text || '%')
  )
);

-- Add policy for updating decisions (only creator)
DROP POLICY IF EXISTS "Users can update their own decisions" ON public.task_decisions;

CREATE POLICY "Users can update their own decisions"
ON public.task_decisions
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Add policy for deleting decisions (only creator)
DROP POLICY IF EXISTS "Users can delete their own decisions" ON public.task_decisions;

CREATE POLICY "Users can delete their own decisions"
ON public.task_decisions
FOR DELETE
TO authenticated
USING (created_by = auth.uid());