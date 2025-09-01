-- First, let's check the current constraint on tasks table
SELECT conname, pg_get_constraintdef(oid) as definition 
FROM pg_constraint 
WHERE conrelid = 'tasks'::regclass AND contype = 'c';

-- Update the category check constraint to allow 'abgeordnetenbrief'
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;

-- Recreate constraint with abgeordnetenbrief included
ALTER TABLE tasks ADD CONSTRAINT tasks_category_check 
CHECK (category = ANY(ARRAY['personal', 'legislation', 'committee', 'constituency', 'mwk', 'call_follow_up', 'abgeordnetenbrief']));