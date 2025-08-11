-- Update RLS policies for task_comments to allow everyone to view and comment on all tasks

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view comments on their tasks" ON public.task_comments;
DROP POLICY IF EXISTS "Users can add comments to their tasks" ON public.task_comments;

-- Create new policies that allow all authenticated users to view and add comments to any task
CREATE POLICY "Anyone can view task comments" ON public.task_comments
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can add task comments" ON public.task_comments
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);