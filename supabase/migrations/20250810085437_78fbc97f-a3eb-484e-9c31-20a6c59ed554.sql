-- Fix task_comments table to have proper foreign key relationship
ALTER TABLE public.task_comments 
ADD CONSTRAINT task_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policy for task_comments to allow proper access
DROP POLICY IF EXISTS "Users can view comments on their tasks" ON public.task_comments;
DROP POLICY IF EXISTS "Users can add comments to their tasks" ON public.task_comments;

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

CREATE POLICY "Users can add comments to their tasks" 
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