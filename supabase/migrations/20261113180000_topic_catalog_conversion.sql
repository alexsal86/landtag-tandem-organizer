CREATE TABLE IF NOT EXISTS public.topic_catalog_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 topic_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('committee','region')),committee_id uuid,region_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,topic_id),
 FOREIGN KEY(tenant_id,topic_id) REFERENCES public.topics(tenant_id,id),
 FOREIGN KEY(tenant_id,committee_id) REFERENCES public.committees(tenant_id,id),
 FOREIGN KEY(tenant_id,region_id) REFERENCES public.regions(tenant_id,id),
 CHECK((kind='committee' AND committee_id IS NOT NULL AND region_id IS NULL) OR (kind='region' AND region_id IS NOT NULL AND committee_id IS NULL))
);
ALTER TABLE public.topic_catalog_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_read ON public.topic_catalog_links;
CREATE POLICY tenant_read ON public.topic_catalog_links FOR SELECT TO authenticated USING(public.user_belongs_to_tenant(tenant_id));
REVOKE ALL ON public.topic_catalog_links FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.topic_catalog_links TO authenticated;

CREATE OR REPLACE FUNCTION public.convert_topic_to_catalog(p_topic uuid,p_kind text,p_region_kind text DEFAULT 'gemeinde')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source public.topics; existing public.topic_catalog_links; target uuid; label text; col text;
BEGIN
 SELECT * INTO source FROM public.topics WHERE id=p_topic;
 IF source.id IS NULL OR NOT public.user_belongs_to_tenant(source.tenant_id) OR NOT public.is_tenant_config_admin(source.tenant_id) THEN RAISE EXCEPTION 'Nur die Büroleitung oder Abgeordnete dürfen Themen umwandeln.' USING ERRCODE='42501'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('committee','region') OR (p_kind='region' AND (p_region_kind IS NULL OR p_region_kind NOT IN ('stadtteil','gemeinde'))) THEN RAISE EXCEPTION 'Ungültiger Bereichstyp.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(source.tenant_id::text,0));
 SELECT * INTO source FROM public.topics WHERE id=p_topic FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Thema nicht mehr vorhanden.' USING ERRCODE='22023'; END IF;
 SELECT * INTO existing FROM public.topic_catalog_links WHERE topic_id=p_topic AND tenant_id=source.tenant_id;
 IF FOUND THEN
  IF existing.kind<>p_kind OR (p_kind='region' AND NOT EXISTS(SELECT 1 FROM regions WHERE id=existing.region_id AND kind=p_region_kind)) THEN RAISE EXCEPTION 'Das Thema wurde bereits einem anderen Bereichstyp zugeordnet.' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('id',coalesce(existing.committee_id,existing.region_id),'kind',p_kind,'reused',true);
 END IF;
 label:=coalesce(nullif(btrim(source.label),''),source.name);
 IF p_kind='committee' THEN
  INSERT INTO public.committees(tenant_id,name,is_active) VALUES(source.tenant_id,label,true) ON CONFLICT(tenant_id,name) DO UPDATE SET is_active=true RETURNING id INTO target;
 ELSE
  INSERT INTO public.regions(tenant_id,name,kind,is_active) VALUES(source.tenant_id,label,p_region_kind,true) ON CONFLICT(tenant_id,kind,name) DO UPDATE SET is_active=true RETURNING id INTO target;
 END IF;
 col:=p_kind||'_id';
 -- Existing target responsibilities retain the stronger level; other primaries are untouched.
 EXECUTE format('UPDATE employee_responsibilities dst SET level=''primary'' FROM employee_responsibilities src WHERE src.topic_id=$1 AND src.tenant_id=$2 AND dst.tenant_id=$2 AND dst.%I=$3 AND dst.user_id=src.user_id AND src.level=''primary''',col) USING p_topic,source.tenant_id,target;
 EXECUTE format('DELETE FROM employee_responsibilities src WHERE src.topic_id=$1 AND src.tenant_id=$2 AND EXISTS(SELECT 1 FROM employee_responsibilities dst WHERE dst.tenant_id=$2 AND dst.%I=$3 AND dst.user_id=src.user_id)',col) USING p_topic,source.tenant_id,target;
 EXECUTE format('UPDATE employee_responsibilities SET kind=$3,topic_id=NULL,%I=$4 WHERE topic_id=$1 AND tenant_id=$2',col) USING p_topic,source.tenant_id,p_kind,target;
 INSERT INTO public.topic_catalog_links(tenant_id,topic_id,kind,committee_id,region_id) VALUES(source.tenant_id,p_topic,p_kind,CASE WHEN p_kind='committee' THEN target END,CASE WHEN p_kind='region' THEN target END);
 -- Keep the source and every existing case/contact/document link for history.
 UPDATE public.topics SET is_active=false WHERE id=p_topic AND tenant_id=source.tenant_id;
 RETURN jsonb_build_object('id',target,'kind',p_kind,'reused',false);
END $$;
REVOKE ALL ON FUNCTION public.convert_topic_to_catalog(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_topic_to_catalog(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_employee_responsibility(
 p_tenant uuid, p_user uuid, p_kind text, p_reference text, p_level text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_ref uuid;
BEGIN
 IF NOT user_belongs_to_tenant(p_tenant) OR NOT is_tenant_config_admin(p_tenant) THEN
  RAISE EXCEPTION 'Nur Abgeordnete und Büroleitung dürfen Zuständigkeiten ändern.' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_user AND is_active) THEN
  RAISE EXCEPTION 'Person gehört nicht zum Büro.' USING ERRCODE='42501';
 END IF;
 IF p_kind NOT IN ('topic','committee','region','role_focus') OR p_kind IS NULL OR p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 1 AND 120
 OR (p_level IS NOT NULL AND p_level NOT IN ('primary','secondary')) THEN
  RAISE EXCEPTION 'Ungültige Zuständigkeit.' USING ERRCODE='22023';
 END IF;
 IF p_kind <> 'role_focus' THEN v_ref := p_reference::uuid; END IF;
 -- Serialize profile edits and merges inside one tenant, including first inserts.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text, 0));
 IF p_kind='topic' AND p_level IS NOT NULL AND EXISTS(SELECT 1 FROM topic_catalog_links WHERE tenant_id=p_tenant AND topic_id=v_ref) THEN RAISE EXCEPTION 'Dieses Thema wird bereits als Ausschuss oder Region geführt.' USING ERRCODE='22023'; END IF;
 SELECT id INTO v_id FROM employee_responsibilities WHERE tenant_id=p_tenant AND user_id=p_user AND kind=p_kind
 AND coalesce(topic_id::text,committee_id::text,region_id::text,lower(btrim(role_focus))) = CASE WHEN p_kind='role_focus' THEN lower(btrim(p_reference)) ELSE v_ref::text END;
 IF p_level IS NULL THEN DELETE FROM employee_responsibilities WHERE id=v_id; RETURN v_id; END IF;
 IF v_id IS NOT NULL THEN UPDATE employee_responsibilities SET level=p_level WHERE id=v_id; RETURN v_id; END IF;
 INSERT INTO employee_responsibilities(tenant_id,user_id,kind,topic_id,committee_id,region_id,role_focus,level)
 VALUES(p_tenant,p_user,p_kind,CASE WHEN p_kind='topic' THEN v_ref END,CASE WHEN p_kind='committee' THEN v_ref END,
 CASE WHEN p_kind='region' THEN v_ref END,CASE WHEN p_kind='role_focus' THEN btrim(p_reference) END,p_level) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.set_employee_responsibility(uuid,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_employee_responsibility(uuid,uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_topics(p_source uuid, p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s topics; t topics; r record; v_cond text;
BEGIN
  SELECT * INTO s FROM topics WHERE id=p_source;
  IF s.id IS NULL OR NOT user_belongs_to_tenant(s.tenant_id) OR NOT is_tenant_config_admin(s.tenant_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(s.tenant_id::text,0));
  SELECT * INTO s FROM topics WHERE id = p_source FOR UPDATE;
  SELECT * INTO t FROM topics WHERE id = p_target FOR UPDATE;
  IF s.id IS NULL OR t.id IS NULL OR s.id = t.id OR s.tenant_id <> t.tenant_id THEN
    RAISE EXCEPTION 'Ungültige Themen' USING ERRCODE='22023';
  END IF;
  IF NOT is_tenant_config_admin(s.tenant_id) THEN
    RAISE EXCEPTION 'Nur Abgeordnete und Büroleitung können Themen zusammenführen.' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM topic_catalog_links WHERE topic_id IN(p_source,p_target)) THEN RAISE EXCEPTION 'Umgewandelte Themen bitte über den Ausschuss- oder Regionskatalog zusammenführen.' USING ERRCODE='22023'; END IF;
  UPDATE employee_responsibilities dst SET level='primary' FROM employee_responsibilities src
    WHERE src.topic_id=p_source AND dst.topic_id=p_target AND src.user_id=dst.user_id AND src.level='primary';
  DELETE FROM employee_responsibilities src WHERE src.topic_id=p_source AND EXISTS
    (SELECT 1 FROM employee_responsibilities dst WHERE dst.topic_id=p_target AND dst.user_id=src.user_id);
  UPDATE employee_responsibilities SET topic_id=p_target WHERE topic_id=p_source;
  FOR r IN SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'topic_id' AND c.table_name NOT IN ('topics','employee_responsibilities')
  LOOP
    SELECT string_agg(format('x.%1$I IS NOT DISTINCT FROM y.%1$I', column_name), ' AND ') INTO v_cond
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = r.table_name
      AND column_name NOT IN ('id', 'topic_id', 'created_at', 'updated_at', 'created_by');
    v_cond := coalesce(v_cond, 'true');
    EXECUTE format('DELETE FROM public.%1$I x WHERE x.topic_id = $1 AND EXISTS (SELECT 1 FROM public.%1$I y WHERE y.topic_id = $2 AND %2$s)', r.table_name, v_cond) USING p_source, p_target;
    EXECUTE format('UPDATE public.%I SET topic_id = $2 WHERE topic_id = $1', r.table_name) USING p_source, p_target;
  END LOOP;
  DELETE FROM topics WHERE id = p_source;
END $$;
REVOKE ALL ON FUNCTION public.merge_topics(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.merge_topics(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_responsibility_catalog(p_tenant uuid,p_kind text,p_source uuid,p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_table text; v_column text; v_count integer;
BEGIN
 IF NOT user_belongs_to_tenant(p_tenant) OR NOT is_tenant_config_admin(p_tenant) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN ('committee','region') OR p_kind IS NULL OR p_source IS NULL OR p_target IS NULL OR p_source=p_target THEN RAISE EXCEPTION 'Ungültige Zusammenführung.' USING ERRCODE='22023'; END IF;
 v_table := CASE p_kind WHEN 'committee' THEN 'committees' ELSE 'regions' END;
 v_column := p_kind || '_id';
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,0));
 EXECUTE format('SELECT count(*) FROM %I WHERE tenant_id=$1 AND id IN ($2,$3)',v_table) INTO v_count USING p_tenant,p_source,p_target;
 IF v_count<>2 THEN RAISE EXCEPTION 'Einträge gehören nicht zum Büro.' USING ERRCODE='42501'; END IF;
 -- Retain strongest level on collisions, then move remaining references.
 EXECUTE format('UPDATE employee_responsibilities t SET level=''primary'' FROM employee_responsibilities s WHERE s.tenant_id=$1 AND t.tenant_id=$1 AND s.%1$I=$2 AND t.%1$I=$3 AND s.user_id=t.user_id AND s.level=''primary''',v_column) USING p_tenant,p_source,p_target;
 EXECUTE format('DELETE FROM employee_responsibilities s WHERE s.tenant_id=$1 AND s.%1$I=$2 AND EXISTS (SELECT 1 FROM employee_responsibilities t WHERE t.tenant_id=$1 AND t.%1$I=$3 AND t.user_id=s.user_id)',v_column) USING p_tenant,p_source,p_target;
 EXECUTE format('UPDATE employee_responsibilities SET %I=$3 WHERE tenant_id=$1 AND %I=$2',v_column,v_column) USING p_tenant,p_source,p_target;
 EXECUTE format('UPDATE topic_catalog_links SET %I=$3 WHERE tenant_id=$1 AND %I=$2',v_column,v_column) USING p_tenant,p_source,p_target;
 EXECUTE format('DELETE FROM %I WHERE tenant_id=$1 AND id=$2',v_table) USING p_tenant,p_source;
END $$;
REVOKE ALL ON FUNCTION public.merge_responsibility_catalog(uuid,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.merge_responsibility_catalog(uuid,text,uuid,uuid) TO authenticated;
