-- Phase 2. Tasks start only after acknowledgement without objection.
-- "both": employee holds the ball, supervisor is a second task assignee.
CREATE UNIQUE INDEX IF NOT EXISTS employee_action_task_unique ON public.employee_meeting_action_items(task_id) WHERE task_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_meeting_action_task(p_action_item_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.employee_meeting_action_items; m public.employee_meetings; mid uuid; owner_id uuid; v_task uuid; title_text text;
BEGIN
  SELECT meeting_id INTO mid FROM public.employee_meeting_action_items WHERE id=p_action_item_id;
  m:=public.require_employee_meeting_access(mid);
  SELECT * INTO a FROM public.employee_meeting_action_items WHERE id=p_action_item_id AND meeting_id=m.id FOR UPDATE;
  IF NOT FOUND OR a.tenant_id<>m.tenant_id THEN RAISE EXCEPTION 'Maßnahme nicht gefunden' USING ERRCODE='42501'; END IF;
  IF m.status<>'acknowledged' THEN RAISE EXCEPTION 'Maßnahmen werden erst nach Bestätigung zu Aufgaben' USING ERRCODE='22023'; END IF;
  IF a.task_id IS NOT NULL THEN RETURN a.task_id; END IF;
  owner_id:=CASE WHEN a.owner='supervisor' THEN m.conducted_by ELSE m.employee_id END;
  IF NOT public.is_tenant_member(m.tenant_id,owner_id) OR (a.owner='both' AND NOT public.is_tenant_member(m.tenant_id,m.conducted_by)) THEN
    RAISE EXCEPTION 'Die verantwortliche Person gehört nicht zum Büro' USING ERRCODE='22023';
  END IF;
  title_text:=left(btrim(regexp_replace(a.description,'<[^>]*>','','g')),220);
  v_task:=gen_random_uuid();
  INSERT INTO public.tasks(id,user_id,tenant_id,title,description,assigned_to,status,priority,category,due_date,
    ball_owner,ball_assignee_id,next_action,next_action_due,source_type,source_id,timeline)
  VALUES(v_task,m.conducted_by,m.tenant_id,title_text,a.description||E'\n\nMitarbeitergespräch: /employee-meeting/'||m.id,
    owner_id::text,CASE WHEN a.status='completed' THEN 'completed' ELSE 'todo' END,'medium','personal',a.due_date,
    'office',owner_id,CASE WHEN a.status<>'completed' THEN title_text END,a.due_date,'employee_meeting_action',a.id::text,
    jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','system','at',now(),'actorName','System',
      'text','Maßnahme aus bestätigtem Mitarbeitergespräch übernommen')));
  INSERT INTO public.task_assignees(task_id,user_id,assigned_by) VALUES(v_task,owner_id,auth.uid()) ON CONFLICT DO NOTHING;
  IF a.owner='both' THEN
    INSERT INTO public.task_assignees(task_id,user_id,assigned_by) VALUES(v_task,m.conducted_by,auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.employee_meeting_action_items SET task_id=v_task WHERE id=a.id;
  RETURN v_task;
END $$;
REVOKE ALL ON FUNCTION public.create_meeting_action_task(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_meeting_action_task(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_acknowledged_meeting_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item record;
BEGIN
  IF NEW.status='acknowledged' AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR item IN SELECT id FROM public.employee_meeting_action_items WHERE meeting_id=NEW.id AND task_id IS NULL AND status<>'cancelled' ORDER BY id LOOP
      PERFORM public.create_meeting_action_task(item.id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS create_acknowledged_meeting_tasks ON public.employee_meetings;
CREATE TRIGGER create_acknowledged_meeting_tasks AFTER UPDATE OF status ON public.employee_meetings FOR EACH ROW EXECUTE FUNCTION public.create_acknowledged_meeting_tasks();

CREATE OR REPLACE FUNCTION public.sync_employee_action_task_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_TABLE_NAME='tasks' THEN
    -- On the recursive pass values are already equal: no update, no loop.
    UPDATE public.employee_meeting_action_items SET
      status=CASE WHEN NEW.status='completed' THEN 'completed' WHEN NEW.status='in_progress' THEN 'in_progress' ELSE 'open' END,
      completed_at=CASE WHEN NEW.status='completed' THEN coalesce(completed_at,now()) END
    WHERE task_id=NEW.id AND status IS DISTINCT FROM CASE WHEN NEW.status='completed' THEN 'completed' WHEN NEW.status='in_progress' THEN 'in_progress' ELSE 'open' END;
  ELSIF NEW.task_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.tasks SET status=CASE WHEN NEW.status='completed' THEN 'completed' WHEN NEW.status='in_progress' THEN 'in_progress' ELSE 'todo' END,
      next_action=CASE WHEN NEW.status='completed' THEN NULL ELSE title END
    WHERE id=NEW.task_id AND tenant_id=NEW.tenant_id AND
      (CASE WHEN status='completed' THEN 'completed' WHEN status='in_progress' THEN 'in_progress' ELSE 'open' END) IS DISTINCT FROM NEW.status;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_employee_action_from_task ON public.tasks;
CREATE TRIGGER sync_employee_action_from_task AFTER UPDATE OF status ON public.tasks FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.sync_employee_action_task_status();
DROP TRIGGER IF EXISTS sync_employee_task_from_action ON public.employee_meeting_action_items;
CREATE TRIGGER sync_employee_task_from_action AFTER UPDATE OF status ON public.employee_meeting_action_items FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.sync_employee_action_task_status();
REVOKE ALL ON FUNCTION public.create_acknowledged_meeting_tasks(),public.sync_employee_action_task_status() FROM PUBLIC,anon,authenticated;

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='employee_meeting_action_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_meeting_action_items;
  END IF;
END $$;
