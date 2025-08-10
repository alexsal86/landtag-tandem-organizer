-- Drop existing policies and recreate them correctly
DROP POLICY IF EXISTS "Users can view comments on their tasks" ON public.task_comments;
DROP POLICY IF EXISTS "Users can add comments to their tasks" ON public.task_comments;

-- Create new policies with correct logic
CREATE POLICY "Users can view comments on their tasks" 
ON public.task_comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = task_comments.task_id 
    AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create comments on their tasks" 
ON public.task_comments 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = task_comments.task_id 
    AND t.user_id = auth.uid()
  )
);