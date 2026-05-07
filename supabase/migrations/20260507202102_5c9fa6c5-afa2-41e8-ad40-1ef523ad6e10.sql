
-- Create superadmin_users table for global platform admins
CREATE TABLE IF NOT EXISTS public.superadmin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.superadmin_users ENABLE ROW LEVEL SECURITY;

-- Only existing superadmins can read/manage the list
CREATE POLICY "Superadmins can view superadmin list"
  ON public.superadmin_users FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can insert"
  ON public.superadmin_users FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can delete"
  ON public.superadmin_users FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- Seed existing hardcoded superadmin
INSERT INTO public.superadmin_users (user_id, note)
SELECT id, 'Migrated from hardcoded is_superadmin email'
FROM auth.users
WHERE email = 'mail@alexander-salomon.de'
ON CONFLICT (user_id) DO NOTHING;

-- Replace is_superadmin to read from superadmin_users (no more hardcoded email)
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.superadmin_users WHERE user_id = _user_id
  )
$function$;
