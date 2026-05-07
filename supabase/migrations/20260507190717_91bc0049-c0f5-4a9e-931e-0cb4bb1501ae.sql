
CREATE OR REPLACE FUNCTION public.snapshot_rls_coverage_internal()
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

REVOKE ALL ON FUNCTION public.snapshot_rls_coverage_internal() FROM PUBLIC, anon, authenticated;

-- Snapshot-Cron umstellen auf direkten SQL-Aufruf
DO $$
BEGIN
  PERFORM cron.unschedule('security-rls-snapshot-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='security-rls-snapshot-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'security-rls-snapshot-daily',
  '0 3 * * *',
  $cron$ SELECT public.snapshot_rls_coverage_internal(); $cron$
);
