
-- Add parent_id column for threaded comments
ALTER TABLE public.task_comments 
ADD COLUMN parent_id uuid REFERENCES public.task_comments(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_task_comments_parent_id ON public.task_comments(parent_id);
