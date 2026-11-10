-- Reuse the existing approved leave_requests/deputy_user_id mechanism.
ALTER TABLE public.routine_package_steps
 ADD COLUMN nominal_assignee_id uuid REFERENCES auth.users(id),
 ADD COLUMN nominal_approver_id uuid REFERENCES auth.users(id),
 ADD COLUMN use_deputy boolean NOT NULL DEFAULT true,
 ADD COLUMN deadline_basis text NOT NULL DEFAULT 'finish' CHECK(deadline_basis IN ('finish','previous_planned','next_planned','previous_completed','next_completed')),
 ADD COLUMN deadline_offset integer CHECK(deadline_offset BETWEEN -365 AND 365),
 ALTER COLUMN due_day DROP NOT NULL;
UPDATE public.routine_package_steps s SET nominal_assignee_id=s.assignee_id,nominal_approver_id=s.approver_id,deadline_offset=s.due_day-r.finish_day FROM public.routine_package_runs r WHERE r.id=s.run_id;
CREATE FUNCTION automation_private.prepare_routine_step() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 NEW.nominal_assignee_id:=coalesce(NEW.nominal_assignee_id,NEW.assignee_id);
 NEW.nominal_approver_id:=coalesce(NEW.nominal_approver_id,NEW.approver_id);
 IF NEW.deadline_offset IS NULL THEN SELECT coalesce(NEW.due_day-r.finish_day,0) INTO NEW.deadline_offset FROM public.routine_package_runs r WHERE r.id=NEW.run_id; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION automation_private.prepare_routine_step() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER prepare_routine_step BEFORE INSERT ON public.routine_package_steps FOR EACH ROW EXECUTE FUNCTION automation_private.prepare_routine_step();
ALTER TABLE public.routine_package_steps ALTER COLUMN nominal_assignee_id SET NOT NULL,ALTER COLUMN deadline_offset SET NOT NULL;

-- Two nodes per step: planned date and actual completion. This permits a date
-- relative to a next step's plan while still rejecting real execution cycles.
CREATE FUNCTION automation_private.routine_graph_visit(_node integer,_settings jsonb,_state integer[]) RETURNS integer[] LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE n integer:=jsonb_array_length(_settings); i integer; item jsonb; ref integer;
BEGIN
 IF _state[_node+1]=1 THEN RAISE EXCEPTION 'Fristen oder Startbedingungen bilden einen Kreis' USING ERRCODE='22023'; END IF;
 IF _state[_node+1]=2 THEN RETURN _state; END IF;
 _state[_node+1]:=1; i:=_node % n; item:=_settings->i;
 IF _node<n THEN
   IF item->>'deadline_basis'<>'finish' THEN
     ref:=CASE WHEN item->>'deadline_basis' LIKE 'previous_%' THEN i-1 ELSE i+1 END;
     IF ref<0 OR ref>=n THEN RAISE EXCEPTION 'Der gewählte Bezugsschritt existiert nicht' USING ERRCODE='22023'; END IF;
     IF item->>'deadline_basis' LIKE '%_completed' THEN ref:=ref+n; END IF;
     _state:=automation_private.routine_graph_visit(ref,_settings,_state);
   END IF;
 ELSE
   _state:=automation_private.routine_graph_visit(i,_settings,_state);
   IF item->>'release'='after_previous' THEN
     IF i=0 THEN RAISE EXCEPTION 'Der erste Schritt hat keinen Vorgänger' USING ERRCODE='22023'; END IF;
     _state:=automation_private.routine_graph_visit(n+i-1,_settings,_state);
   END IF;
 END IF;
 _state[_node+1]:=2; RETURN _state;
END $$;
REVOKE ALL ON FUNCTION automation_private.routine_graph_visit(integer,jsonb,integer[]) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.office_routine_step_settings(_payload jsonb,_tenant_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE raw jsonb; settings jsonb:='[]'; item jsonb; n integer; i integer; state integer[]; person uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=_tenant_id AND user_id=auth.uid() AND is_active) THEN RAISE EXCEPTION 'Kein Zugriff auf dieses Büro' USING ERRCODE='42501'; END IF;
 PERFORM public.office_routine_step_kinds(_payload);
 SELECT count(*) INTO n FROM public.office_routine_steps(_payload->>'routine_steps_text');
 IF coalesce(_payload->>'routine_step_settings','')='' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('release','package_start','assignee','','approver','')),'[]') INTO raw FROM generate_series(1,n);
 ELSE raw:=(_payload->>'routine_step_settings')::jsonb; END IF;
 IF jsonb_typeof(raw) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ungültige Schritteinstellungen' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(raw)<>n THEN RAISE EXCEPTION 'Jeder Schritt braucht passende Einstellungen' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT x FROM jsonb_array_elements(raw) x LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Ungültige Schritteinstellungen'; END IF;
   item:=jsonb_build_object('deadline_basis','finish','deadline_offset',0,'use_deputy',true)||item;
   IF coalesce(item->>'release','') NOT IN ('package_start','scheduled','after_previous','after_approval') OR coalesce(item->>'deadline_basis','') NOT IN ('finish','previous_planned','next_planned','previous_completed','next_completed') THEN RAISE EXCEPTION 'Ungültige Startbedingung oder relative Frist' USING ERRCODE='22023'; END IF;
   IF jsonb_typeof(item->'use_deputy') IS DISTINCT FROM 'boolean' OR jsonb_typeof(item->'deadline_offset') IS DISTINCT FROM 'number' OR (item->>'deadline_offset')::integer NOT BETWEEN -365 AND 365 THEN RAISE EXCEPTION 'Ungültige Vertretungseinstellung oder relativer Abstand' USING ERRCODE='22023'; END IF;
   IF item->>'deadline_basis' LIKE '%_completed' AND (item->>'deadline_offset')::integer<0 THEN RAISE EXCEPTION 'Vor einem tatsächlichen Abschluss kann keine Frist berechnet werden' USING ERRCODE='22023'; END IF;
   IF item->>'release'='after_approval' AND coalesce(item->>'approver','')='' THEN RAISE EXCEPTION 'Freigebende Person fehlt' USING ERRCODE='22023'; END IF;
   FOR person IN SELECT NULLIF(item->>'assignee','')::uuid UNION SELECT NULLIF(item->>'approver','')::uuid LOOP
     IF person IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=_tenant_id AND user_id=person AND is_active) THEN RAISE EXCEPTION 'Eine zuständige Person gehört nicht zum Büro' USING ERRCODE='22023'; END IF;
   END LOOP;
   settings:=settings||jsonb_build_array(item);
 END LOOP;
 IF coalesce(_payload->>'routine_step_settings','')<>'' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(settings) x WHERE x->>'deadline_basis'<>'finish') AND EXISTS(SELECT 1 FROM (SELECT days_before,lag(days_before) OVER(ORDER BY step_index) AS previous_days FROM public.office_routine_steps(_payload->>'routine_steps_text')) x WHERE days_before>previous_days) THEN RAISE EXCEPTION 'Bitte die Schritte nach Zeitpunkt sortieren' USING ERRCODE='22023'; END IF;
 state:=array_fill(0,ARRAY[n*2]);
 IF n>0 THEN FOR i IN 0..n*2-1 LOOP state:=automation_private.routine_graph_visit(i,settings,state); END LOOP; END IF;
 RETURN settings;
END $$;
CREATE FUNCTION public.office_routine_step_settings_v2(_payload jsonb,_tenant_id uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$ SELECT public.office_routine_step_settings(_payload,_tenant_id) $$;
REVOKE ALL ON FUNCTION public.office_routine_step_settings_v2(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_routine_step_settings_v2(jsonb,uuid) TO authenticated,service_role;

CREATE FUNCTION automation_private.routine_effective_deputy(_tenant uuid,_person uuid) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE current_person uuid:=_person; seen uuid[]:='{}'; deputies uuid[]; missing boolean; total integer; today date:=(now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
 LOOP
   IF current_person IS NULL OR current_person=ANY(seen) OR cardinality(seen)>=20 THEN RAISE EXCEPTION 'Die hinterlegte Stellvertretung ist unklar oder bildet einen Kreis. Bitte im Abwesenheitstool korrigieren.' USING ERRCODE='P0002'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=_tenant AND user_id=current_person AND is_active) THEN RAISE EXCEPTION 'Die zuständige Person oder ihre Stellvertretung ist nicht im Büro aktiv.' USING ERRCODE='P0002'; END IF;
   seen:=array_append(seen,current_person);
   SELECT count(*),array_agg(DISTINCT deputy_user_id) FILTER(WHERE deputy_user_id IS NOT NULL),bool_or(deputy_user_id IS NULL) INTO total,deputies,missing
   FROM public.leave_requests WHERE user_id=current_person AND status='approved' AND type<>'medical' AND start_date<=today AND end_date>=today;
   IF total=0 THEN RETURN current_person; END IF;
   IF coalesce(cardinality(deputies),0)<>1 OR missing THEN RAISE EXCEPTION 'Für die genehmigte Abwesenheit fehlt eine eindeutige Stellvertretung. Bitte im Abwesenheitstool ergänzen.' USING ERRCODE='P0002'; END IF;
   current_person:=deputies[1];
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION automation_private.routine_effective_deputy(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION automation_private.routine_due_day(_step uuid,_trail uuid[] DEFAULT '{}') RETURNS date LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.routine_package_steps; pkg public.routine_package_runs; ref public.routine_package_steps; base date;
BEGIN
 IF _step=ANY(_trail) OR cardinality(_trail)>40 THEN RAISE EXCEPTION 'Kreis in relativen Fristen' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.routine_package_steps WHERE id=_step;
 SELECT * INTO pkg FROM public.routine_package_runs WHERE id=s.run_id;
 IF (s.entity_id IS NOT NULL OR s.approval_id IS NOT NULL) AND s.due_day IS NOT NULL THEN RETURN s.due_day; END IF;
 IF s.deadline_basis='finish' THEN base:=pkg.finish_day;
 ELSE
   SELECT * INTO ref FROM public.routine_package_steps WHERE run_id=s.run_id AND position=s.position+CASE WHEN s.deadline_basis LIKE 'previous_%' THEN -1 ELSE 1 END;
   IF NOT FOUND THEN RAISE EXCEPTION 'Bezugsschritt fehlt' USING ERRCODE='22023'; END IF;
   IF s.deadline_basis LIKE '%_completed' THEN
     IF ref.status<>'completed' OR ref.completed_at IS NULL THEN RETURN NULL; END IF;
     base:=(ref.completed_at AT TIME ZONE 'Europe/Berlin')::date;
   ELSE base:=automation_private.routine_due_day(ref.id,array_append(_trail,_step)); END IF;
 END IF;
 IF base IS NULL THEN RETURN NULL; END IF;
 RETURN GREATEST(pkg.start_day,base+s.deadline_offset);
END $$;
REVOKE ALL ON FUNCTION automation_private.routine_due_day(uuid,uuid[]) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION automation_private.apply_routine_deputy(_step uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.routine_package_steps; pkg public.routine_package_runs; owner_id uuid; effective_approver uuid;
BEGIN
 SELECT * INTO s FROM public.routine_package_steps WHERE id=_step FOR UPDATE;
 SELECT * INTO pkg FROM public.routine_package_runs WHERE id=s.run_id;
 IF s.status='completed' THEN RETURN true; END IF;
 BEGIN
   owner_id:=s.nominal_assignee_id; effective_approver:=s.nominal_approver_id;
   IF s.use_deputy THEN
     IF s.kind='decision' AND s.entity_id IS NOT NULL AND automation_private.routine_vote(s.entity_id,s.assignee_id) IN ('yes','no') THEN owner_id:=s.assignee_id;
     ELSE owner_id:=automation_private.routine_effective_deputy(pkg.tenant_id,owner_id); END IF;
     IF effective_approver IS NOT NULL THEN
       IF s.entity_id IS NOT NULL OR (s.approval_id IS NOT NULL AND automation_private.routine_vote(s.approval_id,s.approver_id) IN ('yes','no')) THEN effective_approver:=s.approver_id;
       ELSE effective_approver:=automation_private.routine_effective_deputy(pkg.tenant_id,effective_approver); END IF;
     END IF;
   END IF;
 EXCEPTION WHEN SQLSTATE 'P0002' THEN
   UPDATE public.routine_package_steps SET status='blocked',error_message=SQLERRM WHERE id=s.id; RETURN false;
 END;
 IF owner_id IS DISTINCT FROM s.assignee_id THEN
   IF s.entity_id IS NOT NULL THEN
     IF s.kind='subtask' THEN UPDATE public.subtasks SET assigned_to=owner_id::text WHERE id=s.entity_id AND task_id=pkg.task_id;
     ELSIF s.kind='task' THEN UPDATE public.tasks SET assigned_to=owner_id::text,ball_assignee_id=owner_id WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
     ELSIF s.kind IN ('case','jour_fixe') THEN UPDATE public.case_items SET owner_user_id=owner_id,next_action_assignee_id=owner_id WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
     ELSE INSERT INTO public.task_decision_participants(decision_id,user_id) SELECT s.entity_id,owner_id WHERE NOT EXISTS(SELECT 1 FROM public.task_decision_participants WHERE decision_id=s.entity_id AND user_id=owner_id); END IF;
   END IF;
   UPDATE public.routine_package_steps SET assignee_id=owner_id WHERE id=s.id;
 END IF;
 IF effective_approver IS DISTINCT FROM s.approver_id THEN
   IF s.approval_id IS NOT NULL THEN INSERT INTO public.task_decision_participants(decision_id,user_id) SELECT s.approval_id,effective_approver WHERE NOT EXISTS(SELECT 1 FROM public.task_decision_participants WHERE decision_id=s.approval_id AND user_id=effective_approver); END IF;
   UPDATE public.routine_package_steps SET approver_id=effective_approver WHERE id=s.id;
 END IF;
 IF owner_id IS DISTINCT FROM s.assignee_id OR effective_approver IS DISTINCT FROM s.approver_id THEN
   UPDATE public.tasks SET timeline=coalesce(timeline,'[]')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'text','Routinen-Zuständigkeit anhand der hinterlegten Abwesenheitsvertretung aktualisiert: '||s.title)) WHERE id=pkg.task_id;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION automation_private.apply_routine_deputy(uuid) FROM PUBLIC,anon,authenticated;

-- Capture completion events without locking workflow steps from target triggers.
CREATE TABLE automation_private.routine_completion_events(kind text NOT NULL,entity_id uuid NOT NULL,completed_at timestamptz NOT NULL,PRIMARY KEY(kind,entity_id));
REVOKE ALL ON automation_private.routine_completion_events FROM PUBLIC,anon,authenticated;
CREATE FUNCTION automation_private.track_routine_completion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prior jsonb:=to_jsonb(OLD); current_row jsonb; was_done boolean; is_done boolean; event_entity uuid; event_kind text;
BEGIN
 event_kind:=CASE TG_TABLE_NAME WHEN 'subtasks' THEN 'subtask' WHEN 'case_items' THEN 'case' ELSE 'task' END;
 event_entity:=(prior->>'id')::uuid;
 IF TG_OP='DELETE' THEN DELETE FROM automation_private.routine_completion_events e WHERE e.kind=event_kind AND e.entity_id=event_entity; RETURN OLD; END IF;
 current_row:=to_jsonb(NEW);
 IF NOT EXISTS(SELECT 1 FROM public.routine_package_steps s WHERE s.entity_id=event_entity AND (s.kind=event_kind OR event_kind='case' AND s.kind='jour_fixe')) THEN RETURN NEW; END IF;
 IF event_kind='subtask' THEN was_done:=coalesce((prior->>'is_completed')::boolean,false); is_done:=coalesce((current_row->>'is_completed')::boolean,false);
 ELSIF event_kind='case' THEN was_done:=(prior->>'status') IN ('erledigt','archiviert'); is_done:=(current_row->>'status') IN ('erledigt','archiviert');
 ELSE was_done:=prior->>'status'='completed'; is_done:=current_row->>'status'='completed'; END IF;
 IF is_done AND NOT was_done THEN INSERT INTO automation_private.routine_completion_events VALUES(event_kind,event_entity,clock_timestamp()) ON CONFLICT ON CONSTRAINT routine_completion_events_pkey DO UPDATE SET completed_at=excluded.completed_at;
 ELSIF was_done AND NOT is_done THEN DELETE FROM automation_private.routine_completion_events e WHERE e.kind=event_kind AND e.entity_id=event_entity; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION automation_private.track_routine_completion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER routine_task_completion_event AFTER UPDATE OF status OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION automation_private.track_routine_completion();
CREATE TRIGGER routine_subtask_completion_event AFTER UPDATE OF is_completed OR DELETE ON public.subtasks FOR EACH ROW EXECUTE FUNCTION automation_private.track_routine_completion();
CREATE TRIGGER routine_case_completion_event AFTER UPDATE OF status OR DELETE ON public.case_items FOR EACH ROW EXECUTE FUNCTION automation_private.track_routine_completion();

CREATE OR REPLACE FUNCTION automation_private.advance_routine_package(_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pkg public.routine_package_runs; s public.routine_package_steps; parent public.tasks; rid uuid; vote text; done boolean; exists_target boolean; completion_time timestamptz; new_due date;
BEGIN
 SELECT * INTO pkg FROM public.routine_package_runs WHERE id=_run_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.automation_rules r JOIN public.tenants t ON t.id=r.tenant_id WHERE r.id=pkg.rule_id AND r.enabled AND NOT coalesce(t.automations_paused,false)) THEN RETURN; END IF;
 SELECT * INTO parent FROM public.tasks WHERE id=pkg.task_id;
 FOR s IN SELECT * FROM public.routine_package_steps WHERE run_id=pkg.id AND status<>'completed' ORDER BY position FOR UPDATE LOOP
   IF s.status='failed' THEN CONTINUE; END IF;
   BEGIN
     IF s.entity_id IS NOT NULL THEN
       done:=false; exists_target:=false; completion_time:=NULL;
       IF s.kind='subtask' THEN SELECT true,is_completed,coalesce(completed_at,updated_at) INTO exists_target,done,completion_time FROM public.subtasks WHERE id=s.entity_id AND task_id=pkg.task_id;
       ELSIF s.kind='task' THEN SELECT true,status='completed',updated_at INTO exists_target,done,completion_time FROM public.tasks WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
       ELSIF s.kind IN ('case','jour_fixe') THEN SELECT true,status IN ('erledigt','archiviert'),coalesce(completed_at,updated_at) INTO exists_target,done,completion_time FROM public.case_items WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
       ELSE
         SELECT true INTO exists_target FROM public.task_decisions WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
         vote:=automation_private.routine_vote(s.entity_id,s.assignee_id);
         done:=vote='yes';
         SELECT coalesce(resp.updated_at,resp.created_at) INTO completion_time FROM public.task_decision_responses resp JOIN public.task_decision_participants participant ON participant.id=resp.participant_id AND participant.decision_id=resp.decision_id WHERE participant.decision_id=s.entity_id AND participant.user_id=s.assignee_id ORDER BY resp.updated_at DESC,resp.created_at DESC,resp.id DESC LIMIT 1;
         IF vote='no' THEN UPDATE public.routine_package_steps SET status='blocked',error_message='Entscheidung abgelehnt. Die entscheidende Person muss ihr Votum ändern, bevor der Ablauf weitergeht.' WHERE id=s.id; CONTINUE; END IF;
       END IF;
       IF NOT coalesce(exists_target,false) THEN RAISE EXCEPTION 'Der verknüpfte Eintrag wurde gelöscht. Er wird nicht automatisch neu angelegt.'; END IF;
       IF coalesce(done,false) THEN
         SELECT coalesce((SELECT e.completed_at FROM automation_private.routine_completion_events e WHERE e.entity_id=s.entity_id AND e.kind=CASE WHEN s.kind='jour_fixe' THEN 'case' ELSE s.kind END),completion_time,clock_timestamp()) INTO completion_time;
       ELSIF NOT automation_private.apply_routine_deputy(s.id) THEN CONTINUE; END IF;
       UPDATE public.routine_package_steps SET status=CASE WHEN coalesce(done,false) THEN 'completed' ELSE 'active' END,completed_at=CASE WHEN coalesce(done,false) THEN coalesce(completion_time,now()) ELSE NULL END,error_message=NULL WHERE id=s.id;
       CONTINUE;
     END IF;
     new_due:=automation_private.routine_due_day(s.id);
     UPDATE public.routine_package_steps SET due_day=new_due WHERE id=s.id;
     s.due_day:=new_due;
     IF new_due IS NULL THEN UPDATE public.routine_package_steps SET status='waiting',error_message=NULL WHERE id=s.id; CONTINUE; END IF;
     IF s.release='scheduled' AND s.due_day>(now() AT TIME ZONE 'Europe/Berlin')::date THEN CONTINUE; END IF;
     IF s.release='after_previous' AND NOT EXISTS(SELECT 1 FROM public.routine_package_steps WHERE run_id=pkg.id AND position=s.position-1 AND status='completed') THEN CONTINUE; END IF;
     IF NOT automation_private.apply_routine_deputy(s.id) THEN CONTINUE; END IF;
     SELECT refreshed.* INTO s FROM public.routine_package_steps refreshed WHERE refreshed.id=s.id;
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


CREATE OR REPLACE FUNCTION public.execute_annual_automation_routine(_rule_id uuid,_annual_task_id uuid,_year integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.annual_tasks; r public.automation_rules; c public.annual_task_completions; result jsonb; assignee uuid; task_id uuid; payload jsonb; start_day date; finish_day date; step record; task_row public.tasks; step_no integer:=0; kinds jsonb; kind text; step_due date; entity_id uuid; owner_id uuid; settings jsonb; setting jsonb; new_run_id uuid; relative boolean;
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
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(settings) x WHERE x->>'deadline_basis'<>'finish') INTO relative;
 IF payload->>'routine_requires_confirmation'='true' AND payload->>'routine_confirmed_year' IS DISTINCT FROM _year::text THEN RAISE EXCEPTION 'Jahrestermine müssen zuerst bestätigt werden' USING ERRCODE='22023'; END IF;
 INSERT INTO public.annual_task_completions(annual_task_id,year) VALUES(a.id,_year) ON CONFLICT(annual_task_id,year) DO NOTHING;
 SELECT * INTO c FROM public.annual_task_completions WHERE annual_task_id=a.id AND year=_year FOR UPDATE;
 IF c.completed_at IS NOT NULL OR c.linked_task_id IS NOT NULL THEN
   SELECT id INTO new_run_id FROM public.routine_package_runs pr WHERE pr.task_id=c.linked_task_id;
   IF new_run_id IS NOT NULL THEN PERFORM automation_private.advance_routine_package(new_run_id); END IF;
   RETURN jsonb_build_object('reused',true,'task_id',c.linked_task_id,'completed_at',c.completed_at); END IF;
 IF a.execute_function IS NULL THEN
   SELECT NULLIF(x->'payload'->>'assigned_to','')::uuid INTO assignee FROM jsonb_array_elements(r.actions) x WHERE x->>'type'='run_annual_routine';
   task_id:=automation_private.spawn_annual_task_to_stafette(a.id,_year,assignee);
   SELECT * INTO task_row FROM public.tasks WHERE id=task_id;
   start_day:=make_date(_year,a.due_month,LEAST(coalesce(a.due_day,31),extract(day FROM (make_date(_year,a.due_month,1)+interval '1 month'-interval '1 day'))::integer));
   finish_day:=office_routine_deadline(payload,start_day);
   IF finish_day<>start_day THEN UPDATE public.tasks SET due_date=(finish_day+time '17:00') AT TIME ZONE 'Europe/Berlin',next_action_due=finish_day WHERE id=task_id; END IF;
   INSERT INTO public.routine_package_runs(tenant_id,rule_id,annual_task_id,year,task_id,start_day,finish_day)
   VALUES(r.tenant_id,r.id,a.id,_year,task_id,start_day,finish_day) RETURNING id INTO new_run_id;
   FOR step IN SELECT * FROM office_routine_steps(payload->>'routine_steps_text') ORDER BY CASE WHEN relative THEN step_index END,days_before DESC,step_index LOOP
     setting:=settings->(step.step_index-1);
     INSERT INTO public.routine_package_steps(run_id,position,title,kind,release,assignee_id,approver_id,due_day,deadline_basis,deadline_offset,use_deputy)
     VALUES(new_run_id,step_no,step.description,kinds->>(step.step_index-1),setting->>'release',coalesce(NULLIF(setting->>'assignee','')::uuid,task_row.ball_assignee_id,task_row.user_id),NULLIF(setting->>'approver','')::uuid,CASE WHEN setting->>'deadline_basis'='finish' THEN GREATEST(start_day,finish_day-step.days_before) ELSE NULL END,setting->>'deadline_basis',CASE WHEN setting->>'deadline_basis'='finish' THEN -step.days_before ELSE (setting->>'deadline_offset')::integer END,(setting->>'use_deputy')::boolean);
     step_no:=step_no+1;
   END LOOP;
   UPDATE public.routine_package_steps target SET due_day=automation_private.routine_due_day(target.id) WHERE target.run_id=new_run_id;
   SELECT * INTO step FROM public.routine_package_steps WHERE run_id=new_run_id AND position=0;
   IF FOUND THEN UPDATE public.tasks SET next_action=step.title,next_action_due=step.due_day WHERE id=task_id; END IF;
   PERFORM automation_private.advance_routine_package(new_run_id);
   RETURN jsonb_build_object('task_id',task_id,'reused',false,'steps',step_no,'deadline',finish_day);
 END IF;
 IF a.execute_function NOT IN ('execute_reset_vacation_days','execute_archive_sick_days','execute_expire_carry_over','generate_current_year_stats') THEN RAISE EXCEPTION 'Unbekannte Systemaktion'; END IF;
 EXECUTE format('SELECT public.%I(p_tenant_id := $1)',a.execute_function) INTO result USING a.tenant_id;
 IF result->>'success'='false' THEN RAISE EXCEPTION 'Systemaktion fehlgeschlagen'; END IF;
 UPDATE public.annual_task_completions SET completed_at=now(),completed_by=NULL,notes='Automation: '||COALESCE(result::text,'erledigt') WHERE id=c.id;
 RETURN jsonb_build_object('completed',true,'result',result,'reused',false);
END $$;


CREATE OR REPLACE FUNCTION public.update_waiting_routine_steps(_run_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pkg public.routine_package_runs; rule public.automation_rules; payload jsonb; kinds jsonb; settings jsonb; setting jsonb; step record; current_step public.routine_package_steps; pos integer:=0; changed integer:=0; default_owner uuid; relative boolean;
BEGIN
 SELECT * INTO pkg FROM public.routine_package_runs WHERE id=_run_id FOR UPDATE;
 IF NOT FOUND OR public.is_tenant_admin(auth.uid(),pkg.tenant_id) IS NOT TRUE THEN RAISE EXCEPTION 'Keine Berechtigung für diesen Ablauf' USING ERRCODE='42501'; END IF;
 SELECT * INTO rule FROM public.automation_rules WHERE id=pkg.rule_id AND tenant_id=pkg.tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Die Vorlage existiert nicht mehr'; END IF;
 SELECT x->'payload' INTO payload FROM jsonb_array_elements(rule.actions) x WHERE x->>'type'='run_annual_routine';
 IF payload IS NULL OR coalesce(payload->>'system_function','')<>'' THEN RAISE EXCEPTION 'Die Vorlage ist kein Büro-Aufgabenpaket mehr'; END IF;
 IF public.office_routine_deadline(payload,pkg.start_day)<>pkg.finish_day THEN RAISE EXCEPTION 'Der Abschluss eines laufenden Pakets bleibt unverändert. Bitte den ursprünglichen Abschlusstermin in der Vorlage beibehalten oder die Änderung erst für neue Pakete verwenden.'; END IF;
 kinds:=public.office_routine_step_kinds(payload); settings:=public.office_routine_step_settings(payload,pkg.tenant_id);
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(settings) x WHERE x->>'deadline_basis'<>'finish') INTO relative;
 IF jsonb_array_length(kinds)<>(SELECT count(*) FROM public.routine_package_steps WHERE run_id=pkg.id) THEN RAISE EXCEPTION 'Schritte wurden hinzugefügt oder entfernt. Solche Strukturänderungen gelten für neue Pakete.'; END IF;
 SELECT coalesce(ball_assignee_id,user_id) INTO default_owner FROM public.tasks WHERE id=pkg.task_id;
 FOR step IN SELECT * FROM public.office_routine_steps(payload->>'routine_steps_text') ORDER BY CASE WHEN relative THEN step_index END,days_before DESC,step_index LOOP
   SELECT * INTO current_step FROM public.routine_package_steps WHERE run_id=pkg.id AND position=pos FOR UPDATE;
   setting:=settings->(step.step_index-1);
   IF current_step.entity_id IS NOT NULL OR current_step.approval_id IS NOT NULL OR current_step.status NOT IN ('waiting','failed') THEN
     IF current_step.title<>step.description OR current_step.kind<>(kinds->>(step.step_index-1)) THEN RAISE EXCEPTION 'Bereits gestartete Schritte wurden verändert oder umgeordnet. Diese Vorlagenänderung gilt nur für neue Pakete.'; END IF;
   ELSE
     UPDATE public.routine_package_steps SET title=step.description,kind=kinds->>(step.step_index-1),release=setting->>'release',assignee_id=coalesce(NULLIF(setting->>'assignee','')::uuid,default_owner),nominal_assignee_id=coalesce(NULLIF(setting->>'assignee','')::uuid,default_owner),approver_id=NULLIF(setting->>'approver','')::uuid,nominal_approver_id=NULLIF(setting->>'approver','')::uuid,use_deputy=(setting->>'use_deputy')::boolean,deadline_basis=setting->>'deadline_basis',deadline_offset=CASE WHEN setting->>'deadline_basis'='finish' THEN -step.days_before ELSE (setting->>'deadline_offset')::integer END,due_day=NULL,status='waiting',error_message=NULL WHERE id=current_step.id;
     changed:=changed+1;
   END IF;
   pos:=pos+1;
 END LOOP;
 SELECT coalesce(jsonb_agg(jsonb_build_object('release',s.release,'deadline_basis',s.deadline_basis) ORDER BY s.position),'[]'::jsonb) INTO settings FROM public.routine_package_steps s WHERE s.run_id=pkg.id;
 DECLARE graph_state integer[]:=array_fill(0,ARRAY[jsonb_array_length(settings)*2]); node integer;
 BEGIN IF jsonb_array_length(settings)>0 THEN FOR node IN 0..jsonb_array_length(settings)*2-1 LOOP graph_state:=automation_private.routine_graph_visit(node,settings,graph_state); END LOOP; END IF; END;
 UPDATE public.routine_package_steps target SET due_day=automation_private.routine_due_day(target.id) WHERE target.run_id=pkg.id AND target.entity_id IS NULL AND target.approval_id IS NULL;
 -- Deliberately do not activate new work here; the user can inspect then refresh.
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.update_waiting_routine_steps(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_waiting_routine_steps(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.reassign_routine_step(_step_id uuid,_assignee_id uuid,_approver_id uuid DEFAULT NULL)
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
 UPDATE public.routine_package_steps SET assignee_id=_assignee_id,nominal_assignee_id=_assignee_id,approver_id=approver,nominal_approver_id=coalesce(_approver_id,s.nominal_approver_id),status=CASE WHEN entity_id IS NULL THEN 'waiting' ELSE 'active' END,error_message=NULL WHERE id=s.id;
 UPDATE public.tasks SET timeline=coalesce(timeline,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'text','Zuständigkeit für Routinenschritt geändert: '||s.title)) WHERE id=pkg.task_id;
END $$;
REVOKE ALL ON FUNCTION public.reassign_routine_step(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reassign_routine_step(uuid,uuid,uuid) TO authenticated;
