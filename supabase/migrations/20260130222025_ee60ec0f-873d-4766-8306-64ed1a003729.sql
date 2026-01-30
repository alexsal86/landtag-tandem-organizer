-- Drop the trigger that auto-creates profiles without tenant_id
-- The edge function manage-tenant-user handles profile creation with proper tenant_id
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Also update the function to be a no-op in case it's called elsewhere,
-- or drop it entirely if it's only used by this trigger
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;