-- Add completion_notes column to call_logs table
ALTER TABLE public.call_logs 
ADD COLUMN completion_notes text DEFAULT NULL;