-- Add result_text and completed_at columns to subtasks table
ALTER TABLE public.subtasks
ADD COLUMN result_text TEXT,
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;