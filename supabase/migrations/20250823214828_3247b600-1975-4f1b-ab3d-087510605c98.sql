-- Add task_id column to quick_notes table for linking notes to tasks
ALTER TABLE public.quick_notes 
ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Add index for better performance when querying notes by task
CREATE INDEX idx_quick_notes_task_id ON public.quick_notes(task_id);

-- Update the call log widget to create subtasks instead of main tasks for follow-ups
-- First, let's create a subtasks table for call log follow-ups
CREATE TABLE IF NOT EXISTS public.subtasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_completed boolean NOT NULL DEFAULT false,
  assigned_to text,
  due_date timestamp with time zone,
  order_index integer NOT NULL DEFAULT 0,
  completed_at timestamp with time zone,
  result_text text,
  planning_item_id uuid,
  source_type text DEFAULT 'task',
  checklist_item_title text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for subtasks
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for subtasks
CREATE POLICY "Authenticated users can create all subtasks" 
ON public.subtasks 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can view all subtasks" 
ON public.subtasks 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can update all subtasks" 
ON public.subtasks 
FOR UPDATE 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can delete all subtasks" 
ON public.subtasks 
FOR DELETE 
USING (auth.role() = 'authenticated'::text);

-- Add trigger for updated_at column
CREATE TRIGGER update_subtasks_updated_at
BEFORE UPDATE ON public.subtasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();