-- Durable, tenant-scoped snapshots: changing a template never rewrites active work.
CREATE TABLE public.routine_package_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
 annual_task_id uuid NOT NULL REFERENCES public.annual_tasks(id) ON DELETE CASCADE,
 year integer NOT NULL, task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE RESTRICT,
 start_day date NOT NULL, finish_day date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(annual_task_id,year), UNIQUE(task_id)
);
CREATE TABLE public.routine_package_steps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES public.routine_package_runs(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK(position BETWEEN 0 AND 19), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 500),
 kind text NOT NULL CHECK(kind IN ('subtask','task','case','decision','jour_fixe')),
 release text NOT NULL CHECK(release IN ('package_start','scheduled','after_previous','after_approval')),
 assignee_id uuid NOT NULL REFERENCES auth.users(id), approver_id uuid REFERENCES auth.users(id), due_day date NOT NULL,
 status text NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','active','completed','blocked','failed')),
 entity_id uuid, approval_id uuid REFERENCES public.task_decisions(id) ON DELETE SET NULL,
 error_message text, attempts integer NOT NULL DEFAULT 0, completed_at timestamptz,
 UNIQUE(run_id,position), CHECK(release<>'after_approval' OR approver_id IS NOT NULL)
);
CREATE INDEX routine_steps_open ON public.routine_package_steps(run_id,status);
ALTER TABLE public.routine_package_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_package_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators read routine packages" ON public.routine_package_runs FOR SELECT TO authenticated USING(public.is_tenant_admin(auth.uid(),tenant_id));
CREATE POLICY "Administrators read routine steps" ON public.routine_package_steps FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.routine_package_runs r WHERE r.id=run_id AND public.is_tenant_admin(auth.uid(),r.tenant_id)));
GRANT SELECT ON public.routine_package_runs,public.routine_package_steps TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.routine_package_runs,public.routine_package_steps FROM authenticated,anon;
GRANT ALL ON public.routine_package_runs,public.routine_package_steps TO service_role;

CREATE OR REPLACE FUNCTION public.office_routine_step_settings(_payload jsonb,_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE settings jsonb; item jsonb; n integer; i integer:=0; first_index integer; person uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=_tenant_id AND user_id=auth.uid() AND is_active) THEN RAISE EXCEPTION 'Kein Zugriff auf dieses Büro' USING ERRCODE='42501'; END IF;
 PERFORM public.office_routine_step_kinds(_payload);
 SELECT count(*) INTO n FROM public.office_routine_steps(_payload->>'routine_steps_text');
 IF coalesce(_payload->>'routine_step_settings','')='' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('release','package_start','assignee','','approver','')),'[]'::jsonb) INTO settings FROM generate_series(1,n);
 ELSE settings:=(_payload->>'routine_step_settings')::jsonb;
 END IF;
 IF jsonb_typeof(settings) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ungültige Schritteinstellungen' USING ERRCODE='22023'; END IF;
 IF coalesce(_payload->>'routine_step_settings','')<>'' AND EXISTS(
   SELECT 1 FROM (SELECT days_before,lag(days_before) OVER(ORDER BY step_index) AS previous_days FROM public.office_routine_steps(_payload->>'routine_steps_text')) s WHERE days_before>previous_days
 ) THEN RAISE EXCEPTION 'Bitte die Schritte nach Zeitpunkt sortieren' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(settings)<>n THEN RAISE EXCEPTION 'Jeder Schritt braucht passende Einstellungen' USING ERRCODE='22023'; END IF;
 SELECT step_index-1 INTO first_index FROM public.office_routine_steps(_payload->>'routine_steps_text') ORDER BY days_before DESC,step_index LIMIT 1;
 FOR item IN SELECT x FROM jsonb_array_elements(settings) x LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR coalesce(item->>'release','') NOT IN ('package_start','scheduled','after_previous','after_approval') THEN RAISE EXCEPTION 'Ungültige Startbedingung' USING ERRCODE='22023'; END IF;
   IF i=first_index AND item->>'release'='after_previous' THEN RAISE EXCEPTION 'Der erste Schritt hat keinen Vorgänger' USING ERRCODE='22023'; END IF;
   IF item->>'release'='after_approval' AND coalesce(item->>'approver','')='' THEN RAISE EXCEPTION 'Freigebende Person fehlt' USING ERRCODE='22023'; END IF;
   FOR person IN SELECT NULLIF(item->>'assignee','')::uuid UNION SELECT NULLIF(item->>'approver','')::uuid LOOP
     IF person IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=_tenant_id AND user_id=person AND is_active) THEN RAISE EXCEPTION 'Eine zuständige Person gehört nicht mehr zum Büro' USING ERRCODE='22023'; END IF;
   END LOOP;
   i:=i+1;
 END LOOP;
 RETURN settings;
END $$;
REVOKE ALL ON FUNCTION public.office_routine_step_settings(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_routine_step_settings(jsonb,uuid) TO authenticated,service_role;

-- Uses only the configured participant's latest response; never fabricates votes.
CREATE FUNCTION automation_private.routine_vote(_decision uuid,_person uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.response_type FROM public.task_decision_participants p JOIN public.task_decision_responses r ON r.participant_id=p.id AND r.decision_id=p.decision_id
 WHERE p.decision_id=_decision AND p.user_id=_person ORDER BY r.updated_at DESC,r.created_at DESC,r.id DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION automation_private.routine_vote(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION automation_private.advance_routine_package(_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pkg public.routine_package_runs; s public.routine_package_steps; parent public.tasks; rid uuid; vote text; done boolean; exists_target boolean;
BEGIN
 SELECT * INTO pkg FROM public.routine_package_runs WHERE id=_run_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.automation_rules r JOIN public.tenants t ON t.id=r.tenant_id WHERE r.id=pkg.rule_id AND r.enabled AND NOT coalesce(t.automations_paused,false)) THEN RETURN; END IF;
 SELECT * INTO parent FROM public.tasks WHERE id=pkg.task_id;
 FOR s IN SELECT * FROM public.routine_package_steps WHERE run_id=pkg.id AND status<>'completed' ORDER BY position FOR UPDATE LOOP
   IF s.status='failed' THEN CONTINUE; END IF;
   BEGIN
     IF s.entity_id IS NOT NULL THEN
       done:=false; exists_target:=false;
       IF s.kind='subtask' THEN SELECT true,is_completed INTO exists_target,done FROM public.subtasks WHERE id=s.entity_id AND task_id=pkg.task_id;
       ELSIF s.kind='task' THEN SELECT true,status='completed' INTO exists_target,done FROM public.tasks WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
       ELSIF s.kind IN ('case','jour_fixe') THEN SELECT true,status IN ('erledigt','archiviert') INTO exists_target,done FROM public.case_items WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
       ELSE
         SELECT true INTO exists_target FROM public.task_decisions WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
         vote:=automation_private.routine_vote(s.entity_id,s.assignee_id);
         done:=vote='yes';
         IF vote='no' THEN UPDATE public.routine_package_steps SET status='blocked',error_message='Entscheidung abgelehnt. Die entscheidende Person muss ihr Votum ändern, bevor der Ablauf weitergeht.' WHERE id=s.id; CONTINUE; END IF;
       END IF;
       IF NOT coalesce(exists_target,false) THEN RAISE EXCEPTION 'Der verknüpfte Eintrag wurde gelöscht. Er wird nicht automatisch neu angelegt.'; END IF;
       UPDATE public.routine_package_steps SET status=CASE WHEN coalesce(done,false) THEN 'completed' ELSE 'active' END,completed_at=CASE WHEN coalesce(done,false) THEN now() ELSE NULL END,error_message=NULL WHERE id=s.id;
       CONTINUE;
     END IF;
     IF s.release='scheduled' AND s.due_day>(now() AT TIME ZONE 'Europe/Berlin')::date THEN CONTINUE; END IF;
     IF s.release='after_previous' AND NOT EXISTS(SELECT 1 FROM public.routine_package_steps WHERE run_id=pkg.id AND position=s.position-1 AND status='completed') THEN CONTINUE; END IF;
     IF NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=pkg.tenant_id AND user_id=s.assignee_id AND is_active) THEN RAISE EXCEPTION 'Die zuständige Person ist nicht mehr im Büro aktiv. Bitte die Zuständigkeit ändern.'; END IF;
     IF s.release='after_approval' THEN
       IF NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=pkg.tenant_id AND user_id=s.approver_id AND is_active) THEN RAISE EXCEPTION 'Die freigebende Person ist nicht mehr im Büro aktiv.'; END IF;
       IF s.approval_id IS NULL THEN
         INSERT INTO public.task_decisions(task_id,tenant_id,created_by,title,description,status,response_deadline,visible_to_all)
         VALUES(pkg.task_id,pkg.tenant_id,parent.user_id,'Freigabe: '||s.title,'Bitte diesen Schritt aus dem Aufgabenpaket freigeben: '||parent.title,'active',(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin',false) RETURNING id INTO rid;
         INSERT INTO public.task_decision_participants(decision_id,user_id) VALUES(rid,s.approver_id);
         UPDATE public.routine_package_steps SET approval_id=rid,error_message=NULL WHERE id=s.id;
         CONTINUE;
       END IF;
       vote:=automation_private.routine_vote(s.approval_id,s.approver_id);
       IF vote IS DISTINCT FROM 'yes' THEN
         UPDATE public.routine_package_steps SET status=CASE WHEN vote='no' THEN 'blocked' ELSE 'waiting' END,error_message=CASE WHEN vote='no' THEN 'Freigabe abgelehnt. Der Schritt bleibt angehalten.' ELSE NULL END WHERE id=s.id;
         CONTINUE;
       END IF;
     END IF;
     IF s.kind='subtask' THEN
       INSERT INTO public.subtasks(task_id,user_id,description,assigned_to,due_date,order_index,is_completed)
       VALUES(pkg.task_id,parent.user_id,s.title,s.assignee_id::text,(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin',s.position,false) RETURNING id INTO rid;
     ELSIF s.kind='task' THEN
       INSERT INTO public.tasks(user_id,tenant_id,title,description,assigned_to,parent_task_id,status,priority,category,due_date,ball_owner,ball_assignee_id,next_action,next_action_due,source_type,source_id,timeline)
       VALUES(parent.user_id,pkg.tenant_id,s.title,'Aus Aufgabenpaket: '||parent.title,s.assignee_id::text,pkg.task_id,'todo','medium','personal',(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin','office',s.assignee_id,s.title,s.due_day,'annual_routine_step',s.id,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'text','Aus Routine: '||parent.title))) RETURNING id INTO rid;
     ELSIF s.kind IN ('case','jour_fixe') THEN
       INSERT INTO public.case_items(user_id,tenant_id,subject,summary,owner_user_id,source_channel,status,priority,due_at,ball_owner,next_action_assignee_id,next_action_label,next_action_due_at,pending_for_jour_fixe,source_reference,intake_payload)
       VALUES(parent.user_id,pkg.tenant_id,s.title,'Aus Aufgabenpaket: '||parent.title,s.assignee_id,'other','neu','medium',(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin','office',s.assignee_id,s.title,(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin',s.kind='jour_fixe','Aufgabenpaket: '||pkg.task_id::text,jsonb_build_object('routine_task_id',pkg.task_id,'routine_step_id',s.id)) RETURNING id INTO rid;
     ELSE
       INSERT INTO public.task_decisions(task_id,tenant_id,created_by,title,description,status,response_deadline,visible_to_all)
       VALUES(pkg.task_id,pkg.tenant_id,parent.user_id,s.title,'Aus Aufgabenpaket: '||parent.title,'active',(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin',false) RETURNING id INTO rid;
       INSERT INTO public.task_decision_participants(decision_id,user_id) VALUES(rid,s.assignee_id);
     END IF;
     UPDATE public.routine_package_steps SET entity_id=rid,status='active',error_message=NULL,attempts=attempts+1 WHERE id=s.id;
   EXCEPTION WHEN OTHERS THEN
     -- The entire step subtransaction rolls back, including its target and invitations.
     UPDATE public.routine_package_steps SET status='failed',error_message=left(SQLERRM,1000),attempts=attempts+1 WHERE id=s.id;
   END;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.routine_package_steps WHERE run_id=pkg.id) AND NOT EXISTS(SELECT 1 FROM public.routine_package_steps WHERE run_id=pkg.id AND status<>'completed') AND NOT EXISTS(SELECT 1 FROM public.subtasks WHERE task_id=pkg.task_id AND NOT is_completed) AND NOT EXISTS(SELECT 1 FROM public.tasks WHERE parent_task_id=pkg.task_id AND status<>'completed') THEN
   UPDATE public.tasks SET status='completed' WHERE id=pkg.task_id AND status<>'completed';
 END IF;
END $$;
REVOKE ALL ON FUNCTION automation_private.advance_routine_package(uuid) FROM PUBLIC,anon,authenticated;

-- Service-only periodic dispatcher continues snapshots across year boundaries.
CREATE FUNCTION automation_private.dispatch_routine_packages() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid;
BEGIN
 FOR rid IN SELECT DISTINCT r.id FROM public.routine_package_runs r JOIN public.routine_package_steps s ON s.run_id=r.id WHERE s.status IN ('waiting','active','blocked') ORDER BY r.id LOOP
  BEGIN PERFORM automation_private.advance_routine_package(rid); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Routine package %: %',rid,SQLERRM; END;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION automation_private.dispatch_routine_packages() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('advance-routine-packages','*/15 * * * *','SELECT automation_private.dispatch_routine_packages()');

CREATE OR REPLACE FUNCTION public.validate_office_routine_package()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE action jsonb; payload jsonb;
BEGIN
 IF TG_OP='UPDATE' AND NEW.actions IS NOT DISTINCT FROM OLD.actions AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id AND NEW.trigger_config IS NOT DISTINCT FROM OLD.trigger_config THEN RETURN NEW; END IF;
 FOR action IN SELECT x FROM jsonb_array_elements(NEW.actions) x WHERE x->>'type'='run_annual_routine' LOOP
  payload:=action->'payload';
  PERFORM public.office_routine_step_settings(payload,NEW.tenant_id);
  IF coalesce(payload->>'routine_steps_text','')<>'' OR payload->>'routine_requires_confirmation'='true' THEN
   IF coalesce(payload->>'routine_deadline_month','')='' OR coalesce(payload->>'routine_deadline_day','')='' THEN RAISE EXCEPTION 'Aufgabenpaket braucht einen Abschlusstermin' USING ERRCODE='22023'; END IF;
  END IF;
  PERFORM office_routine_deadline(payload,make_date(2026,(NEW.trigger_config->>'month')::integer,1));
  IF coalesce(payload->>'system_function','')<>'' AND (coalesce(payload->>'routine_steps_text','')<>'' OR coalesce(payload->>'routine_deadline_month','')<>'' OR payload->>'routine_requires_confirmation'='true') THEN RAISE EXCEPTION 'Systemaktionen sind keine Büro-Aufgabenpakete' USING ERRCODE='22023'; END IF;
  IF coalesce(payload->>'routine_confirmed_year','')<>'' AND payload->>'routine_confirmed_year' !~ '^(20[0-9]{2}|2100)$' THEN RAISE EXCEPTION 'Ungültiges Bestätigungsjahr' USING ERRCODE='22023'; END IF;
 END LOOP;
 RETURN NEW;
END $$;


CREATE OR REPLACE FUNCTION public.execute_annual_automation_routine(_rule_id uuid,_annual_task_id uuid,_year integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.annual_tasks; r public.automation_rules; c public.annual_task_completions; result jsonb; assignee uuid; task_id uuid; payload jsonb; start_day date; finish_day date; step record; task_row public.tasks; step_no integer:=0; kinds jsonb; kind text; step_due date; entity_id uuid; owner_id uuid; settings jsonb; setting jsonb; run_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nur interne Ausführung'; END IF;
 IF _year IS NULL OR _year<2000 OR _year>2100 OR _year<>extract(year FROM now() AT TIME ZONE 'Europe/Berlin')::integer THEN RAISE EXCEPTION 'Nur aktuelles Jahr ausführbar'; END IF;
 SELECT * INTO r FROM public.automation_rules WHERE id=_rule_id;
 SELECT * INTO a FROM public.annual_tasks WHERE id=_annual_task_id FOR UPDATE;
 IF r.id IS NULL OR a.id IS NULL OR a.automation_rule_id<>r.id OR a.tenant_id<>r.tenant_id OR NOT r.enabled THEN RAISE EXCEPTION 'Ungültige Jahresroutine'; END IF;
 IF EXISTS(SELECT 1 FROM public.tenants WHERE id=r.tenant_id AND automations_paused) THEN RAISE EXCEPTION 'Automationen pausiert'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.actions) x WHERE x->>'type'='run_annual_routine' AND x->'payload'->>'annual_task_id'=a.id::text) THEN RAISE EXCEPTION 'Aktion nicht in Regel'; END IF;
 SELECT x->'payload' INTO payload FROM jsonb_array_elements(r.actions) x WHERE x->>'type'='run_annual_routine';
 kinds:=public.office_routine_step_kinds(payload);
 settings:=public.office_routine_step_settings(payload,r.tenant_id);
 IF payload->>'routine_requires_confirmation'='true' AND payload->>'routine_confirmed_year' IS DISTINCT FROM _year::text THEN RAISE EXCEPTION 'Jahrestermine müssen zuerst bestätigt werden' USING ERRCODE='22023'; END IF;
 INSERT INTO public.annual_task_completions(annual_task_id,year) VALUES(a.id,_year) ON CONFLICT(annual_task_id,year) DO NOTHING;
 SELECT * INTO c FROM public.annual_task_completions WHERE annual_task_id=a.id AND year=_year FOR UPDATE;
 IF c.completed_at IS NOT NULL OR c.linked_task_id IS NOT NULL THEN
   SELECT id INTO run_id FROM public.routine_package_runs pr WHERE pr.task_id=c.linked_task_id;
   IF run_id IS NOT NULL THEN PERFORM automation_private.advance_routine_package(run_id); END IF;
   RETURN jsonb_build_object('reused',true,'task_id',c.linked_task_id,'completed_at',c.completed_at); END IF;
 IF a.execute_function IS NULL THEN
   SELECT NULLIF(x->'payload'->>'assigned_to','')::uuid INTO assignee FROM jsonb_array_elements(r.actions) x WHERE x->>'type'='run_annual_routine';
   task_id:=automation_private.spawn_annual_task_to_stafette(a.id,_year,assignee);
   SELECT * INTO task_row FROM public.tasks WHERE id=task_id;
   start_day:=make_date(_year,a.due_month,LEAST(coalesce(a.due_day,31),extract(day FROM (make_date(_year,a.due_month,1)+interval '1 month'-interval '1 day'))::integer));
   finish_day:=office_routine_deadline(payload,start_day);
   IF finish_day<>start_day THEN UPDATE public.tasks SET due_date=(finish_day+time '17:00') AT TIME ZONE 'Europe/Berlin',next_action_due=finish_day WHERE id=task_id; END IF;
   INSERT INTO public.routine_package_runs(tenant_id,rule_id,annual_task_id,year,task_id,start_day,finish_day)
   VALUES(r.tenant_id,r.id,a.id,_year,task_id,start_day,finish_day) RETURNING id INTO run_id;
   FOR step IN SELECT * FROM office_routine_steps(payload->>'routine_steps_text') ORDER BY days_before DESC,step_index LOOP
     setting:=settings->(step.step_index-1);
     INSERT INTO public.routine_package_steps(run_id,position,title,kind,release,assignee_id,approver_id,due_day)
     VALUES(run_id,step_no,step.description,kinds->>(step.step_index-1),setting->>'release',coalesce(NULLIF(setting->>'assignee','')::uuid,task_row.ball_assignee_id,task_row.user_id),NULLIF(setting->>'approver','')::uuid,GREATEST(start_day,finish_day-step.days_before));
     IF step_no=0 THEN UPDATE public.tasks SET next_action=step.description,next_action_due=GREATEST(start_day,finish_day-step.days_before) WHERE id=task_id; END IF;
     step_no:=step_no+1;
   END LOOP;
   PERFORM automation_private.advance_routine_package(run_id);
   RETURN jsonb_build_object('task_id',task_id,'reused',false,'steps',step_no,'deadline',finish_day);
 END IF;
 IF a.execute_function NOT IN ('execute_reset_vacation_days','execute_archive_sick_days','execute_expire_carry_over','generate_current_year_stats') THEN RAISE EXCEPTION 'Unbekannte Systemaktion'; END IF;
 EXECUTE format('SELECT public.%I(p_tenant_id := $1)',a.execute_function) INTO result USING a.tenant_id;
 IF result->>'success'='false' THEN RAISE EXCEPTION 'Systemaktion fehlgeschlagen'; END IF;
 UPDATE public.annual_task_completions SET completed_at=now(),completed_by=NULL,notes='Automation: '||COALESCE(result::text,'erledigt') WHERE id=c.id;
 RETURN jsonb_build_object('completed',true,'result',result,'reused',false);
END $$;

-- A parent cannot close while a dependent step or an explicit approval is open.
CREATE FUNCTION public.guard_open_routine_package() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS(
   SELECT 1 FROM public.routine_package_runs r JOIN public.routine_package_steps s ON s.run_id=r.id WHERE r.task_id=NEW.id AND s.status<>'completed'
 ) THEN RAISE EXCEPTION 'Dieses Aufgabenpaket hat noch offene Schritte. Bitte zuerst den Ablauf in der Jahresübersicht aktualisieren und abschließen.' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_open_routine_package() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_open_routine_package BEFORE UPDATE OF status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.guard_open_routine_package();

CREATE FUNCTION public.refresh_routine_package(_run_id uuid,_retry_step_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pkg public.routine_package_runs;
BEGIN
 SELECT * INTO pkg FROM public.routine_package_runs WHERE id=_run_id FOR UPDATE;
 IF NOT FOUND OR public.is_tenant_admin(auth.uid(),pkg.tenant_id) IS NOT TRUE THEN RAISE EXCEPTION 'Keine Berechtigung für diesen Ablauf' USING ERRCODE='42501'; END IF;
 IF _retry_step_id IS NOT NULL THEN
   UPDATE public.routine_package_steps SET status='waiting',error_message=NULL WHERE id=_retry_step_id AND run_id=pkg.id AND status='failed' AND entity_id IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'Nur fehlgeschlagene Schritte ohne erzeugten Eintrag können wiederholt werden'; END IF;
 END IF;
 PERFORM automation_private.advance_routine_package(pkg.id);
END $$;
REVOKE ALL ON FUNCTION public.refresh_routine_package(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_routine_package(uuid,uuid) TO authenticated;

CREATE FUNCTION public.get_routine_packages(_rule_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('steps',(
   SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.position),'[]'::jsonb) FROM public.routine_package_steps s WHERE s.run_id=r.id
 )) ORDER BY r.year DESC,r.created_at DESC),'[]'::jsonb)
 FROM (SELECT p.* FROM public.routine_package_runs p WHERE p.rule_id=ANY(_rule_ids) AND public.is_tenant_admin(auth.uid(),p.tenant_id)
 ORDER BY EXISTS(SELECT 1 FROM public.routine_package_steps s WHERE s.run_id=p.id AND s.status<>'completed') DESC,p.created_at DESC LIMIT 200) r
$$;
REVOKE ALL ON FUNCTION public.get_routine_packages(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_routine_packages(uuid[]) TO authenticated;

-- Explicit opt-in updates only untouched steps. Started work and approvals are immutable.
CREATE FUNCTION public.update_waiting_routine_steps(_run_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pkg public.routine_package_runs; rule public.automation_rules; payload jsonb; kinds jsonb; settings jsonb; setting jsonb; step record; current_step public.routine_package_steps; pos integer:=0; changed integer:=0; default_owner uuid;
BEGIN
 SELECT * INTO pkg FROM public.routine_package_runs WHERE id=_run_id FOR UPDATE;
 IF NOT FOUND OR public.is_tenant_admin(auth.uid(),pkg.tenant_id) IS NOT TRUE THEN RAISE EXCEPTION 'Keine Berechtigung für diesen Ablauf' USING ERRCODE='42501'; END IF;
 SELECT * INTO rule FROM public.automation_rules WHERE id=pkg.rule_id AND tenant_id=pkg.tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Die Vorlage existiert nicht mehr'; END IF;
 SELECT x->'payload' INTO payload FROM jsonb_array_elements(rule.actions) x WHERE x->>'type'='run_annual_routine';
 IF payload IS NULL OR coalesce(payload->>'system_function','')<>'' THEN RAISE EXCEPTION 'Die Vorlage ist kein Büro-Aufgabenpaket mehr'; END IF;
 IF public.office_routine_deadline(payload,pkg.start_day)<>pkg.finish_day THEN RAISE EXCEPTION 'Der Abschluss eines laufenden Pakets bleibt unverändert. Bitte den ursprünglichen Abschlusstermin in der Vorlage beibehalten oder die Änderung erst für neue Pakete verwenden.'; END IF;
 kinds:=public.office_routine_step_kinds(payload); settings:=public.office_routine_step_settings(payload,pkg.tenant_id);
 IF jsonb_array_length(kinds)<>(SELECT count(*) FROM public.routine_package_steps WHERE run_id=pkg.id) THEN RAISE EXCEPTION 'Schritte wurden hinzugefügt oder entfernt. Solche Strukturänderungen gelten für neue Pakete.'; END IF;
 SELECT coalesce(ball_assignee_id,user_id) INTO default_owner FROM public.tasks WHERE id=pkg.task_id;
 FOR step IN SELECT * FROM public.office_routine_steps(payload->>'routine_steps_text') ORDER BY days_before DESC,step_index LOOP
   SELECT * INTO current_step FROM public.routine_package_steps WHERE run_id=pkg.id AND position=pos FOR UPDATE;
   setting:=settings->(step.step_index-1);
   IF current_step.entity_id IS NOT NULL OR current_step.approval_id IS NOT NULL OR current_step.status NOT IN ('waiting','failed') THEN
     IF current_step.title<>step.description OR current_step.kind<>(kinds->>(step.step_index-1)) THEN RAISE EXCEPTION 'Bereits gestartete Schritte wurden verändert oder umgeordnet. Diese Vorlagenänderung gilt nur für neue Pakete.'; END IF;
   ELSE
     UPDATE public.routine_package_steps SET title=step.description,kind=kinds->>(step.step_index-1),release=setting->>'release',assignee_id=coalesce(NULLIF(setting->>'assignee','')::uuid,default_owner),approver_id=NULLIF(setting->>'approver','')::uuid,due_day=GREATEST(pkg.start_day,pkg.finish_day-step.days_before),status='waiting',error_message=NULL WHERE id=current_step.id;
     changed:=changed+1;
   END IF;
   pos:=pos+1;
 END LOOP;
 -- Deliberately do not activate new work here; the user can inspect then refresh.
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.update_waiting_routine_steps(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_waiting_routine_steps(uuid) TO authenticated;

-- Explicitly repair a responsibility on an open snapshot without re-creating its target.
CREATE FUNCTION public.reassign_routine_step(_step_id uuid,_assignee_id uuid,_approver_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pkg public.routine_package_runs; s public.routine_package_steps; person uuid; approver uuid;
BEGIN
 SELECT r.* INTO pkg FROM public.routine_package_runs r JOIN public.routine_package_steps x ON x.run_id=r.id WHERE x.id=_step_id FOR UPDATE OF r;
 IF NOT FOUND OR public.is_tenant_admin(auth.uid(),pkg.tenant_id) IS NOT TRUE THEN RAISE EXCEPTION 'Keine Berechtigung für diesen Ablauf' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.routine_package_steps WHERE id=_step_id FOR UPDATE;
 IF s.status='completed' THEN RAISE EXCEPTION 'Abgeschlossene Schritte behalten ihre Zuständigkeit'; END IF;
 approver:=coalesce(_approver_id,s.approver_id);
 IF _assignee_id IS NULL THEN RAISE EXCEPTION 'Bitte eine zuständige Person auswählen'; END IF;
 FOR person IN SELECT _assignee_id UNION SELECT approver LOOP
   IF person IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=pkg.tenant_id AND user_id=person AND is_active) THEN RAISE EXCEPTION 'Die ausgewählte Person ist nicht im Büro aktiv'; END IF;
 END LOOP;
 IF s.entity_id IS NOT NULL AND approver IS DISTINCT FROM s.approver_id THEN RAISE EXCEPTION 'Der Schritt wurde bereits freigegeben und gestartet. Seine Freigabe bleibt unverändert.'; END IF;
 IF s.entity_id IS NOT NULL THEN
   IF s.kind='subtask' THEN UPDATE public.subtasks SET assigned_to=_assignee_id::text WHERE id=s.entity_id AND task_id=pkg.task_id;
   ELSIF s.kind='task' THEN UPDATE public.tasks SET assigned_to=_assignee_id::text,ball_assignee_id=_assignee_id WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
   ELSIF s.kind IN ('case','jour_fixe') THEN UPDATE public.case_items SET owner_user_id=_assignee_id,next_action_assignee_id=_assignee_id WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
   ELSE
     PERFORM 1 FROM public.task_decisions WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
     IF NOT FOUND THEN RAISE EXCEPTION 'Der Zieleintrag wurde gelöscht'; END IF;
     INSERT INTO public.task_decision_participants(decision_id,user_id) SELECT s.entity_id,_assignee_id WHERE NOT EXISTS(SELECT 1 FROM public.task_decision_participants WHERE decision_id=s.entity_id AND user_id=_assignee_id);
   END IF;
   IF s.kind<>'decision' AND NOT FOUND THEN RAISE EXCEPTION 'Der Zieleintrag wurde gelöscht'; END IF;
 END IF;
 IF s.approval_id IS NOT NULL AND approver IS DISTINCT FROM s.approver_id THEN
   INSERT INTO public.task_decision_participants(decision_id,user_id) SELECT s.approval_id,approver WHERE NOT EXISTS(SELECT 1 FROM public.task_decision_participants WHERE decision_id=s.approval_id AND user_id=approver);
 END IF;
 UPDATE public.routine_package_steps SET assignee_id=_assignee_id,approver_id=approver,status=CASE WHEN entity_id IS NULL THEN 'waiting' ELSE 'active' END,error_message=NULL WHERE id=s.id;
 UPDATE public.tasks SET timeline=coalesce(timeline,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'text','Zuständigkeit für Routinenschritt geändert: '||s.title)) WHERE id=pkg.task_id;
END $$;
REVOKE ALL ON FUNCTION public.reassign_routine_step(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reassign_routine_step(uuid,uuid,uuid) TO authenticated;
