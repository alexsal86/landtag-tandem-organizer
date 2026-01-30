-- 1. Create is_superadmin function (checks for system superadmin email)
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
      AND email = 'mail@alexander-salomon.de'
  )
$$;

-- 2. Add RLS policies for tenants table (Superadmin management)
CREATE POLICY "Superadmin can view all tenants"
ON public.tenants FOR SELECT
TO authenticated
USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can create tenants"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can update all tenants"
ON public.tenants FOR UPDATE
TO authenticated
USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can delete tenants"
ON public.tenants FOR DELETE
TO authenticated
USING (is_superadmin(auth.uid()));

-- 3. Add RLS policies for user_tenant_memberships table (Superadmin management)
CREATE POLICY "Superadmin can view all memberships"
ON public.user_tenant_memberships FOR SELECT
TO authenticated
USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can create memberships"
ON public.user_tenant_memberships FOR INSERT
TO authenticated
WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can update all memberships"
ON public.user_tenant_memberships FOR UPDATE
TO authenticated
USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin can delete memberships"
ON public.user_tenant_memberships FOR DELETE
TO authenticated
USING (is_superadmin(auth.uid()));

-- 4. Add RLS policies for profiles table (Superadmin can view all)
CREATE POLICY "Superadmin can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (is_superadmin(auth.uid()));