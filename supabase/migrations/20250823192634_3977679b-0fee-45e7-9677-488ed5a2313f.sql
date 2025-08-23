-- Add new columns to call_logs table for unknown contacts and created_by info
ALTER TABLE public.call_logs 
ADD COLUMN caller_name TEXT,
ADD COLUMN caller_phone TEXT,
ADD COLUMN created_by_name TEXT;

-- Add call_log_id to tasks table for follow-up integration
ALTER TABLE public.tasks
ADD COLUMN call_log_id UUID REFERENCES public.call_logs(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_tasks_call_log_id ON public.tasks(call_log_id);
CREATE INDEX idx_call_logs_caller_phone ON public.call_logs(caller_phone);

-- Update existing call_logs to populate created_by_name from profiles
UPDATE public.call_logs 
SET created_by_name = p.display_name
FROM public.profiles p
WHERE call_logs.user_id = p.user_id;