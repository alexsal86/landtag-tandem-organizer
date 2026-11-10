-- Typed package steps retain the legacy text for backwards compatibility.
CREATE OR REPLACE FUNCTION public.office_routine_step_kinds(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE kinds jsonb; n integer;
BEGIN
 SELECT count(*) INTO n FROM public.office_routine_steps(_payload->>'routine_steps_text');
 IF coalesce(_payload->>'routine_step_kinds','')='' THEN
   SELECT coalesce(jsonb_agg('subtask'::text),'[]'::jsonb) INTO kinds FROM generate_series(1,n);
 ELSE
   kinds:=(_payload->>'routine_step_kinds')::jsonb;
   IF jsonb_typeof(kinds) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ungültige Schritttypen' USING ERRCODE='22023'; END IF;
   IF jsonb_array_length(kinds)<>n OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(kinds) k WHERE k IS NULL OR k NOT IN ('subtask','task','case','decision','jour_fixe')) THEN
     RAISE EXCEPTION 'Für jeden Arbeitsschritt einen gültigen Aktionstyp auswählen' USING ERRCODE='22023';
   END IF;
 END IF;
 RETURN kinds;
END $$;
REVOKE ALL ON FUNCTION public.office_routine_step_kinds(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_routine_step_kinds(jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.validate_office_routine_package()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE action jsonb; payload jsonb;
BEGIN
 FOR action IN SELECT x FROM jsonb_array_elements(NEW.actions) x WHERE x->>'type'='run_annual_routine' LOOP
  payload:=action->'payload';
  PERFORM public.office_routine_step_kinds(payload);
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
DECLARE a public.annual_tasks; r public.automation_rules; c public.annual_task_completions; result jsonb; assignee uuid; task_id uuid; payload jsonb; start_day date; finish_day date; step record; task_row public.tasks; step_no integer:=0; kinds jsonb; kind text; step_due date; entity_id uuid; owner_id uuid;
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
 IF payload->>'routine_requires_confirmation'='true' AND payload->>'routine_confirmed_year' IS DISTINCT FROM _year::text THEN RAISE EXCEPTION 'Jahrestermine müssen zuerst bestätigt werden' USING ERRCODE='22023'; END IF;
 INSERT INTO public.annual_task_completions(annual_task_id,year) VALUES(a.id,_year) ON CONFLICT(annual_task_id,year) DO NOTHING;
 SELECT * INTO c FROM public.annual_task_completions WHERE annual_task_id=a.id AND year=_year FOR UPDATE;
 IF c.completed_at IS NOT NULL OR c.linked_task_id IS NOT NULL THEN RETURN jsonb_build_object('reused',true,'task_id',c.linked_task_id,'completed_at',c.completed_at); END IF;
 IF a.execute_function IS NULL THEN
   SELECT NULLIF(x->'payload'->>'assigned_to','')::uuid INTO assignee FROM jsonb_array_elements(r.actions) x WHERE x->>'type'='run_annual_routine';
   task_id:=automation_private.spawn_annual_task_to_stafette(a.id,_year,assignee);
   SELECT * INTO task_row FROM public.tasks WHERE id=task_id;
   start_day:=make_date(_year,a.due_month,LEAST(coalesce(a.due_day,31),extract(day FROM (make_date(_year,a.due_month,1)+interval '1 month'-interval '1 day'))::integer));
   finish_day:=office_routine_deadline(payload,start_day);
   IF finish_day<>start_day THEN UPDATE public.tasks SET due_date=(finish_day+time '17:00') AT TIME ZONE 'Europe/Berlin',next_action_due=finish_day WHERE id=task_id; END IF;
   FOR step IN SELECT * FROM office_routine_steps(payload->>'routine_steps_text') ORDER BY days_before DESC,step_index LOOP
    kind:=kinds->>(step.step_index-1);
    step_due:=GREATEST(start_day,finish_day-step.days_before);
    owner_id:=coalesce(task_row.ball_assignee_id,task_row.user_id);
    IF kind='subtask' THEN
      INSERT INTO public.subtasks(task_id,user_id,description,assigned_to,due_date,order_index,is_completed)
      VALUES(task_id,task_row.user_id,step.description,task_row.assigned_to,(step_due+time '17:00') AT TIME ZONE 'Europe/Berlin',step_no,false);
    ELSIF kind='task' THEN
      INSERT INTO public.tasks(user_id,tenant_id,title,description,assigned_to,parent_task_id,status,priority,category,due_date,ball_owner,ball_assignee_id,next_action,next_action_due,source_type,source_id,timeline)
      VALUES(task_row.user_id,r.tenant_id,step.description,'Aus Aufgabenpaket: '||task_row.title,owner_id::text,task_id,'todo','medium','personal',(step_due+time '17:00') AT TIME ZONE 'Europe/Berlin','office',owner_id,step.description,step_due,'annual_routine_step',task_id,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'text','Aus Routine: '||task_row.title)));
    ELSIF kind IN ('case','jour_fixe') THEN
      INSERT INTO public.case_items(user_id,tenant_id,subject,summary,owner_user_id,source_channel,status,priority,due_at,ball_owner,next_action_assignee_id,next_action_label,next_action_due_at,pending_for_jour_fixe,source_reference,intake_payload)
      VALUES(task_row.user_id,r.tenant_id,step.description,'Aus Aufgabenpaket: '||task_row.title,owner_id,'other','active','medium',(step_due+time '17:00') AT TIME ZONE 'Europe/Berlin','office',owner_id,step.description,(step_due+time '17:00') AT TIME ZONE 'Europe/Berlin',kind='jour_fixe','Aufgabenpaket: '||task_id::text,jsonb_build_object('routine_task_id',task_id,'routine_step',step.step_index));
    ELSIF kind='decision' THEN
      INSERT INTO public.task_decisions(task_id,tenant_id,created_by,title,description,status,response_deadline,visible_to_all)
      VALUES(task_id,r.tenant_id,task_row.user_id,step.description,'Aus Aufgabenpaket: '||task_row.title,'active',(step_due+time '17:00') AT TIME ZONE 'Europe/Berlin',false)
      RETURNING id INTO entity_id;
      INSERT INTO public.task_decision_participants(decision_id,user_id) VALUES(entity_id,owner_id);
    ELSE
      RAISE EXCEPTION 'Unbekannter Aktionstyp';
    END IF;
    IF step_no=0 THEN UPDATE public.tasks SET next_action=step.description,next_action_due=GREATEST(start_day,finish_day-step.days_before) WHERE id=task_id; END IF;
    step_no:=step_no+1;
   END LOOP;
   RETURN jsonb_build_object('task_id',task_id,'reused',false,'steps',step_no,'deadline',finish_day);
 END IF;
 IF a.execute_function NOT IN ('execute_reset_vacation_days','execute_archive_sick_days','execute_expire_carry_over','generate_current_year_stats') THEN RAISE EXCEPTION 'Unbekannte Systemaktion'; END IF;
 EXECUTE format('SELECT public.%I(p_tenant_id := $1)',a.execute_function) INTO result USING a.tenant_id;
 IF result->>'success'='false' THEN RAISE EXCEPTION 'Systemaktion fehlgeschlagen'; END IF;
 UPDATE public.annual_task_completions SET completed_at=now(),completed_by=NULL,notes='Automation: '||COALESCE(result::text,'erledigt') WHERE id=c.id;
 RETURN jsonb_build_object('completed',true,'result',result,'reused',false);
END $$;
