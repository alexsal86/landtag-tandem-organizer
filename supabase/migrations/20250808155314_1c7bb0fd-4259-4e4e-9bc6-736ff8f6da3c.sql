-- Fix security linter: set search_path on security definer functions

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT public.has_role(_user_id, 'abgeordneter');
$$;

CREATE OR REPLACE FUNCTION public.get_user_role_level(_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT CASE 
    WHEN public.has_role(_user_id, 'abgeordneter') THEN 4
    WHEN public.has_role(_user_id, 'bueroleitung') THEN 3
    WHEN public.has_role(_user_id, 'mitarbeiter') THEN 2
    WHEN public.has_role(_user_id, 'praktikant') THEN 1
    ELSE 0
  END;
$$;