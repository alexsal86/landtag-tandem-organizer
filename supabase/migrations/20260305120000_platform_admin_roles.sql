-- Introduce system-wide platform roles
CREATE TABLE IF NOT EXISTS public.platform_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role),
  CONSTRAINT platform_roles_role_check CHECK (role IN ('platform_admin'))
);

ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own platform roles"
ON public.platform_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Replace legacy email-based check with DB role check
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_roles pr
    WHERE pr.user_id = _user_id
      AND pr.role = 'platform_admin'
  )
$$;

-- One-time migration path: migrate legacy superadmin accounts to platform_admin role
INSERT INTO public.platform_roles (user_id, role)
SELECT u.id, 'platform_admin'
FROM auth.users u
WHERE u.email = 'mail@alexander-salomon.de'
ON CONFLICT (user_id, role) DO NOTHING;

-- Optional claim migration for claim-based checks in edge functions
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('platform_roles', jsonb_build_array('platform_admin'))
WHERE id IN (
  SELECT user_id
  FROM public.platform_roles
  WHERE role = 'platform_admin'
)
AND (
  raw_app_meta_data IS NULL
  OR raw_app_meta_data->'platform_roles' IS NULL
  OR NOT (raw_app_meta_data->'platform_roles') ? 'platform_admin'
);
