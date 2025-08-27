-- Update RLS policy for task_decisions to allow task creators to view decisions
DROP POLICY IF EXISTS "task_decisions_select_clean" ON public.task_decisions;

CREATE POLICY "task_decisions_select_clean" 
ON public.task_decisions 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = task_decisions.task_id 
    AND t.user_id = auth.uid()
  )
);