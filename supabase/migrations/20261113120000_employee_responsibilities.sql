-- Tenant-owned catalogs reference global election data; no copied geography.
CREATE TABLE IF NOT EXISTS public.committees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 is_active boolean NOT NULL DEFAULT true, order_index integer NOT NULL DEFAULT 0,
 UNIQUE (tenant_id, id), UNIQUE (tenant_id, name)
);
CREATE TABLE IF NOT EXISTS public.regions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 kind text NOT NULL CHECK (kind IN ('stadtteil','gemeinde')),
 election_district_id uuid REFERENCES public.election_districts(id),
 is_active boolean NOT NULL DEFAULT true, order_index integer NOT NULL DEFAULT 0,
 UNIQUE (tenant_id, id), UNIQUE (tenant_id, kind, name)
);
CREATE UNIQUE INDEX IF NOT EXISTS topics_tenant_id_id_responsibilities ON public.topics(tenant_id,id);
CREATE TABLE IF NOT EXISTS public.employee_responsibilities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), kind text NOT NULL CHECK (kind IN ('topic','committee','region','role_focus')),
 topic_id uuid, committee_id uuid, region_id uuid, role_focus text,
 level text NOT NULL CHECK (level IN ('primary','secondary')), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id,topic_id) REFERENCES public.topics(tenant_id,id),
 FOREIGN KEY (tenant_id,committee_id) REFERENCES public.committees(tenant_id,id),
 FOREIGN KEY (tenant_id,region_id) REFERENCES public.regions(tenant_id,id),
 CHECK (
  (kind='topic' AND topic_id IS NOT NULL AND committee_id IS NULL AND region_id IS NULL AND role_focus IS NULL) OR
  (kind='committee' AND committee_id IS NOT NULL AND topic_id IS NULL AND region_id IS NULL AND role_focus IS NULL) OR
  (kind='region' AND region_id IS NOT NULL AND topic_id IS NULL AND committee_id IS NULL AND role_focus IS NULL) OR
  (kind='role_focus' AND role_focus IS NOT NULL AND length(btrim(role_focus)) BETWEEN 1 AND 120 AND topic_id IS NULL AND committee_id IS NULL AND region_id IS NULL)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS employee_responsibilities_reference ON public.employee_responsibilities
 (tenant_id,user_id,kind,(coalesce(topic_id::text,committee_id::text,region_id::text,lower(btrim(role_focus)))));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['committees','regions','employee_responsibilities'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_read ON public.%I',t);
  EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id))',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
END $$;
-- All mutations are role-checked RPCs. Table owners retain migration/maintenance access.
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

CREATE OR REPLACE FUNCTION public.save_responsibility_catalog(
 p_tenant uuid, p_kind text, p_name text, p_id uuid DEFAULT NULL,
 p_region_kind text DEFAULT 'gemeinde', p_election_district uuid DEFAULT NULL, p_active boolean DEFAULT true
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT user_belongs_to_tenant(p_tenant) OR NOT is_tenant_config_admin(p_tenant) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN ('committee','region') OR p_kind IS NULL THEN RAISE EXCEPTION 'Ungültiger Katalog.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,0));
 IF p_kind='committee' THEN
  IF p_id IS NULL THEN INSERT INTO committees(tenant_id,name) VALUES(p_tenant,btrim(p_name)) RETURNING id INTO v_id;
  ELSE UPDATE committees SET name=btrim(p_name),is_active=p_active WHERE id=p_id AND tenant_id=p_tenant RETURNING id INTO v_id; END IF;
 ELSE
  IF p_id IS NULL THEN INSERT INTO regions(tenant_id,name,kind,election_district_id) VALUES(p_tenant,btrim(p_name),p_region_kind,p_election_district) RETURNING id INTO v_id;
  ELSE UPDATE regions SET name=btrim(p_name),kind=p_region_kind,election_district_id=p_election_district,is_active=p_active WHERE id=p_id AND tenant_id=p_tenant RETURNING id INTO v_id; END IF;
 END IF;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Katalogeintrag nicht gefunden.' USING ERRCODE='22023'; END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.save_responsibility_catalog(uuid,text,text,uuid,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_responsibility_catalog(uuid,text,text,uuid,text,uuid,boolean) TO authenticated;

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
 EXECUTE format('DELETE FROM %I WHERE tenant_id=$1 AND id=$2',v_table) USING p_tenant,p_source;
END $$;
REVOKE ALL ON FUNCTION public.merge_responsibility_catalog(uuid,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.merge_responsibility_catalog(uuid,text,uuid,uuid) TO authenticated;

-- Extend existing topic merge, preserving all other topic links.
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
REVOKE ALL ON FUNCTION public.merge_topics(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_topics(uuid, uuid) TO authenticated;


-- Confirmed suggestions for new tasks and files use existing assignee/Stafette fields.
-- Invoker RLS remains authoritative; membership and ownership are checked explicitly.
CREATE OR REPLACE FUNCTION public.assign_from_responsibility_matrix(p_tenant uuid,p_kind text,p_id uuid,p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_owner uuid; v_ball_user uuid; v_timeline jsonb; v_name text; v_actor_name text; v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT user_belongs_to_tenant(p_tenant) OR NOT EXISTS (
  SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=auth.uid() AND is_active
  AND role IN ('abgeordneter','bueroleitung','mitarbeiter','praktikant')
 ) OR (p_user IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_user AND is_active)) THEN
  RAISE EXCEPTION 'Keine Berechtigung oder Person gehört nicht zum Büro.' USING ERRCODE='42501';
 END IF;
 IF p_kind='task' AND p_user IS NULL THEN RAISE EXCEPTION 'Person fehlt.' USING ERRCODE='22023'; END IF;
 IF p_kind='task' THEN
  SELECT user_id,ball_assignee_id,coalesce(timeline,'[]'::jsonb) INTO v_owner,v_ball_user,v_timeline FROM tasks WHERE id=p_id AND tenant_id=p_tenant FOR UPDATE;
 ELSIF p_kind='case_file' THEN
  SELECT user_id INTO v_owner FROM case_files WHERE id=p_id AND tenant_id=p_tenant FOR UPDATE;
 ELSE RAISE EXCEPTION 'Ungültiger Übergabetyp.' USING ERRCODE='22023'; END IF;
 IF v_owner IS NULL OR (v_owner<>auth.uid() AND NOT is_tenant_config_admin(p_tenant)) THEN
  RAISE EXCEPTION 'Nur eigene Einträge oder Übergabe durch die Leitung.' USING ERRCODE='42501';
 END IF;
 IF p_kind='task' THEN
  IF v_ball_user IS DISTINCT FROM p_user THEN
   SELECT coalesce(display_name,'neue Person') INTO v_name FROM profiles WHERE user_id=p_user;
   SELECT display_name INTO v_actor_name FROM profiles WHERE user_id=auth.uid();
   v_timeline := v_timeline || jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','system','at',now(),'actorName',coalesce(v_actor_name,'Team'),'text','Verantwortlich: '||coalesce(v_name,'neue Person')));
  END IF;
  UPDATE tasks SET ball_assignee_id=p_user,assigned_to=p_user::text,timeline=v_timeline WHERE id=p_id AND tenant_id=p_tenant;
 ELSE UPDATE case_files SET assigned_to=p_user WHERE id=p_id AND tenant_id=p_tenant; END IF;
 GET DIAGNOSTICS v_count = ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'Übergabe durch RLS verweigert.' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.assign_from_responsibility_matrix(uuid,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_from_responsibility_matrix(uuid,text,uuid,uuid) TO authenticated;
