-- Fix the SELECT policy for task_decisions to allow participants to see decisions
-- they are involved in

-- Drop the current restrictive policy
DROP POLICY IF EXISTS "Users can manage their own task decisions" ON public.task_decisions;

-- Create separate policies for different operations
CREATE POLICY "Users can view task decisions they created or participate in" 
ON public.task_decisions 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  id IN (
    SELECT decision_id FROM public.task_decision_participants 
    WHERE user_id = auth.uid()
  ) OR
  task_id IN (
    SELECT id FROM public.tasks 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own task decisions" 
ON public.task_decisions 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own task decisions" 
ON public.task_decisions 
FOR UPDATE 
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own task decisions" 
ON public.task_decisions 
FOR DELETE 
USING (created_by = auth.uid());