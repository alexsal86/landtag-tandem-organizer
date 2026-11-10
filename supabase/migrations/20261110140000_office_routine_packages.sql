-- Seasonal office packages use the existing rule, annual completion and Stafette.
CREATE OR REPLACE FUNCTION public.office_routine_steps(_text text)
RETURNS TABLE(description text,days_before integer,step_index integer)
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE line text; parts text[]; index integer:=0;
BEGIN
 IF length(coalesce(_text,''))>15000 THEN RAISE EXCEPTION 'Arbeitsschritte zu lang' USING ERRCODE='22023'; END IF;
 FOREACH line IN ARRAY regexp_split_to_array(coalesce(_text,''),E'\n') LOOP
  line:=btrim(line,E' \t\r'); IF line='' THEN CONTINUE; END IF;
  parts:=regexp_match(line,'^([0-9]{1,3})[[:space:]]*[|][[:space:]]*(.+)$');
  IF parts IS NULL OR parts[1]::integer>365 OR length(parts[2])>500 OR btrim(parts[2])='' THEN RAISE EXCEPTION 'Arbeitsschritte: Tage vorher | Aufgabe (0–365)' USING ERRCODE='22023'; END IF;
  index:=index+1; IF index>20 THEN RAISE EXCEPTION 'Maximal 20 Arbeitsschritte' USING ERRCODE='22023'; END IF;
  description:=btrim(parts[2]); days_before:=parts[1]::integer; step_index:=index; RETURN NEXT;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.office_routine_deadline(_payload jsonb,_start date)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE m integer; d integer; y integer:=extract(year FROM _start); finish date;
BEGIN
 IF coalesce(_payload->>'routine_deadline_month','')='' AND coalesce(_payload->>'routine_deadline_day','')='' THEN RETURN _start; END IF;
 m:=NULLIF(_payload->>'routine_deadline_month','')::integer; d:=NULLIF(_payload->>'routine_deadline_day','')::integer;
 IF m IS NULL OR m NOT BETWEEN 1 AND 12 OR d IS NULL OR d NOT BETWEEN 1 AND 31 THEN RAISE EXCEPTION 'Abschlussdatum unvollständig' USING ERRCODE='22023'; END IF;
 finish:=make_date(y,m,LEAST(d,extract(day FROM (make_date(y,m,1)+interval '1 month'-interval '1 day'))::integer));
 IF finish<_start THEN y:=y+1; finish:=make_date(y,m,LEAST(d,extract(day FROM (make_date(y,m,1)+interval '1 month'-interval '1 day'))::integer)); END IF;
 RETURN finish;
END $$;
CREATE OR REPLACE FUNCTION public.validate_office_routine_package()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE action jsonb; payload jsonb;
BEGIN
 FOR action IN SELECT x FROM jsonb_array_elements(NEW.actions) x WHERE x->>'type'='run_annual_routine' LOOP
  payload:=action->'payload';
  PERFORM * FROM office_routine_steps(payload->>'routine_steps_text');
  IF coalesce(payload->>'routine_steps_text','')<>'' OR payload->>'routine_requires_confirmation'='true' THEN
   IF coalesce(payload->>'routine_deadline_month','')='' OR coalesce(payload->>'routine_deadline_day','')='' THEN RAISE EXCEPTION 'Aufgabenpaket braucht einen Abschlusstermin' USING ERRCODE='22023'; END IF;
  END IF;
  PERFORM office_routine_deadline(payload,make_date(2026,(NEW.trigger_config->>'month')::integer,1));
  IF coalesce(payload->>'system_function','')<>'' AND (coalesce(payload->>'routine_steps_text','')<>'' OR coalesce(payload->>'routine_deadline_month','')<>'' OR payload->>'routine_requires_confirmation'='true') THEN RAISE EXCEPTION 'Systemaktionen sind keine Büro-Aufgabenpakete' USING ERRCODE='22023'; END IF;
  IF coalesce(payload->>'routine_confirmed_year','')<>'' AND payload->>'routine_confirmed_year' !~ '^(20[0-9]{2}|2100)$' THEN RAISE EXCEPTION 'Ungültiges Bestätigungsjahr' USING ERRCODE='22023'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_office_routine_package BEFORE INSERT OR UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.validate_office_routine_package();
REVOKE ALL ON FUNCTION public.office_routine_steps(text),public.office_routine_deadline(jsonb,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.office_routine_steps(text),public.office_routine_deadline(jsonb,date) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.execute_annual_automation_routine(_rule_id uuid,_annual_task_id uuid,_year integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.annual_tasks; r public.automation_rules; c public.annual_task_completions; result jsonb; assignee uuid; task_id uuid; payload jsonb; start_day date; finish_day date; step record; task_row public.tasks; step_no integer:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nur interne Ausführung'; END IF;
 IF _year IS NULL OR _year<2000 OR _year>2100 OR _year<>extract(year FROM now() AT TIME ZONE 'Europe/Berlin')::integer THEN RAISE EXCEPTION 'Nur aktuelles Jahr ausführbar'; END IF;
 SELECT * INTO r FROM public.automation_rules WHERE id=_rule_id;
 SELECT * INTO a FROM public.annual_tasks WHERE id=_annual_task_id FOR UPDATE;
 IF r.id IS NULL OR a.id IS NULL OR a.automation_rule_id<>r.id OR a.tenant_id<>r.tenant_id OR NOT r.enabled THEN RAISE EXCEPTION 'Ungültige Jahresroutine'; END IF;
 IF EXISTS(SELECT 1 FROM public.tenants WHERE id=r.tenant_id AND automations_paused) THEN RAISE EXCEPTION 'Automationen pausiert'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.actions) x WHERE x->>'type'='run_annual_routine' AND x->'payload'->>'annual_task_id'=a.id::text) THEN RAISE EXCEPTION 'Aktion nicht in Regel'; END IF;
 SELECT x->'payload' INTO payload FROM jsonb_array_elements(r.actions) x WHERE x->>'type'='run_annual_routine';
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
    INSERT INTO public.subtasks(task_id,user_id,description,assigned_to,due_date,order_index,is_completed)
     VALUES(task_id,task_row.user_id,step.description,task_row.assigned_to,(GREATEST(start_day,finish_day-step.days_before)+time '17:00') AT TIME ZONE 'Europe/Berlin',step_no,false);
    IF step_no=0 THEN UPDATE public.tasks SET next_action=step.description,next_action_due=GREATEST(start_day,finish_day-step.days_before) WHERE id=task_id; END IF;
    step_no:=step_no+1;
   END LOOP;
   RETURN jsonb_build_object('task_id',task_id,'reused',false,'subtasks',step_no,'deadline',finish_day);
 END IF;
 IF a.execute_function NOT IN ('execute_reset_vacation_days','execute_archive_sick_days','execute_expire_carry_over','generate_current_year_stats') THEN RAISE EXCEPTION 'Unbekannte Systemaktion'; END IF;
 EXECUTE format('SELECT public.%I(p_tenant_id := $1)',a.execute_function) INTO result USING a.tenant_id;
 IF result->>'success'='false' THEN RAISE EXCEPTION 'Systemaktion fehlgeschlagen'; END IF;
 UPDATE public.annual_task_completions SET completed_at=now(),completed_by=NULL,notes='Automation: '||COALESCE(result::text,'erledigt') WHERE id=c.id;
 RETURN jsonb_build_object('completed',true,'result',result,'reused',false);
END $$;
