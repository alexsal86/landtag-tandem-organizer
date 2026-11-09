ALTER TABLE public.field_permissions ADD COLUMN IF NOT EXISTS read_mode text NOT NULL DEFAULT 'mask';
ALTER TABLE public.field_permissions ADD CONSTRAINT field_permissions_read_mode CHECK(read_mode IN ('mask','record'));

CREATE OR REPLACE FUNCTION public.field_read_rule(_tenant uuid,_table text,_column text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE member_role text; setting record;
BEGIN
  IF is_superadmin(auth.uid()) OR coalesce(auth.role(),'')='service_role' THEN RETURN 'allow'; END IF;
  SELECT role INTO member_role FROM user_tenant_memberships WHERE user_id=auth.uid() AND tenant_id=_tenant AND is_active;
  IF NOT FOUND THEN RETURN 'record'; END IF;
  SELECT can_read,read_mode INTO setting FROM field_permissions WHERE tenant_id=_tenant AND table_name=_table AND column_name=_column AND role::text=member_role;
  IF NOT FOUND OR setting.can_read THEN RETURN 'allow'; END IF;
  RETURN setting.read_mode;
END $$;
CREATE OR REPLACE FUNCTION public.field_row_visible(_tenant uuid,_table text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE member_role text; mode text;
BEGIN
  IF is_superadmin(auth.uid()) OR coalesce(auth.role(),'')='service_role' THEN RETURN true; END IF;
  SELECT role INTO member_role FROM user_tenant_memberships WHERE user_id=auth.uid() AND tenant_id=_tenant AND is_active;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM field_permissions WHERE tenant_id=_tenant AND table_name=_table AND role::text=member_role AND NOT can_read AND column_name=ANY(CASE WHEN _table='contacts' THEN ARRAY['phone','email','notes','email_2','email_3','mobile_phone','business_phone'] ELSE ARRAY['content','content_html'] END) AND read_mode='record') THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM field_permissions WHERE tenant_id=_tenant AND table_name=_table AND role::text=member_role AND NOT can_read AND column_name=ANY(CASE WHEN _table='contacts' THEN ARRAY['phone','email','notes','email_2','email_3','mobile_phone','business_phone'] ELSE ARRAY['content','content_html'] END)) THEN
    RETURN current_setting('app.secured_field_read',true)=_table;
  END IF;
  RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.mask_secured_record(_row jsonb,_table text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE column_name text; result jsonb:=_row;
BEGIN
  FOREACH column_name IN ARRAY CASE WHEN _table='contacts' THEN ARRAY['phone','email','notes','email_2','email_3','mobile_phone','business_phone'] ELSE ARRAY['content','content_html'] END LOOP
    IF field_read_rule((_row->>'tenant_id')::uuid,_table,column_name)<>'allow' THEN
      result:=jsonb_set(result,ARRAY[column_name],CASE WHEN _table='letters' THEN '""'::jsonb ELSE 'null'::jsonb END);
    END IF;
  END LOOP;
  RETURN result;
END $$;

-- RLS keeps raw REST/RPC reads closed. Only these invoker readers open the local
-- marker, preserve existing row policies and return masked values before filtering.
CREATE POLICY configured_contact_reads ON public.contacts AS RESTRICTIVE FOR SELECT TO authenticated USING(field_row_visible(tenant_id,'contacts'));
CREATE POLICY configured_letter_reads ON public.letters AS RESTRICTIVE FOR SELECT TO authenticated USING(field_row_visible(tenant_id,'letters'));
CREATE OR REPLACE FUNCTION public.read_secured_contacts(_tenant_id uuid DEFAULT NULL,_ids uuid[] DEFAULT NULL)
RETURNS SETOF public.contacts LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE previous text:=current_setting('app.secured_field_read',true);
BEGIN
  PERFORM set_config('app.secured_field_read','contacts',true);
  RETURN QUERY SELECT (jsonb_populate_record(NULL::public.contacts,mask_secured_record(to_jsonb(c),'contacts'))).* FROM contacts c WHERE (_tenant_id IS NULL OR c.tenant_id=_tenant_id) AND (_ids IS NULL OR c.id=ANY(_ids));
  PERFORM set_config('app.secured_field_read',coalesce(previous,''),true);
EXCEPTION WHEN OTHERS THEN PERFORM set_config('app.secured_field_read',coalesce(previous,''),true); RAISE;
END $$;
CREATE OR REPLACE FUNCTION public.read_secured_letters(_tenant_id uuid DEFAULT NULL,_ids uuid[] DEFAULT NULL)
RETURNS SETOF public.letters LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE previous text:=current_setting('app.secured_field_read',true);
BEGIN
  PERFORM set_config('app.secured_field_read','letters',true);
  RETURN QUERY SELECT (jsonb_populate_record(NULL::public.letters,mask_secured_record(to_jsonb(l),'letters'))).* FROM letters l WHERE (_tenant_id IS NULL OR l.tenant_id=_tenant_id) AND (_ids IS NULL OR l.id=ANY(_ids));
  PERFORM set_config('app.secured_field_read',coalesce(previous,''),true);
EXCEPTION WHEN OTHERS THEN PERFORM set_config('app.secured_field_read',coalesce(previous,''),true); RAISE;
END $$;

-- Shared mutation bridge: JSON parameters are bound; identifiers are validated
-- against real columns; existing RLS and all action/field-write triggers still run.
CREATE OR REPLACE FUNCTION public.mutate_secured_records(_table text,_method text,_ids uuid[],_data jsonb DEFAULT '{}'::jsonb,_upsert boolean DEFAULT false)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE previous text:=current_setting('app.secured_field_read',true); item jsonb; key text; columns text; expressions text; assignments text; row_id uuid; allowed boolean; ids uuid[]:='{}'; member_role text;
BEGIN
  IF _table IS NULL OR _method IS NULL OR _table NOT IN ('contacts','letters') OR _method NOT IN ('POST','PATCH','DELETE') OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Ungültiger Schreibzugriff' USING ERRCODE='42501'; END IF;
  IF _ids IS NULL OR cardinality(_ids)>500 OR _data IS NULL OR jsonb_typeof(_data) NOT IN ('object','array') OR (jsonb_typeof(_data)='array' AND jsonb_array_length(_data)>500) OR (_method='PATCH' AND jsonb_typeof(_data)<>'object') THEN RAISE EXCEPTION 'Ungültige Anfrage' USING ERRCODE='22023'; END IF;
  PERFORM set_config('app.secured_field_read',_table,true);
  IF _method='DELETE' THEN
    -- Return only masked records, then delete with original RLS and action guards.
    RETURN QUERY EXECUTE format('DELETE FROM public.%I t WHERE id=ANY($1) RETURNING mask_secured_record(to_jsonb(t),$2)',_table) USING _ids,_table;
  ELSE
    FOR item IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_data)='array' THEN _data ELSE jsonb_build_array(_data) END) LOOP
      IF jsonb_typeof(item)<>'object' OR item='{}'::jsonb THEN RAISE EXCEPTION 'Ungültiger Datensatz' USING ERRCODE='22023'; END IF;
      IF _method='POST' AND _upsert AND (item->>'id' IS NULL OR NOT (item->>'id')::uuid=ANY(_ids)) THEN RAISE EXCEPTION 'Upsert benötigt passende ID' USING ERRCODE='22023'; END IF;
      columns:=''; expressions:=''; assignments:='';
      FOR key IN SELECT jsonb_object_keys(item) LOOP
        IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=format('public.%I',_table)::regclass AND attname=key AND attnum>0 AND NOT attisdropped AND attgenerated='') THEN RAISE EXCEPTION 'Ungültiges Datenfeld' USING ERRCODE='22023'; END IF;
        -- Masked placeholders must never erase stored secrets while editing another field.
        IF (_method='PATCH' OR _upsert) AND key IN ('phone','email','notes','email_2','email_3','mobile_phone','business_phone','content','content_html') THEN
          EXECUTE format('SELECT bool_or(field_read_rule(tenant_id,$1,$2)<>''allow'') FROM public.%I WHERE id=ANY($3)',_table) INTO allowed USING _table,key,CASE WHEN _method='POST' THEN ARRAY[(item->>'id')::uuid] ELSE _ids END;
          IF allowed THEN
            IF coalesce(item->>key,'')<>'' THEN RAISE EXCEPTION 'Feld ist nicht lesbar' USING ERRCODE='42501'; END IF;
            CONTINUE;
          END IF;
        END IF;
        columns:=columns||format('%I,',key);
        expressions:=expressions||format('(jsonb_populate_record(NULL::public.%I,$1)).%I,',_table,key);
        IF key<>'id' THEN assignments:=assignments||format('%I=(jsonb_populate_record(NULL::public.%I,$1)).%I,',key,_table,key); END IF;
      END LOOP;
      IF _method='POST' THEN
        EXECUTE format('INSERT INTO public.%I(%s) SELECT %s %s RETURNING id',_table,rtrim(columns,','),rtrim(expressions,','),CASE WHEN _upsert THEN format('ON CONFLICT(id) DO UPDATE SET (%s)=(%s)',rtrim(columns,','),rtrim(expressions,',')) ELSE '' END) INTO row_id USING item;
        ids:=array_append(ids,row_id);
      ELSIF assignments<>'' THEN
        FOR row_id IN EXECUTE format('UPDATE public.%I SET %s WHERE id=ANY($2) RETURNING id',_table,rtrim(assignments,',')) USING item,_ids LOOP ids:=array_append(ids,row_id); END LOOP;
      ELSE ids:=_ids;
      END IF;
    END LOOP;
    RETURN QUERY EXECUTE format('SELECT mask_secured_record(to_jsonb(t),$1) FROM public.%I t WHERE id=ANY($2)',_table) USING _table,ids;
  END IF;
  PERFORM set_config('app.secured_field_read',coalesce(previous,''),true);
EXCEPTION WHEN OTHERS THEN PERFORM set_config('app.secured_field_read',coalesce(previous,''),true); RAISE;
END $$;
REVOKE ALL ON FUNCTION public.read_secured_contacts(uuid,uuid[]),public.read_secured_letters(uuid,uuid[]),public.mutate_secured_records(text,text,uuid[],jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_secured_contacts(uuid,uuid[]),public.read_secured_letters(uuid,uuid[]),public.mutate_secured_records(text,text,uuid[],jsonb,boolean) TO authenticated;

-- Preserve embedded joins using invoker readers instead of raw related rows.
DO $$
DECLARE fk record;
BEGIN
  FOR fk IN SELECT c.conrelid::regclass AS child,c.confrelid::regclass AS parent,a.attname AS key FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1] WHERE c.contype='f' AND c.confrelid IN ('public.contacts'::regclass,'public.letters'::regclass) AND cardinality(c.conkey)=1 AND (SELECT count(*) FROM pg_constraint other WHERE other.contype='f' AND other.conrelid=c.conrelid AND other.confrelid=c.confrelid)=1 LOOP
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(_row %s) RETURNS SETOF %s ROWS 1 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $fn$ SELECT * FROM public.%I(NULL,ARRAY[_row.%I]) $fn$',replace(fk.parent::text,'public.','')||'_secured',fk.child,fk.parent,'read_secured_'||replace(fk.parent::text,'public.',''),fk.key);
  END LOOP;
END $$;

-- Known read RPCs must keep the caller's RLS, including the field policies.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('find_contact_duplicates_trgm','get_contact_counts') LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER',fn.signature);
  END LOOP;
END $$;

DO $$
DECLARE fn record; definition text;
BEGIN
  FOR fn IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('get_contact_counts','find_contact_duplicates_trgm') LOOP
    definition:=pg_get_functiondef(fn.oid);
    definition:=replace(definition,'FROM public.contacts c','FROM public.read_secured_contacts(_tenant_id,NULL) c');
    definition:=replace(definition,'from contacts c','from public.read_secured_contacts(p_tenant_id,NULL) c');
    EXECUTE definition;
  END LOOP;
END $$;
DO $$
DECLARE item text;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    FOREACH item IN ARRAY ARRAY['field_permissions','action_permissions','tenant_feature_flags'] LOOP
      IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=item) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',item);
      END IF;
    END LOOP;
  END IF;
END $$;
