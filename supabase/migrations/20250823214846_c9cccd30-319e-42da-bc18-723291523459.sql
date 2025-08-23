-- Add task_id column to quick_notes table for linking notes to tasks
ALTER TABLE public.quick_notes 
ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Add index for better performance when querying notes by task
CREATE INDEX idx_quick_notes_task_id ON public.quick_notes(task_id);