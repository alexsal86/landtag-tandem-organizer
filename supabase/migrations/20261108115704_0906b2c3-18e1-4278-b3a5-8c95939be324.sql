ALTER TABLE public.task_decisions ADD COLUMN IF NOT EXISTS meeting_result text;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_meeting_followup_source_unique ON public.tasks(tenant_id, source_type, source_id) WHERE source_type LIKE 'jour_fixe_%' AND source_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.archive_meeting_with_stafette(_meeting_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE m public.meetings; a public.meeting_agenda_items; t public.tasks; d public.task_decisions;
  me uuid := auth.uid(); entry record; res jsonb; label text; body text; assignees uuid[]; assignee uuid;
  due timestamptz; new_id uuid; parent_id uuid; followup_id uuid; src_type text; src_id uuid;
  count_tasks integer := 0; count_decisions integer := 0; actor_name text; ap record; contact record; star record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE='42501'; END IF;
  SELECT * INTO m FROM public.meetings WHERE id=_meeting_id FOR UPDATE;
  IF NOT FOUND OR NOT (m.tenant_id = ANY(public.get_user_tenant_ids(me))) THEN
    RAISE EXCEPTION 'Besprechung nicht zugänglich' USING ERRCODE='42501';
  END IF;
  IF m.status='archived' THEN RETURN jsonb_build_object('already_archived',true,'tasks_created',0); END IF;
  SELECT display_name INTO actor_name FROM public.profiles WHERE user_id=me AND tenant_id=m.tenant_id LIMIT 1;
  FOR a IN SELECT * FROM public.meeting_agenda_items WHERE meeting_id=m.id ORDER BY order_index LOOP
    IF a.carry_over_to_next THEN CONTINUE; END IF;
    IF a.system_type IS NOT NULL THEN
      BEGIN res := coalesce(nullif(a.result_text,''),'{}')::jsonb;
      EXCEPTION WHEN invalid_text_representation THEN res := '{}'::jsonb; END;
      IF jsonb_typeof(res) <> 'object' THEN CONTINUE; END IF;
      FOR entry IN SELECT key, value FROM jsonb_each(res) LOOP
        IF entry.key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN CONTINUE; END IF;
        src_id := entry.key::uuid;
        body := CASE WHEN jsonb_typeof(entry.value)='string' THEN entry.value #>> '{}' ELSE entry.value->>'result' END;
        IF a.system_type='decisions' THEN
          IF nullif(trim(body),'') IS NULL THEN CONTINUE; END IF;
          SELECT * INTO d FROM public.task_decisions WHERE id=src_id AND tenant_id=m.tenant_id FOR UPDATE;
          IF NOT FOUND THEN RAISE EXCEPTION 'Entscheidung nicht zugänglich: %',src_id; END IF;
          UPDATE public.task_decisions SET meeting_result=body, meeting_id=m.id WHERE id=d.id AND tenant_id=m.tenant_id;
          IF NOT FOUND THEN RAISE EXCEPTION 'Keine Berechtigung zum Dokumentieren dieser Entscheidung'; END IF;
          count_decisions := count_decisions+1;
          CONTINUE;
        END IF;
        label := null; parent_id := null; assignees := ARRAY[me]; due := now()+interval '7 days';
        IF a.system_type='birthdays' AND entry.value->>'action' IN ('card','mail','call','gift') THEN
          SELECT id,name INTO contact FROM public.contacts WHERE id=src_id AND tenant_id=m.tenant_id;
          IF NOT FOUND THEN RAISE EXCEPTION 'Geburtstagskontakt nicht zugänglich'; END IF;
          label := 'Geburtstag: ' || CASE entry.value->>'action' WHEN 'card' THEN 'Karte' WHEN 'mail' THEN 'Mail' WHEN 'call' THEN 'Anruf' ELSE 'Geschenk' END || ' für ' || contact.name;
          body := label; due := now()+interval '3 days'; src_type := 'jour_fixe_birthday';
        ELSIF a.system_type='tasks' AND nullif(trim(body),'') IS NOT NULL THEN
          SELECT * INTO t FROM public.tasks WHERE id=src_id AND tenant_id=m.tenant_id;
          IF NOT FOUND THEN RAISE EXCEPTION 'Verknüpfte Aufgabe nicht zugänglich'; END IF;
          label := left(body,200); parent_id := t.id;
          assignees := coalesce(nullif(regexp_split_to_array(regexp_replace(coalesce(t.assigned_to,''),'[{}[:space:]]','','g'),',')::uuid[],ARRAY[]::uuid[]),ARRAY[t.user_id]);
          src_type := 'jour_fixe_task';
        ELSIF entry.value->>'follow_up'='true' AND nullif(trim(body),'') IS NOT NULL THEN
          label := left(body,200); src_type := 'jour_fixe_' || a.system_type;
        ELSE CONTINUE; END IF;
        IF jsonb_typeof(entry.value->'assigned_to')='array' AND jsonb_array_length(entry.value->'assigned_to')>0 THEN
          SELECT array_agg(value::uuid) INTO assignees FROM jsonb_array_elements_text(entry.value->'assigned_to');
        END IF;
        IF nullif(entry.value->>'due_at','') IS NOT NULL THEN due := (entry.value->>'due_at')::timestamptz; END IF;
        assignee := coalesce(assignees[1],me);
        IF EXISTS (SELECT 1 FROM unnest(assignees) u WHERE NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships x WHERE x.user_id=u AND x.tenant_id=m.tenant_id AND x.is_active)) THEN RAISE EXCEPTION 'Zuständige Person gehört nicht zum Büro'; END IF;
        new_id := gen_random_uuid();
        INSERT INTO public.tasks(id,user_id,tenant_id,title,description,status,priority,category,assigned_to,parent_task_id,source_type,source_id,ball_owner,ball_assignee_id,next_action,next_action_due,due_date,timeline)
        VALUES(new_id,me,m.tenant_id,label,'Aus Jour Fixe: '||m.title||E'\n\n'||body,'todo','medium','personal',array_to_string(assignees,','),parent_id,src_type,src_id,'office',assignee,'Beschluss aus Jour Fixe umsetzen: '||label,due,due,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'actorName',actor_name,'text','Aus Jour Fixe: '||m.title||' · Am Zug: Büro')))
        ON CONFLICT DO NOTHING;
        IF FOUND THEN
          count_tasks:=count_tasks+1;
          INSERT INTO public.task_assignees(task_id,user_id,assigned_by) SELECT new_id,u,me FROM unnest(assignees) u ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
      CONTINUE;
    END IF;
    IF nullif(trim(a.result_text),'') IS NULL AND cardinality(a.assigned_to)=0 THEN CONTINUE; END IF;
    IF nullif(trim(a.result_text),'') IS NULL AND a.assigned_to IS NULL THEN CONTINUE; END IF;
    parent_id := null; assignees := a.assigned_to;
    IF a.task_id IS NOT NULL THEN
      IF nullif(trim(a.result_text),'') IS NULL THEN CONTINUE; END IF;
      SELECT * INTO t FROM public.tasks WHERE id=a.task_id AND tenant_id=m.tenant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Verknüpfte Aufgabe nicht zugänglich'; END IF;
      parent_id:=t.id;
      IF coalesce(cardinality(assignees),0)=0 THEN
        assignees:=coalesce(nullif(regexp_split_to_array(regexp_replace(coalesce(t.assigned_to,''),'[{}[:space:]]','','g'),',')::uuid[],ARRAY[]::uuid[]),ARRAY[t.user_id]);
      END IF;
    ELSIF coalesce(cardinality(assignees),0)=0 THEN
      assignees:=ARRAY[me];
      IF followup_id IS NULL THEN
        followup_id:=gen_random_uuid(); due:=now()+interval '7 days';
        INSERT INTO public.tasks(id,user_id,tenant_id,title,description,status,priority,category,assigned_to,source_type,source_id,ball_owner,ball_assignee_id,next_action,next_action_due,due_date,timeline)
        VALUES(followup_id,me,m.tenant_id,'Nachbereitung '||m.title,'Nachbereitung der Besprechung','todo','medium','personal',me::text,'jour_fixe_summary',m.id,'office',me,'Ergebnisse aus Jour Fixe umsetzen',due,due,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'text','Nachbereitung aus Jour Fixe: '||m.title)))
        ON CONFLICT DO NOTHING;
        IF NOT FOUND THEN SELECT id INTO followup_id FROM public.tasks WHERE tenant_id=m.tenant_id AND source_type='jour_fixe_summary' AND source_id=m.id; ELSE
          count_tasks:=count_tasks+1;
          INSERT INTO public.task_assignees(task_id,user_id,assigned_by) VALUES(followup_id,me,me) ON CONFLICT DO NOTHING;
        END IF;
      END IF;
      parent_id:=followup_id;
    END IF;
    assignee:=coalesce(assignees[1],me); due:=now()+interval '7 days';
    IF EXISTS (SELECT 1 FROM unnest(assignees) u WHERE NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships x WHERE x.user_id=u AND x.tenant_id=m.tenant_id AND x.is_active)) THEN RAISE EXCEPTION 'Zuständige Person gehört nicht zum Büro'; END IF;
    label:=CASE WHEN a.task_id IS NOT NULL THEN left(a.result_text,200) ELSE a.title END;
    new_id:=gen_random_uuid();
    INSERT INTO public.tasks(id,user_id,tenant_id,title,description,status,priority,category,assigned_to,parent_task_id,source_type,source_id,ball_owner,ball_assignee_id,next_action,next_action_due,due_date,timeline)
    VALUES(new_id,me,m.tenant_id,label,concat_ws(E'\n\n','Aus Jour Fixe: '||m.title,a.result_text,a.description,a.notes),'todo','medium','personal',array_to_string(assignees,','),parent_id,'jour_fixe_agenda',a.id,'office',assignee,'Beschluss aus Jour Fixe umsetzen: '||label,due,due,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'actorName',actor_name,'text','Aus Jour Fixe: '||m.title||' · Am Zug: Büro')))
    ON CONFLICT DO NOTHING;
    IF FOUND THEN count_tasks:=count_tasks+1; INSERT INTO public.task_assignees(task_id,user_id,assigned_by) SELECT new_id,u,me FROM unnest(assignees) u ON CONFLICT DO NOTHING; END IF;
  END LOOP;
  FOR star IN SELECT * FROM public.starred_appointments WHERE meeting_id=m.id AND tenant_id=m.tenant_id LOOP
    SELECT id,title,start_time INTO ap FROM public.appointments WHERE id=star.appointment_id AND tenant_id=m.tenant_id;
    IF NOT FOUND THEN SELECT e.id,e.title,e.start_time INTO ap FROM public.external_events e JOIN public.external_calendars c ON c.id=e.external_calendar_id WHERE e.id=star.external_event_id AND c.tenant_id=m.tenant_id; END IF;
    IF NOT FOUND THEN CONTINUE; END IF;
    assignees:=star.assigned_to;
    IF coalesce(cardinality(assignees),0)=0 THEN SELECT array_agg(distinct user_id) INTO assignees FROM public.meeting_participants WHERE meeting_id=m.id; END IF;
    IF coalesce(cardinality(assignees),0)=0 THEN assignees:=ARRAY[me]; END IF;
    assignee:=assignees[1]; new_id:=gen_random_uuid(); due:=least(ap.start_time,now()+interval '3 days');
    INSERT INTO public.tasks(id,user_id,tenant_id,title,status,priority,category,assigned_to,source_type,source_id,ball_owner,ball_assignee_id,next_action,next_action_due,due_date,timeline)
    VALUES(new_id,me,m.tenant_id,'Vorbereitung: '||ap.title,'todo','medium','personal',array_to_string(assignees,','),'jour_fixe_starred',star.id,'office',assignee,'Markierten Termin vorbereiten',due,due,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'text','Markierter Termin aus Jour Fixe: '||m.title))) ON CONFLICT DO NOTHING;
    IF FOUND THEN count_tasks:=count_tasks+1; INSERT INTO public.task_assignees(task_id,user_id,assigned_by) SELECT new_id,u,me FROM unnest(assignees) u ON CONFLICT DO NOTHING; END IF;
  END LOOP;
  UPDATE public.meetings SET status='archived' WHERE id=m.id AND tenant_id=m.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Archivierung nicht erlaubt'; END IF;
  RETURN jsonb_build_object('tasks_created',count_tasks,'decisions_documented',count_decisions,'already_archived',false);
END $$;
REVOKE ALL ON FUNCTION public.archive_meeting_with_stafette(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_meeting_with_stafette(uuid) TO authenticated, service_role;