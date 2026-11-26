-- RLS-Audit: Fehlende Policies sind nur dann eine Lücke, wenn Clients die Tabelle
-- überhaupt erreichen können. Tabellen wie team_fun_facts, team_two_truths_months,
-- team_two_truths_answers und quick_note_topic_mention_deliveries sind bewusst
-- deny-all: RLS aktiv, keine Policy und alle Rechte für anon/authenticated entzogen;
-- gelesen und geschrieben wird ausschließlich über geprüfte SECURITY-DEFINER-RPCs.
--
-- Die Coverage-View weist den Client-Grant-Stand deshalb je Tabelle aus. Audit und
-- Snapshot-Zählung verwenden dieselbe Regel, damit ein beabsichtigtes Deny-all nicht
-- mehr als "critical" erscheint und echte Befunde nicht von Fehlalarmen verdeckt werden.

-- 1) Coverage-View um den Grant-Stand für Client-Rollen erweitern.
--    has_table_privilege zählt auch über PUBLIC erteilte Rechte und prüft pro Rolle,
--    damit eine Rolle, die es in einer Umgebung nicht gibt, die Auswertung nicht abbricht.
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
  ) AS has_user_id,
  EXISTS (
    SELECT 1
    FROM pg_roles r
    WHERE r.rolname IN ('anon', 'authenticated')
      AND has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE')
  ) AS client_grant
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

-- 2) Befund: RLS aus bleibt kritisch, erreicht keine Client-Rolle und keine Policy
--    ist beabsichtigtes Deny-all, erreichbar ohne Policy bleibt kritisch.
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
      WHEN NOT v.client_grant AND v.policy_count = 0 THEN 'ok'
      WHEN v.has_tenant_id AND v.policy_count = 0 THEN 'critical'
      WHEN v.has_tenant_id AND v.policy_count < 2 THEN 'warning'
      WHEN v.policy_count = 0 THEN 'warning'
      ELSE 'ok'
    END::text AS severity,
    CASE
      WHEN NOT v.rls_enabled THEN 'RLS deaktiviert'
      WHEN NOT v.client_grant AND v.policy_count = 0 THEN 'Deny-all ohne Client-Grant (beabsichtigt)'
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
      WHEN v.has_tenant_id AND v.policy_count = 0 AND v.client_grant THEN 1
      WHEN v.policy_count = 0 AND v.client_grant THEN 2
      WHEN v.has_tenant_id AND v.policy_count < 2 THEN 3
      ELSE 4
    END,
    v.table_name;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_rls_gaps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_rls_gaps() TO authenticated;

-- 3) Snapshot-Zählung mit derselben Regel; der Grant-Stand steht im Befund-JSON.
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
    COUNT(*) FILTER (WHERE NOT rls_enabled OR (has_tenant_id AND policy_count = 0 AND client_grant)),
    COUNT(*) FILTER (WHERE rls_enabled AND has_tenant_id AND policy_count BETWEEN 1 AND 1),
    jsonb_agg(jsonb_build_object(
      'table', table_name,
      'rls', rls_enabled,
      'policies', policy_count,
      'has_tenant_id', has_tenant_id,
      'client_grant', client_grant
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
