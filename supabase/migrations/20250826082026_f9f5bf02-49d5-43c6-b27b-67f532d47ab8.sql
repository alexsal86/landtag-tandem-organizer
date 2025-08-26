-- Fix database schema for appointments - simplified approach
-- The error seems to be related to triggers, let's just ensure our appointments table is correct

-- Add the missing columns if they don't exist
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS meeting_link TEXT,
ADD COLUMN IF NOT EXISTS meeting_details TEXT;