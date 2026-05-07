-- ===== 1. tenant_feature_flags =====
CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS tenant_feature_flags_tenant_idx
  ON public.tenant_feature_flags(tenant_id);

ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_select_own_tenant"
  ON public.tenant_feature_flags FOR SELECT
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "feature_flags_admin_write"
  ON public.tenant_feature_flags FOR ALL
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (public.has_role(auth.uid(), 'abgeordneter'::app_role)
         OR public.has_role(auth.uid(), 'bueroleitung'::app_role))
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (public.has_role(auth.uid(), 'abgeordneter'::app_role)
         OR public.has_role(auth.uid(), 'bueroleitung'::app_role))
  );

-- ===== 2. action_permissions =====
CREATE TABLE IF NOT EXISTS public.action_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  allowed_roles app_role[] NOT NULL DEFAULT ARRAY[]::app_role[],
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, action_key)
);

CREATE INDEX IF NOT EXISTS action_permissions_tenant_idx
  ON public.action_permissions(tenant_id);

ALTER TABLE public.action_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_perms_select_own_tenant"
  ON public.action_permissions FOR SELECT
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "action_perms_admin_write"
  ON public.action_permissions FOR ALL
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (public.has_role(auth.uid(), 'abgeordneter'::app_role)
         OR public.has_role(auth.uid(), 'bueroleitung'::app_role))
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (public.has_role(auth.uid(), 'abgeordneter'::app_role)
         OR public.has_role(auth.uid(), 'bueroleitung'::app_role))
  );

-- ===== 3. field_permissions =====
CREATE TABLE IF NOT EXISTS public.field_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  role app_role NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_write BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, table_name, column_name, role)
);

CREATE INDEX IF NOT EXISTS field_permissions_lookup_idx
  ON public.field_permissions(tenant_id, table_name, role);

ALTER TABLE public.field_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_perms_select_own_tenant"
  ON public.field_permissions FOR SELECT
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "field_perms_admin_write"
  ON public.field_permissions FOR ALL
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (public.has_role(auth.uid(), 'abgeordneter'::app_role)
         OR public.has_role(auth.uid(), 'bueroleitung'::app_role))
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (public.has_role(auth.uid(), 'abgeordneter'::app_role)
         OR public.has_role(auth.uid(), 'bueroleitung'::app_role))
  );

-- ===== Hilfsfunktionen =====
CREATE OR REPLACE FUNCTION public.is_feature_enabled(_tenant_id UUID, _feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.tenant_feature_flags
     WHERE tenant_id = _tenant_id AND feature_key = _feature_key),
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_action_allowed(_user_id UUID, _action_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _tenant_id UUID;
  _allowed app_role[];
  _role app_role;
BEGIN
  SELECT tenant_id INTO _tenant_id FROM public.profiles WHERE id = _user_id;
  IF _tenant_id IS NULL THEN RETURN false; END IF;

  SELECT allowed_roles INTO _allowed
  FROM public.action_permissions
  WHERE tenant_id = _tenant_id AND action_key = _action_key;

  -- Default: erlaubt, wenn keine Regel gesetzt
  IF _allowed IS NULL THEN RETURN true; END IF;

  FOREACH _role IN ARRAY _allowed LOOP
    IF public.has_role(_user_id, _role) THEN RETURN true; END IF;
  END LOOP;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_field(_user_id UUID, _table TEXT, _column TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _tenant_id UUID;
  _result BOOLEAN := true;
BEGIN
  SELECT tenant_id INTO _tenant_id FROM public.profiles WHERE id = _user_id;
  IF _tenant_id IS NULL THEN RETURN false; END IF;

  -- Wenn der User keine Rolle mit can_read=false hat, gilt: true
  SELECT NOT EXISTS (
    SELECT 1 FROM public.field_permissions fp
    WHERE fp.tenant_id = _tenant_id
      AND fp.table_name = _table
      AND fp.column_name = _column
      AND fp.can_read = false
      AND public.has_role(_user_id, fp.role)
  ) INTO _result;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_field(_user_id UUID, _table TEXT, _column TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _tenant_id UUID;
  _result BOOLEAN := true;
BEGIN
  SELECT tenant_id INTO _tenant_id FROM public.profiles WHERE id = _user_id;
  IF _tenant_id IS NULL THEN RETURN false; END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.field_permissions fp
    WHERE fp.tenant_id = _tenant_id
      AND fp.table_name = _table
      AND fp.column_name = _column
      AND fp.can_write = false
      AND public.has_role(_user_id, fp.role)
  ) INTO _result;

  RETURN _result;
END;
$$;

-- Internal helpers: nicht für anon, nur authenticated explizit gewünscht
REVOKE EXECUTE ON FUNCTION public.is_feature_enabled(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_action_allowed(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_field(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_field(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_action_allowed(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_field(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_field(UUID, TEXT, TEXT) TO authenticated;

-- updated_at-Trigger
DROP TRIGGER IF EXISTS feature_flags_touch ON public.tenant_feature_flags;
CREATE TRIGGER feature_flags_touch BEFORE UPDATE ON public.tenant_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS action_perms_touch ON public.action_permissions;
CREATE TRIGGER action_perms_touch BEFORE UPDATE ON public.action_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS field_perms_touch ON public.field_permissions;
CREATE TRIGGER field_perms_touch BEFORE UPDATE ON public.field_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();