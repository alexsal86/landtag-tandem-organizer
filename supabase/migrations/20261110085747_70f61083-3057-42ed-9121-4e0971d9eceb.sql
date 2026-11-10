ALTER TABLE public.annual_tasks ADD COLUMN automation_rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX annual_tasks_automation_rule_unique ON public.annual_tasks(automation_rule_id) WHERE automation_rule_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_annual_automation_rule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.annual_tasks; action jsonb; pos integer; aid uuid; fn text; month_num integer; day_num integer;
BEGIN
 IF TG_OP='DELETE' THEN
   SELECT * INTO a FROM public.annual_tasks WHERE automation_rule_id=OLD.id;
   IF FOUND AND a.execute_function IS NOT NULL THEN RAISE EXCEPTION 'System-Routinen dürfen nicht gelöscht werden'; END IF;
   UPDATE public.annual_tasks SET auto_execute=false WHERE automation_rule_id=OLD.id;
   RETURN OLD;
 END IF;
 SELECT * INTO a FROM public.annual_tasks WHERE automation_rule_id=NEW.id FOR UPDATE;
 IF FOUND AND a.execute_function IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.actions) x WHERE x->>'type'='run_annual_routine' AND x->'payload'->>'annual_task_id'=a.id::text) THEN RAISE EXCEPTION 'Geschützte Systemaktion darf nicht entfernt werden'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(NEW.actions) x WHERE x->>'type'='run_annual_routine') > 1 THEN RAISE EXCEPTION 'Eine Jahresroutine pro Regel'; END IF;
 SELECT x.value, (x.ordinality-1)::integer INTO action,pos FROM jsonb_array_elements(NEW.actions) WITH ORDINALITY x WHERE x.value->>'type'='run_annual_routine';
 IF action IS NULL THEN RETURN NEW; END IF;
 IF NEW.trigger_type NOT IN ('manual','schedule') OR NEW.trigger_config->>'schedule_kind' IS DISTINCT FROM 'annual' THEN RAISE EXCEPTION 'Jahresroutinen brauchen einen jährlichen Stichtag oder manuelle Ausführung'; END IF;
 month_num := (NEW.trigger_config->>'month')::integer;
 day_num := CASE WHEN NEW.trigger_config->>'month_end'='true' THEN NULL ELSE (NEW.trigger_config->>'day')::integer END;
 IF month_num IS NULL OR month_num NOT BETWEEN 1 AND 12 OR (day_num IS NOT NULL AND day_num NOT BETWEEN 1 AND 31) THEN RAISE EXCEPTION 'Ungültiger Jahresstichtag'; END IF;
 aid := NULLIF(action->'payload'->>'annual_task_id','')::uuid;
 fn := NULLIF(action->'payload'->>'system_function','');
 IF aid IS NOT NULL THEN
   SELECT * INTO a FROM public.annual_tasks WHERE id=aid FOR UPDATE;
   IF NOT FOUND OR a.tenant_id<>NEW.tenant_id OR (a.automation_rule_id IS NOT NULL AND a.automation_rule_id<>NEW.id) THEN RAISE EXCEPTION 'Jahresroutine gehört nicht zu dieser Regel oder diesem Büro'; END IF;
   IF fn IS DISTINCT FROM a.execute_function THEN RAISE EXCEPTION 'Systemaktion darf nicht verändert werden'; END IF;
 ELSE
   IF fn IS NOT NULL AND fn NOT IN ('execute_reset_vacation_days','execute_archive_sick_days','execute_expire_carry_over','generate_current_year_stats') THEN RAISE EXCEPTION 'Unbekannte Systemaktion'; END IF;
   aid := gen_random_uuid();
   INSERT INTO public.annual_tasks(id,tenant_id,title,category,due_month,due_day,is_system_task,execute_function) VALUES(aid,NEW.tenant_id,NEW.name,'admin',month_num,day_num,fn IS NOT NULL,fn);
 END IF;
 UPDATE public.annual_tasks SET title=COALESCE(NULLIF(action->'payload'->>'title',''),NEW.name), description=NULLIF(action->'payload'->>'message',''), category=COALESCE(NULLIF(action->'payload'->>'routine_category',''),'admin'), due_month=month_num,due_day=day_num,auto_execute=(NEW.enabled AND NEW.trigger_type='schedule'),automation_rule_id=NEW.id WHERE id=aid;
 NEW.actions := jsonb_set(NEW.actions,ARRAY[pos::text,'payload','annual_task_id'],to_jsonb(aid::text));
 RETURN NEW;
END $$;
CREATE TRIGGER sync_annual_automation_rule BEFORE INSERT OR UPDATE OR DELETE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.sync_annual_automation_rule();

DO $$ DECLARE a public.annual_tasks; owner_id uuid; rule_id uuid; BEGIN
 FOR a IN SELECT * FROM public.annual_tasks WHERE tenant_id IS NOT NULL AND automation_rule_id IS NULL LOOP
   SELECT m.user_id INTO owner_id FROM public.user_tenant_memberships m JOIN auth.users u ON u.id=m.user_id WHERE m.tenant_id=a.tenant_id AND m.is_active AND m.role IN ('abgeordneter','bueroleitung') ORDER BY CASE m.role WHEN 'abgeordneter' THEN 0 ELSE 1 END,m.user_id LIMIT 1;
   IF owner_id IS NULL THEN CONTINUE; END IF;
   rule_id:=gen_random_uuid();
   INSERT INTO public.automation_rules(id,tenant_id,name,description,module,trigger_type,trigger_config,conditions,actions,enabled,created_by)
   VALUES(rule_id,a.tenant_id,a.title,a.description,'tasks',CASE WHEN a.auto_execute THEN 'schedule' ELSE 'manual' END,
     jsonb_build_object('schedule_kind','annual','month',a.due_month::text,'day',COALESCE(a.due_day,1)::text,'month_end',CASE WHEN a.due_day IS NULL THEN 'true' ELSE 'false' END,'hour','9','timezone','Europe/Berlin','minutes_interval','60'),'{"all":[]}',
     jsonb_build_array(jsonb_build_object('type','run_annual_routine','payload',jsonb_build_object('annual_task_id',a.id::text,'system_function',COALESCE(a.execute_function,''),'title',a.title,'message',COALESCE(a.description,''),'routine_category',a.category,'assigned_to',''))),true,owner_id);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION automation_private.spawn_annual_task_to_stafette(_annual_task_id uuid,_year integer,_assignee uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.annual_tasks; c public.annual_task_completions; v_owner uuid; v_creator uuid; v_task uuid:=gen_random_uuid(); v_due date; v_actor text;
BEGIN
 IF auth.uid() IS NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Anmeldung erforderlich'; END IF;
 IF _year IS NULL OR _year<2000 OR _year>2100 THEN RAISE EXCEPTION 'Ungültiges Jahr'; END IF;
 SELECT * INTO a FROM public.annual_tasks WHERE id=_annual_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Jahresaufgabe nicht gefunden'; END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_tenant_admin(auth.uid(),a.tenant_id) THEN RAISE EXCEPTION 'Nur Abgeordnete und Büroleitung dieses Büros dürfen übergeben'; END IF;
 IF a.execute_function IS NOT NULL OR (COALESCE(a.is_system_task,false) AND a.automation_rule_id IS NULL) THEN RAISE EXCEPTION 'System-Routinen werden nicht als Stafetten-Aufgabe übergeben'; END IF;
 INSERT INTO public.annual_task_completions(annual_task_id,year) VALUES(a.id,_year) ON CONFLICT(annual_task_id,year) DO NOTHING;
 SELECT * INTO c FROM public.annual_task_completions WHERE annual_task_id=a.id AND year=_year FOR UPDATE;
 IF c.linked_task_id IS NOT NULL THEN RETURN c.linked_task_id; END IF;
 IF c.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Jahresaufgabe bereits erledigt'; END IF;
 v_creator:=auth.uid();
 IF v_creator IS NULL THEN SELECT created_by INTO v_creator FROM public.automation_rules WHERE id=a.automation_rule_id; END IF;
 IF v_creator IS NULL THEN RAISE EXCEPTION 'Verantwortlicher fehlt'; END IF;
 v_owner:=_assignee;
 IF v_owner IS NULL THEN
   SELECT user_id INTO v_owner FROM public.user_tenant_memberships WHERE tenant_id=a.tenant_id AND is_active AND role='bueroleitung' ORDER BY user_id LIMIT 1;
   v_owner:=COALESCE(v_owner,v_creator);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=a.tenant_id AND user_id=v_owner AND is_active) THEN RAISE EXCEPTION 'Person gehört nicht zum Büro'; END IF;
 v_due:=(make_date(_year,a.due_month,1)+interval '1 month'-interval '1 day')::date;
 IF a.due_day IS NOT NULL THEN v_due:=make_date(_year,a.due_month,LEAST(a.due_day,extract(day FROM v_due)::integer)); END IF;
 SELECT display_name INTO v_actor FROM public.profiles WHERE user_id=v_creator AND tenant_id=a.tenant_id LIMIT 1;
 INSERT INTO public.tasks(id,user_id,tenant_id,title,description,assigned_to,status,priority,category,due_date,ball_owner,ball_assignee_id,next_action,next_action_due,source_type,source_id,timeline)
 VALUES(v_task,v_creator,a.tenant_id,a.title||' ('||_year||')',a.description,v_owner::text,'todo','medium','personal',(v_due+time '17:00') AT TIME ZONE 'Europe/Berlin','office',v_owner,a.title,v_due,'annual_task',c.id,jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','system','at',now(),'actorName',COALESCE(v_actor,'Büro'),'text','Jahresaufgabe '||_year||' ins Büro übergeben')));
 UPDATE public.annual_task_completions SET linked_task_id=v_task WHERE id=c.id;
 RETURN v_task;
END $$;

CREATE OR REPLACE FUNCTION public.execute_annual_automation_routine(_rule_id uuid,_annual_task_id uuid,_year integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.annual_tasks; r public.automation_rules; c public.annual_task_completions; result jsonb; assignee uuid; task_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nur interne Ausführung'; END IF;
 IF _year IS NULL OR _year<2000 OR _year>2100 OR _year<>extract(year FROM now() AT TIME ZONE 'Europe/Berlin')::integer THEN RAISE EXCEPTION 'Nur aktuelles Jahr ausführbar'; END IF;
 SELECT * INTO r FROM public.automation_rules WHERE id=_rule_id;
 SELECT * INTO a FROM public.annual_tasks WHERE id=_annual_task_id FOR UPDATE;
 IF r.id IS NULL OR a.id IS NULL OR a.automation_rule_id<>r.id OR a.tenant_id<>r.tenant_id OR NOT r.enabled THEN RAISE EXCEPTION 'Ungültige Jahresroutine'; END IF;
 IF EXISTS(SELECT 1 FROM public.tenants WHERE id=r.tenant_id AND automations_paused) THEN RAISE EXCEPTION 'Automationen pausiert'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.actions) x WHERE x->>'type'='run_annual_routine' AND x->'payload'->>'annual_task_id'=a.id::text) THEN RAISE EXCEPTION 'Aktion nicht in Regel'; END IF;
 INSERT INTO public.annual_task_completions(annual_task_id,year) VALUES(a.id,_year) ON CONFLICT(annual_task_id,year) DO NOTHING;
 SELECT * INTO c FROM public.annual_task_completions WHERE annual_task_id=a.id AND year=_year FOR UPDATE;
 IF c.completed_at IS NOT NULL OR c.linked_task_id IS NOT NULL THEN RETURN jsonb_build_object('reused',true,'task_id',c.linked_task_id,'completed_at',c.completed_at); END IF;
 IF a.execute_function IS NULL THEN
   SELECT NULLIF(x->'payload'->>'assigned_to','')::uuid INTO assignee FROM jsonb_array_elements(r.actions) x WHERE x->>'type'='run_annual_routine';
   task_id:=automation_private.spawn_annual_task_to_stafette(a.id,_year,assignee);
   RETURN jsonb_build_object('task_id',task_id,'reused',false);
 END IF;
 IF a.execute_function NOT IN ('execute_reset_vacation_days','execute_archive_sick_days','execute_expire_carry_over','generate_current_year_stats') THEN RAISE EXCEPTION 'Unbekannte Systemaktion'; END IF;
 EXECUTE format('SELECT public.%I(p_tenant_id := $1)',a.execute_function) INTO result USING a.tenant_id;
 IF result->>'success'='false' THEN RAISE EXCEPTION 'Systemaktion fehlgeschlagen'; END IF;
 UPDATE public.annual_task_completions SET completed_at=now(),completed_by=NULL,notes='Automation: '||COALESCE(result::text,'erledigt') WHERE id=c.id;
 RETURN jsonb_build_object('completed',true,'result',result,'reused',false);
END $$;
REVOKE ALL ON FUNCTION public.execute_annual_automation_routine(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execute_annual_automation_routine(uuid,uuid,integer) TO service_role;
REVOKE ALL ON FUNCTION public.sync_annual_automation_rule() FROM PUBLIC,anon,authenticated;
