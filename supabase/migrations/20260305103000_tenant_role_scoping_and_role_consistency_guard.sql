-- Tenant role hardening:
-- 1) Centralize tenant-scoped role checks on user_tenant_memberships
-- 2) Remove direct user_roles usage from tenant-scoped RLS policies
-- 3) Add consistency guards between legacy global user_roles and tenant memberships

-- Central helper for tenant-scoped role checks
CREATE OR REPLACE FUNCTION public.has_active_tenant_role(
  _user_id uuid,
  _tenant_id uuid,
  _roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenant_memberships utm
    WHERE utm.user_id = _user_id
      AND utm.tenant_id = _tenant_id
      AND utm.is_active = true
      AND utm.role = ANY(_roles)
  );
$$;

-- Keep is_tenant_admin centralized on membership data
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT public.has_active_tenant_role(_user_id, _tenant_id, ARRAY['abgeordneter', 'bueroleitung']);
$$;

-- employee_settings: remove legacy global role dependency for tenant-admin insert
DROP POLICY IF EXISTS "employee_settings_insert_scoped" ON public.employee_settings;
CREATE POLICY "employee_settings_insert_scoped"
ON public.employee_settings
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR public.is_tenant_admin(auth.uid(), tenant_id)
);

-- decision_email_templates: enforce tenant-scoped admin check
DROP POLICY IF EXISTS "Admins can update decision email templates" ON public.decision_email_templates;
CREATE POLICY "Admins can update decision email templates"
ON public.decision_email_templates
FOR UPDATE
USING (public.is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- team_announcements: switch admin checks to centralized tenant function
DROP POLICY IF EXISTS "Admins can create announcements" ON public.team_announcements;
CREATE POLICY "Admins can create announcements"
ON public.team_announcements
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
);

DROP POLICY IF EXISTS "Admins can update announcements" ON public.team_announcements;
CREATE POLICY "Admins can update announcements"
ON public.team_announcements
FOR UPDATE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Admins can delete announcements" ON public.team_announcements;
CREATE POLICY "Admins can delete announcements"
ON public.team_announcements
FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- team_announcement_dismissals: admin visibility by tenant-scoped admin rights
DROP POLICY IF EXISTS "Admins can read all dismissals for their announcements" ON public.team_announcement_dismissals;
CREATE POLICY "Admins can read all dismissals for their announcements"
ON public.team_announcement_dismissals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_announcements ta
    WHERE ta.id = announcement_id
      AND public.is_tenant_admin(auth.uid(), ta.tenant_id)
  )
);

-- Consistency guard: prevent contradictory role assignments between legacy user_roles and tenant memberships.
CREATE OR REPLACE FUNCTION public.enforce_role_consistency_between_global_and_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  tenant_scoped_roles CONSTANT text[] := ARRAY['abgeordneter', 'bueroleitung', 'mitarbeiter', 'praktikant'];
BEGIN
  IF TG_TABLE_NAME = 'user_roles' THEN
    IF NEW.role::text = ANY(tenant_scoped_roles) THEN
      IF EXISTS (
        SELECT 1
        FROM public.user_tenant_memberships utm
        WHERE utm.user_id = NEW.user_id
          AND utm.is_active = true
          AND utm.role IS DISTINCT FROM NEW.role::text
      ) THEN
        RAISE EXCEPTION
          'Inkonsistente Rollen: user_roles(%) widerspricht aktiven user_tenant_memberships von user_id %',
          NEW.role::text,
          NEW.user_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'user_tenant_memberships' THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = NEW.user_id
        AND ur.role::text = ANY(tenant_scoped_roles)
        AND ur.role::text IS DISTINCT FROM NEW.role
    ) THEN
      RAISE EXCEPTION
        'Inkonsistente Rollen: user_tenant_memberships(%) widerspricht user_roles für user_id %',
        NEW.role,
        NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_consistency_guard ON public.user_roles;
CREATE TRIGGER trg_user_roles_consistency_guard
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_role_consistency_between_global_and_tenant();

DROP TRIGGER IF EXISTS trg_user_tenant_memberships_consistency_guard ON public.user_tenant_memberships;
CREATE TRIGGER trg_user_tenant_memberships_consistency_guard
  BEFORE INSERT OR UPDATE ON public.user_tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_role_consistency_between_global_and_tenant();
