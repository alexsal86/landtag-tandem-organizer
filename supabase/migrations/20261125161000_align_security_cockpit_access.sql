-- The administration entry point uses the platform role. Preserve existing
-- deputy read access to the metadata shared with the feature catalog.
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
  IF NOT (coalesce(public.is_superadmin(auth.uid()),false) OR coalesce(public.has_role(auth.uid(), 'abgeordneter'::public.app_role),false)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.audit_rls_policies(_tables text[] DEFAULT NULL)
RETURNS TABLE (
  table_name text,
  policy_name text,
  command text,
  roles name[],
  permissive text,
  has_using boolean,
  has_check boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (coalesce(public.is_superadmin(auth.uid()),false) OR coalesce(public.has_role(auth.uid(), 'abgeordneter'::public.app_role),false)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    p.roles,
    p.permissive::text,
    (p.qual IS NOT NULL),
    (p.with_check IS NOT NULL)
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND (_tables IS NULL OR p.tablename = ANY (_tables))
  ORDER BY p.tablename, p.policyname;
END;
$$;

CREATE OR REPLACE FUNCTION public.snapshot_rls_coverage()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT coalesce(public.is_superadmin(auth.uid()),false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.snapshot_rls_coverage_internal();
END;
$$;

ALTER POLICY "Superadmin reads security snapshots"
  ON public.security_audit_snapshots USING ((SELECT public.is_superadmin(auth.uid())));
ALTER POLICY "System inserts security snapshots"
  ON public.security_audit_snapshots WITH CHECK ((SELECT public.is_superadmin(auth.uid())));

REVOKE ALL ON FUNCTION public.audit_rls_gaps(), public.audit_rls_policies(text[]), public.snapshot_rls_coverage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_rls_gaps(), public.audit_rls_policies(text[]), public.snapshot_rls_coverage() TO authenticated;
