-- Reset and assign roles as requested
-- 1) Make all existing users 'mitarbeiter'
DELETE FROM public.user_roles;

INSERT INTO public.user_roles (user_id, role)
SELECT id AS user_id, 'mitarbeiter'::public.app_role AS role
FROM auth.users;

-- 2) Set 'Alexander Salomon' to 'abgeordneter' based on profiles.display_name
UPDATE public.user_roles ur
SET role = 'abgeordneter'::public.app_role
FROM public.profiles p
WHERE ur.user_id = p.user_id
  AND p.display_name = 'Alexander Salomon';