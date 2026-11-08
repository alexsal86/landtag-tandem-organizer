DROP INDEX IF EXISTS public.tasks_meeting_followup_source_unique;
CREATE UNIQUE INDEX tasks_meeting_followup_source_unique ON public.tasks(tenant_id, meeting_id, source_type, source_id) WHERE source_type LIKE 'jour_fixe_%' AND source_id IS NOT NULL;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.archive_meeting_with_stafette(uuid)'::regprocedure) INTO definition;
 definition := replace(definition,'followup_id uuid;','followup_id uuid; appt_parent uuid; next_meeting uuid; review_parent uuid;');
 definition := replace(definition,'NOT (m.tenant_id = ANY(public.get_user_tenant_ids(me)))','NOT coalesce(m.tenant_id = ANY(public.get_user_tenant_ids(me)),false)');
 definition := replace(definition,'id,user_id,tenant_id,title','id,meeting_id,user_id,tenant_id,title');
 definition := replace(definition,'VALUES(new_id,me,m.tenant_id','VALUES(new_id,m.id,me,m.tenant_id');
 definition := replace(definition,'VALUES(followup_id,me,m.tenant_id','VALUES(followup_id,m.id,me,m.tenant_id');
 definition := replace(definition,$old$source_type='jour_fixe_summary' AND source_id=m.id$old$,$new$source_type='jour_fixe_summary' AND source_id=m.id AND meeting_id=m.id$new$);
 definition := replace(definition,$old$    assignee:=assignees[1]; new_id:=gen_random_uuid(); due:=least(ap.start_time,now()+interval '3 days');$old$,$block$
    IF EXISTS (SELECT 1 FROM unnest(assignees) u WHERE NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships x WHERE x.user_id=u AND x.tenant_id=m.tenant_id AND x.is_active)) THEN RAISE EXCEPTION 'Zuständige Person gehört nicht zum Büro'; END IF;
    IF appt_parent IS NULL THEN
      appt_parent:=gen_random_uuid();
      INSERT INTO public.tasks(id,meeting_id,user_id,tenant_id,title,status,priority,category,assigned_to,source_type,source_id,ball_owner,ball_assignee_id,next_action,next_action_due,due_date,timeline)
      VALUES(appt_parent,m.id,me,m.tenant_id,'Vorbereitung: Markierte Termine aus '||m.title,'todo','medium','personal',array_to_string(assignees,','),'jour_fixe_appointments',m.id,'office',assignees[1],'Markierte Termine vorbereiten',now()+interval '3 days',now()+interval '3 days',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'text','Markierte Termine aus Jour Fixe: '||m.title))) ON CONFLICT DO NOTHING;
      IF NOT FOUND THEN SELECT id INTO appt_parent FROM public.tasks WHERE tenant_id=m.tenant_id AND meeting_id=m.id AND source_type='jour_fixe_appointments' AND source_id=m.id; ELSE
        count_tasks:=count_tasks+1; INSERT INTO public.task_assignees(task_id,user_id,assigned_by) SELECT appt_parent,u,me FROM unnest(assignees) u ON CONFLICT DO NOTHING;
      END IF;
    END IF;
    assignee:=assignees[1]; new_id:=gen_random_uuid(); due:=least(ap.start_time,now()+interval '3 days');
$block$);
 definition := replace(definition,$old$assigned_to,source_type,source_id,ball_owner,ball_assignee_id,next_action,next_action_due,due_date,timeline)
    VALUES(new_id,m.id,me,m.tenant_id,'Vorbereitung: '$old$,$new$assigned_to,parent_task_id,source_type,source_id,ball_owner,ball_assignee_id,next_action,next_action_due,due_date,timeline)
    VALUES(new_id,m.id,me,m.tenant_id,'Vorbereitung: '$new$);
 definition := replace(definition,$old$array_to_string(assignees,','),'jour_fixe_starred'$old$,$new$array_to_string(assignees,','),appt_parent,'jour_fixe_starred'$new$);
 definition := replace(definition,$old$  UPDATE public.meetings SET status='archived'$old$,$block$
  IF m.template_id IS NOT NULL THEN
    SELECT id INTO next_meeting FROM public.meetings WHERE tenant_id=m.tenant_id AND template_id=m.template_id AND status='planned' AND meeting_date>m.meeting_date ORDER BY meeting_date LIMIT 1 FOR UPDATE;
  END IF;
  FOR a IN SELECT * FROM public.meeting_agenda_items WHERE meeting_id=m.id AND carry_over_to_next LOOP
    IF next_meeting IS NOT NULL THEN
      IF review_parent IS NULL THEN
        SELECT id INTO review_parent FROM public.meeting_agenda_items WHERE meeting_id=next_meeting AND title='Rückblick' AND parent_id IS NULL LIMIT 1;
        IF review_parent IS NULL THEN
          review_parent:=gen_random_uuid();
          UPDATE public.meeting_agenda_items SET order_index=order_index+1 WHERE meeting_id=next_meeting AND parent_id IS NULL;
          INSERT INTO public.meeting_agenda_items(id,meeting_id,title,order_index,is_completed,is_recurring) VALUES(review_parent,next_meeting,'Rückblick',0,false,false);
        END IF;
      END IF;
      IF NOT EXISTS(SELECT 1 FROM public.meeting_agenda_items WHERE meeting_id=next_meeting AND carried_over_from=a.id) THEN
        INSERT INTO public.meeting_agenda_items(meeting_id,parent_id,title,description,notes,result_text,assigned_to,order_index,source_meeting_id,carried_over_from,original_meeting_date,original_meeting_title,carryover_notes)
        VALUES(next_meeting,review_parent,a.title,a.description,a.notes,a.result_text,a.assigned_to,a.order_index,m.id,a.id,m.meeting_date,m.title,'Übertragen aus Jour Fixe: '||m.title);
      END IF;
    ELSIF m.template_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.carryover_items WHERE original_meeting_id=m.id AND title=a.title AND user_id=me) THEN
      INSERT INTO public.carryover_items(user_id,template_id,title,description,notes,result_text,assigned_to,order_index,original_meeting_id,original_meeting_date,original_meeting_title)
      VALUES(me,m.template_id,a.title,a.description,a.notes,a.result_text,a.assigned_to,a.order_index,m.id,m.meeting_date,m.title);
    END IF;
  END LOOP;
  UPDATE public.meetings SET status='archived'
$block$);
 EXECUTE definition;
END $migration$;