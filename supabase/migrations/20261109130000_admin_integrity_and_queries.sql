-- Preserve defaults independently for each office, including concurrent writers.
CREATE OR REPLACE FUNCTION public.ensure_single_default_meeting_template()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    IF NEW.tenant_id IS NULL THEN RAISE EXCEPTION 'Büro fehlt'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('meeting-default:' || NEW.tenant_id::text, 0));
    UPDATE public.meeting_templates SET is_default = false
      WHERE tenant_id = NEW.tenant_id AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END $$;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY id) AS position
  FROM public.meeting_templates WHERE is_default AND tenant_id IS NOT NULL
)
UPDATE public.meeting_templates SET is_default = false WHERE id IN (SELECT id FROM ranked WHERE position > 1);
CREATE UNIQUE INDEX IF NOT EXISTS meeting_templates_one_default_per_tenant
  ON public.meeting_templates(tenant_id) WHERE is_default;

-- Permission configuration belongs to active office memberships, never profiles.id.
DO $$
DECLARE item text; policy_name text;
BEGIN
  FOREACH item IN ARRAY ARRAY['tenant_feature_flags','action_permissions','field_permissions'] LOOP
    FOR policy_name IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=item LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, item);
    END LOOP;
    EXECUTE format('CREATE POLICY read_configuration ON public.%I FOR SELECT TO authenticated USING (
      public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY[''abgeordneter'',''bueroleitung'',''mitarbeiter'',''praktikant'']) OR public.is_superadmin(auth.uid()))',item);
    EXECUTE format('CREATE POLICY manage_configuration ON public.%I FOR ALL TO authenticated
      USING(public.is_tenant_admin(auth.uid(),tenant_id) OR public.is_superadmin(auth.uid()))
      WITH CHECK(public.is_tenant_admin(auth.uid(),tenant_id) OR public.is_superadmin(auth.uid()))',item);
  END LOOP;
END $$;

-- Sort existing rows without INSERT, preserving all required columns and RLS.
CREATE OR REPLACE FUNCTION public.reorder_admin_items(_table text, _tenant_id uuid, _ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE row_id uuid; position integer := 0; scoped boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_tenant_admin(auth.uid(),_tenant_id) OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Keine Administrationsberechtigung' USING ERRCODE='42501';
  END IF;
  IF _table IS NULL OR _table NOT IN ('task_categories','todo_categories','case_file_types','document_categories',
    'appointment_categories','appointment_statuses','appointment_locations','task_statuses','case_file_processing_statuses','rss_sources') THEN
    RAISE EXCEPTION 'Ungültige Konfigurationstabelle' USING ERRCODE='22023';
  END IF;
  IF _ids IS NULL OR cardinality(_ids)>1000 OR cardinality(_ids)<>(SELECT count(DISTINCT id) FROM unnest(_ids) id) THEN
    RAISE EXCEPTION 'Ungültige Reihenfolge' USING ERRCODE='22023';
  END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=_table AND column_name='tenant_id') INTO scoped;
  IF NOT scoped AND NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Globale Stammdaten erfordern Plattformrechte' USING ERRCODE='42501';
  END IF;
  FOREACH row_id IN ARRAY _ids LOOP
    IF scoped THEN
      EXECUTE format('UPDATE public.%I SET order_index=$1 WHERE id=$2 AND tenant_id=$3 RETURNING id',_table) INTO row_id USING position,row_id,_tenant_id;
    ELSE
      EXECUTE format('UPDATE public.%I SET order_index=$1 WHERE id=$2 RETURNING id',_table) INTO row_id USING position,row_id;
    END IF;
    IF row_id IS NULL THEN RAISE EXCEPTION 'Eintrag nicht im aktuellen Büro verfügbar' USING ERRCODE='42501'; END IF;
    position := position+1;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.reorder_admin_items(text,uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reorder_admin_items(text,uuid,uuid[]) TO authenticated;

-- Search the entire authorized result set BEFORE pagination; literal text, no SQL interpolation.
CREATE OR REPLACE FUNCTION public.search_admin_audit_logs(_tenant_id uuid, _search text DEFAULT '', _ip text DEFAULT '', _offset integer DEFAULT 0, _limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT (public.is_tenant_admin(auth.uid(),_tenant_id) OR public.is_superadmin(auth.uid())) OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Keine Administrationsberechtigung' USING ERRCODE='42501';
  END IF;
  WITH matches AS MATERIALIZED (
    SELECT * FROM public.audit_log_entries WHERE tenant_id=_tenant_id
      AND (coalesce(_search,'')='' OR strpos(lower(payload::text),lower(_search))>0)
      AND (coalesce(_ip,'')='' OR ip_address::text=_ip)
  ), page AS (
    SELECT * FROM matches ORDER BY created_at DESC,id DESC OFFSET greatest(_offset,0) LIMIT least(greatest(_limit,1),500)
  )
  SELECT jsonb_build_object('logs',coalesce((SELECT jsonb_agg(p) FROM page p),'[]'::jsonb),'totalCount',(SELECT count(*) FROM matches)) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.search_admin_audit_logs(uuid,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_admin_audit_logs(uuid,text,text,integer,integer) TO authenticated;

-- Global helper signatures cannot choose an office safely for multi-office users.
-- Keep legacy signatures only for an unambiguous active membership; otherwise deny.
CREATE OR REPLACE FUNCTION public.is_action_allowed(_user_id uuid,_action_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _user_id=auth.uid() AND (SELECT count(*)=1 FROM user_tenant_memberships WHERE user_id=_user_id AND is_active)
 AND coalesce((SELECT m.role=ANY(p.allowed_roles::text[]) FROM user_tenant_memberships m JOIN action_permissions p ON p.tenant_id=m.tenant_id AND p.action_key=_action_key WHERE m.user_id=_user_id AND m.is_active LIMIT 1),true)
$$;
CREATE OR REPLACE FUNCTION public.can_read_field(_user_id uuid,_table text,_column text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _user_id=auth.uid() AND (SELECT count(*)=1 FROM user_tenant_memberships WHERE user_id=_user_id AND is_active)
 AND NOT EXISTS(SELECT 1 FROM user_tenant_memberships m JOIN field_permissions p ON p.tenant_id=m.tenant_id AND p.role::text=m.role WHERE m.user_id=_user_id AND m.is_active AND p.table_name=_table AND p.column_name=_column AND NOT p.can_read)
$$;
CREATE OR REPLACE FUNCTION public.can_write_field(_user_id uuid,_table text,_column text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.can_read_field(_user_id,_table,_column) AND NOT EXISTS(SELECT 1 FROM user_tenant_memberships m JOIN field_permissions p ON p.tenant_id=m.tenant_id AND p.role::text=m.role WHERE m.user_id=_user_id AND m.is_active AND p.table_name=_table AND p.column_name=_column AND NOT p.can_write)
$$;

-- These two legacy lookup tables have no tenant column: writes affect every office.
DO $$
DECLARE item text; policy_name text;
BEGIN
  FOREACH item IN ARRAY ARRAY['todo_categories','task_statuses'] LOOP
    FOR policy_name IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=item LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',policy_name,item);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',item);
    EXECUTE format('CREATE POLICY global_lookup_read ON public.%I FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL)',item);
    EXECUTE format('CREATE POLICY global_lookup_manage ON public.%I FOR ALL TO authenticated USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()))',item);
  END LOOP;
END $$;
