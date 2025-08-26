-- Add is_all_day column to appointments table
ALTER TABLE public.appointments 
ADD COLUMN is_all_day boolean NOT NULL DEFAULT false;