-- Find and disable the create_user_status trigger that's causing the conflict
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    event_object_table
FROM information_schema.triggers 
WHERE action_statement LIKE '%create_user_status%' 
   OR trigger_name LIKE '%user_status%';

-- Drop the problematic trigger since we handle user_status creation manually in the edge function
DROP TRIGGER IF EXISTS create_user_status_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_user_status ON auth.users;