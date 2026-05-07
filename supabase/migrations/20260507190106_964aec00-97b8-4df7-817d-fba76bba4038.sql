
-- =========================
-- 1) RLS-Coverage View + RPC
-- =========================
CREATE OR REPLACE VIEW public.v_rls_coverage AS
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  COALESCE(p.policy_count, 0) AS policy_count,
  EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'public'
      AND col.table_name = c.relname
      AND col.column_name = 'tenant_id'
  ) AS has_tenant_id,
  EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'public'
      AND col.table_name = c.relname
      AND col.column_name = 'user_id'
  ) AS has_user_id
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT schemaname, tablename, COUNT(*) AS policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY schemaname, tablename
) p ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

GRANT SELECT ON public.v_rls_coverage TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_rls_gaps()
RETURNS TABLE (
  table_name text,
  severity text,
  reason text,
  has_tenant_id boolean,
  policy_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'abgeordneter'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    v.table_name::text,
    CASE
      WHEN NOT v.rls_enabled THEN 'critical'
      WHEN v.has_tenant_id AND v.policy_count = 0 THEN 'critical'
      WHEN v.has_tenant_id AND v.policy_count < 2 THEN 'warning'
      WHEN v.policy_count = 0 THEN 'warning'
      ELSE 'ok'
    END::text AS severity,
    CASE
      WHEN NOT v.rls_enabled THEN 'RLS deaktiviert'
      WHEN v.has_tenant_id AND v.policy_count = 0 THEN 'tenant_id vorhanden, aber keine Policy'
      WHEN v.policy_count = 0 THEN 'Keine Policies definiert'
      WHEN v.has_tenant_id AND v.policy_count < 2 THEN 'Wenige Policies trotz tenant_id'
      ELSE 'OK'
    END::text AS reason,
    v.has_tenant_id,
    v.policy_count::integer
  FROM public.v_rls_coverage v
  ORDER BY
    CASE
      WHEN NOT v.rls_enabled THEN 0
      WHEN v.has_tenant_id AND v.policy_count = 0 THEN 1
      WHEN v.policy_count = 0 THEN 2
      WHEN v.has_tenant_id AND v.policy_count < 2 THEN 3
      ELSE 4
    END,
    v.table_name;
END;
$$;

-- =========================
-- 2) Security Audit Snapshots
-- =========================
CREATE TABLE IF NOT EXISTS public.security_audit_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  total_tables integer NOT NULL DEFAULT 0,
  rls_enabled_count integer NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.security_audit_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin reads security snapshots"
  ON public.security_audit_snapshots FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'abgeordneter'::app_role));

CREATE POLICY "System inserts security snapshots"
  ON public.security_audit_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'abgeordneter'::app_role));

CREATE OR REPLACE FUNCTION public.snapshot_rls_coverage()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_findings jsonb;
  v_total integer;
  v_rls_on integer;
  v_critical integer;
  v_warning integer;
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'abgeordneter'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE true),
    COUNT(*) FILTER (WHERE rls_enabled),
    COUNT(*) FILTER (WHERE NOT rls_enabled OR (has_tenant_id AND policy_count = 0)),
    COUNT(*) FILTER (WHERE rls_enabled AND policy_count < 2 AND has_tenant_id),
    jsonb_agg(jsonb_build_object(
      'table', table_name,
      'rls', rls_enabled,
      'policies', policy_count,
      'has_tenant_id', has_tenant_id
    ))
  INTO v_total, v_rls_on, v_critical, v_warning, v_findings
  FROM public.v_rls_coverage;

  INSERT INTO public.security_audit_snapshots (
    total_tables, rls_enabled_count, critical_count, warning_count, findings
  ) VALUES (v_total, v_rls_on, v_critical, v_warning, v_findings)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- =========================
-- 3) GDPR Requests
-- =========================
CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('export','delete')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','processing','completed','rejected','failed')),
  subject_contact_id uuid,
  subject_email text,
  subject_name text,
  reason text,
  requested_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  processed_at timestamptz,
  result_storage_path text,
  result_summary jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_tenant ON public.gdpr_requests(tenant_id, created_at DESC);

ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins read gdpr requests"
  ON public.gdpr_requests FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    AND (
      public.has_role(auth.uid(), 'abgeordneter'::app_role)
      OR public.has_role(auth.uid(), 'bueroleitung'::app_role)
    )
  );

CREATE POLICY "Tenant admins create gdpr requests"
  ON public.gdpr_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_member(tenant_id, auth.uid())
    AND requested_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'abgeordneter'::app_role)
      OR public.has_role(auth.uid(), 'bueroleitung'::app_role)
    )
  );

CREATE POLICY "Tenant admins update gdpr requests"
  ON public.gdpr_requests FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    AND (
      public.has_role(auth.uid(), 'abgeordneter'::app_role)
      OR public.has_role(auth.uid(), 'bueroleitung'::app_role)
    )
  );

CREATE OR REPLACE FUNCTION public.gdpr_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gdpr_updated_at ON public.gdpr_requests;
CREATE TRIGGER trg_gdpr_updated_at
  BEFORE UPDATE ON public.gdpr_requests
  FOR EACH ROW EXECUTE FUNCTION public.gdpr_set_updated_at();

-- Vier-Augen-Prinzip für Löschungen: approved_by ≠ requested_by
CREATE OR REPLACE FUNCTION public.gdpr_check_four_eyes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_type = 'delete' AND NEW.status = 'approved' THEN
    IF NEW.approved_by IS NULL OR NEW.approved_by = NEW.requested_by THEN
      RAISE EXCEPTION 'Vier-Augen-Prinzip verletzt: Genehmiger muss vom Antragsteller verschieden sein.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gdpr_four_eyes ON public.gdpr_requests;
CREATE TRIGGER trg_gdpr_four_eyes
  BEFORE INSERT OR UPDATE ON public.gdpr_requests
  FOR EACH ROW EXECUTE FUNCTION public.gdpr_check_four_eyes();

-- =========================
-- 4) System Health
-- =========================
CREATE TABLE IF NOT EXISTS public.system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','warning','critical')),
  details jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_health_check ON public.system_health(check_name, checked_at DESC);

ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin reads system health"
  ON public.system_health FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'abgeordneter'::app_role));

CREATE POLICY "Superadmin writes system health"
  ON public.system_health FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'abgeordneter'::app_role));
