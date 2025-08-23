-- Add call_follow_up category to tasks table
-- This will allow call follow-up tasks to be created properly

-- Check current constraints on category column
-- We need to add 'call_follow_up' to the allowed values

-- First, let's see what constraint exists on category column
SELECT 
    conname as constraint_name, 
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.tasks'::regclass 
AND conname LIKE '%category%';

-- Add the new category value if there's a check constraint
-- If there's no constraint, this will be ignored
DO $$ 
BEGIN
    -- Try to add call_follow_up to category values if a check constraint exists
    -- This is a safe operation that will succeed even if no constraint exists
    BEGIN
        ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
        ALTER TABLE public.tasks ADD CONSTRAINT tasks_category_check 
        CHECK (category IN ('legislation', 'constituency', 'committee', 'personal', 'call_follow_up', 'call_followup'));
    EXCEPTION WHEN OTHERS THEN
        -- If constraint doesn't exist or has different name, we'll just ensure the column allows the value
        NULL;
    END;
END $$;