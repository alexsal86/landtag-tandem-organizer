-- Update RLS policy for task_decisions to allow creators to update their decisions
DROP POLICY IF EXISTS "task_decisions_update_clean" ON public.task_decisions;

CREATE POLICY "task_decisions_update_clean" 
ON public.task_decisions 
FOR UPDATE 
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = task_decisions.task_id 
    AND t.user_id = auth.uid()
  )
);