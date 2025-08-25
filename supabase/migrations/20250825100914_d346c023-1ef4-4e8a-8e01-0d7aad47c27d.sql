-- Drop the conflicting trigger that automatically creates user_status
-- We handle this manually in the edge function with proper timing
DROP TRIGGER IF EXISTS create_user_status_trigger ON profiles;