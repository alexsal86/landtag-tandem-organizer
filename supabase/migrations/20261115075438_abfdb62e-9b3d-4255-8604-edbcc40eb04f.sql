CREATE OR REPLACE FUNCTION public.guard_tenant_references() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE payload jsonb:=to_jsonb(NEW); previous jsonb; target_tenant uuid; parent_tenant uuid; ref record; value text;
BEGIN
 target_tenant:=(payload->>'tenant_id')::uuid;
 IF TG_OP='UPDATE' THEN
  previous:=to_jsonb(OLD);
  IF previous->>'tenant_id' IS DISTINCT FROM payload->>'tenant_id' THEN RAISE EXCEPTION 'Tenant reassignment is forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 FOR ref IN
  SELECT a.attname AS col, pn.nspname AS parent_schema, pc.relname AS parent_table, pa.attname AS parent_col
  FROM pg_constraint f JOIN pg_class pc ON pc.oid=f.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
  JOIN pg_attribute a ON a.attrelid=f.conrelid AND a.attnum=f.conkey[1]
  JOIN pg_attribute pa ON pa.attrelid=f.confrelid AND pa.attnum=f.confkey[1]
  WHERE f.contype='f' AND f.conrelid=TG_RELID AND cardinality(f.conkey)=1
   AND pn.nspname='public' AND pc.relname NOT IN ('profiles','tenants','user_tenant_memberships')
   AND EXISTS(SELECT 1 FROM pg_attribute x WHERE x.attrelid=pc.oid AND x.attname='tenant_id' AND NOT x.attisdropped)
 LOOP
  value:=payload->>ref.col;
  IF value IS NULL THEN CONTINUE; END IF;
  EXECUTE format('SELECT tenant_id FROM %I.%I WHERE %I::text=$1 FOR KEY SHARE',ref.parent_schema,ref.parent_table,ref.parent_col) INTO parent_tenant USING value;
  IF FOUND AND parent_tenant IS DISTINCT FROM target_tenant THEN RAISE EXCEPTION 'Cross-tenant reference is forbidden' USING ERRCODE='42501'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_tenant_references() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relname NOT IN ('profiles','user_tenant_memberships')
 AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='tenant_id' AND NOT a.attisdropped)
 LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS a00_guard_tenant_references ON public.%I',r.relname);
  EXECUTE format('CREATE TRIGGER a00_guard_tenant_references BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_references()',r.relname);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.return_task_ball_after_vote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d record; t record; label text;
BEGIN
 IF NEW.parent_response_id IS NOT NULL THEN RETURN NEW; END IF;
 SELECT id,task_id,created_by,title,tenant_id INTO d FROM task_decisions WHERE id=NEW.decision_id;
 IF d.task_id IS NULL THEN RETURN NEW; END IF;
 SELECT id,timeline,user_id,tenant_id INTO t FROM tasks WHERE id=d.task_id AND tenant_id=d.tenant_id FOR UPDATE;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Decision task belongs to another tenant' USING ERRCODE='42501'; END IF;
 label:=CASE NEW.response_type WHEN 'yes' THEN 'Freigegeben' WHEN 'no' THEN 'Abgelehnt' WHEN 'question' THEN 'Rückfrage' ELSE COALESCE(NEW.response_type,'Votum') END;
 UPDATE tasks SET ball_owner='office',ball_assignee_id=COALESCE(d.created_by,t.user_id),
 next_action=CASE NEW.response_type WHEN 'yes' THEN 'Freigabe umsetzen' WHEN NEW.response_type='question' THEN 'Rückfrage beantworten' ELSE 'Votum umsetzen' END,
 next_action_due=NULL,timeline=COALESCE(t.timeline,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','system','at',now(),'text','Votum zu „'||d.title||'“: '||label||COALESCE(' – '||NULLIF(NEW.comment,''),'')||' · Am Zug: Büro'))
 WHERE id=t.id AND tenant_id=d.tenant_id;
 IF d.created_by IS NOT NULL AND EXISTS(SELECT 1 FROM user_tenant_memberships WHERE user_id=d.created_by AND tenant_id=d.tenant_id AND is_active) THEN
  BEGIN PERFORM create_notification(d.created_by,'task_updated','Votum eingegangen: '||label,d.title,jsonb_build_object('task_id',t.id,'decision_id',d.id,'tenant_id',d.tenant_id),'medium');
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'vote notification failed'; END;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.create_appointment_feedback_entry()'::regprocedure) INTO definition;
 definition:=replace(definition,'WHERE user_id = NEW.user_id','WHERE user_id = NEW.user_id AND tenant_id = NEW.tenant_id');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.create_letter_followup_task()'::regprocedure) INTO definition;
 definition:=replace(definition,'WHERE id = NEW.template_id','WHERE id = NEW.template_id AND tenant_id = NEW.tenant_id');
 EXECUTE definition;
END $$;
CREATE OR REPLACE FUNCTION public.audit_document_deletion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.audit_log_entries(tenant_id,user_id,payload) VALUES(OLD.tenant_id,auth.uid(),jsonb_build_object('action','document.deleted','document_id',OLD.id,'title',OLD.title,'file_name',OLD.file_name,'timestamp',now()));
 RETURN OLD;
END $$;