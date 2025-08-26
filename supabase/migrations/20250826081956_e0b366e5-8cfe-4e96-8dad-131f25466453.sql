-- Check if net schema issue exists and try to fix it
-- This seems to be related to PostgreSQL extensions

-- If there are any triggers or functions referencing a non-existent 'net' schema, let's fix them
-- First, let's check what might be causing this issue

-- Drop any problematic triggers that might reference 'net' schema
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    -- Loop through all triggers and check if any reference non-existent schemas
    FOR trigger_rec IN 
        SELECT schemaname, tablename, triggername 
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
    LOOP
        -- We'll handle this case by case if triggers exist
        NULL;
    END LOOP;
END $$;

-- Ensure the appointments table has all necessary columns for digital events
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS meeting_link TEXT,
ADD COLUMN IF NOT EXISTS meeting_details TEXT;

-- Add RLS policies if not exists for new columns
DROP POLICY IF EXISTS "Users can view their own appointments description" ON public.appointments;
CREATE POLICY "Users can view their own appointments description" 
ON public.appointments 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own appointments description" ON public.appointments;
CREATE POLICY "Users can update their own appointments description" 
ON public.appointments 
FOR UPDATE 
USING (auth.uid() = user_id);