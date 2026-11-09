-- Stable keyset pagination: no skipped/duplicated records when new logs arrive.
CREATE OR REPLACE FUNCTION public.export_admin_audit_logs(
  _tenant_id uuid, _search text DEFAULT '', _ip text DEFAULT '', _as_of timestamptz DEFAULT NULL,
  _before_created timestamptz DEFAULT NULL, _before_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE snapshot_at timestamptz:=coalesce(_as_of,statement_timestamp()); result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (is_tenant_admin(auth.uid(),_tenant_id) OR is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Keine Administrationsberechtigung' USING ERRCODE='42501';
  END IF;
  IF (_before_created IS NULL)<>(_before_id IS NULL) OR snapshot_at>statement_timestamp() THEN
    RAISE EXCEPTION 'Ungültiger Export-Cursor' USING ERRCODE='22023';
  END IF;
  WITH page AS MATERIALIZED (
    SELECT id,created_at,ip_address,payload FROM audit_log_entries
    WHERE tenant_id=_tenant_id AND created_at<=snapshot_at
      AND (_before_created IS NULL OR (created_at,id)<(_before_created,_before_id))
      AND (coalesce(_search,'')='' OR strpos(lower(payload::text),lower(_search))>0)
      AND (coalesce(_ip,'')='' OR ip_address::text=_ip)
    ORDER BY created_at DESC,id DESC LIMIT 500
  )
  SELECT jsonb_build_object('asOf',snapshot_at,'logs',coalesce(jsonb_agg(page ORDER BY created_at DESC,id DESC),'[]'::jsonb)) INTO result FROM page;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.export_admin_audit_logs(uuid,text,text,timestamptz,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.export_admin_audit_logs(uuid,text,text,timestamptz,timestamptz,uuid) TO authenticated;
CREATE INDEX IF NOT EXISTS audit_logs_office_export_cursor ON public.audit_log_entries(tenant_id,created_at DESC,id DESC);
