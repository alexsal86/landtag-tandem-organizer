-- Add creator_response column to task_decision_responses table
ALTER TABLE public.task_decision_responses 
ADD COLUMN creator_response text;