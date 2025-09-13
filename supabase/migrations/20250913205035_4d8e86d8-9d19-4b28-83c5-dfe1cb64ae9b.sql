-- Add recurrence support to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS recurrence_rule text,
ADD COLUMN IF NOT EXISTS recurrence_end_date timestamptz;