-- Create table for task snooze settings per user
CREATE TABLE public.task_snoozes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID,
  subtask_id UUID,
  snoozed_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT task_snoozes_task_or_subtask_check CHECK (
    (task_id IS NOT NULL AND subtask_id IS NULL) OR 
    (task_id IS NULL AND subtask_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.task_snoozes ENABLE ROW LEVEL SECURITY;

-- Create policies for task snoozes
CREATE POLICY "Users can create their own task snoozes" 
ON public.task_snoozes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own task snoozes" 
ON public.task_snoozes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own task snoozes" 
ON public.task_snoozes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task snoozes" 
ON public.task_snoozes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_task_snoozes_updated_at
BEFORE UPDATE ON public.task_snoozes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_task_snoozes_user_id ON public.task_snoozes(user_id);
CREATE INDEX idx_task_snoozes_task_id ON public.task_snoozes(task_id);
CREATE INDEX idx_task_snoozes_subtask_id ON public.task_snoozes(subtask_id);
CREATE INDEX idx_task_snoozes_snoozed_until ON public.task_snoozes(snoozed_until);