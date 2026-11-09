ALTER TABLE public.annual_task_completions ADD COLUMN IF NOT EXISTS linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS annual_completion_link_unique ON public.annual_task_completions(linked_task_id) WHERE linked_task_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.spawn_annual_task_to_stafette(_annual_task_id uuid, _year integer, _assignee uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.annual_tasks; c public.annual_task_completions; v_owner uuid; v_task uuid := gen_random_uuid(); v_due date; v_actor text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich'; END IF;
 IF _year IS NULL OR _year < 2000 OR _year > 2100 THEN RAISE EXCEPTION 'Ungültiges Jahr'; END IF;
 SELECT * INTO a FROM public.annual_tasks WHERE id = _annual_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Jahresaufgabe nicht gefunden'; END IF;
 IF NOT public.is_tenant_admin(auth.uid(), a.tenant_id) THEN RAISE EXCEPTION 'Nur Abgeordnete und Büroleitung dieses Büros dürfen übergeben'; END IF;
 IF COALESCE(a.is_system_task,false) OR a.execute_function IS NOT NULL THEN RAISE EXCEPTION 'System-Routinen werden nicht als Stafetten-Aufgabe übergeben'; END IF;
 IF a.due_month NOT BETWEEN 1 AND 12 OR (a.due_day IS NOT NULL AND a.due_day NOT BETWEEN 1 AND 31) THEN RAISE EXCEPTION 'Ungültiger Stichtag'; END IF;
 INSERT INTO public.annual_task_completions(annual_task_id,year) VALUES(a.id,_year) ON CONFLICT(annual_task_id,year) DO NOTHING;
 SELECT * INTO c FROM public.annual_task_completions WHERE annual_task_id=a.id AND year=_year FOR UPDATE;
 IF c.linked_task_id IS NOT NULL THEN RETURN c.linked_task_id; END IF;
 IF c.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Jahresaufgabe bereits erledigt'; END IF;
 v_owner := _assignee;
 IF v_owner IS NULL THEN
   SELECT m.user_id INTO v_owner FROM public.user_tenant_memberships m WHERE m.tenant_id=a.tenant_id AND m.is_active AND m.role='bueroleitung' ORDER BY m.user_id LIMIT 1;
   v_owner := COALESCE(v_owner,auth.uid());
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships m WHERE m.tenant_id=a.tenant_id AND m.user_id=v_owner AND m.is_active) THEN RAISE EXCEPTION 'Person gehört nicht zum Büro'; END IF;
 v_due := (make_date(_year,a.due_month,1) + interval '1 month' - interval '1 day')::date;
 IF a.due_day IS NOT NULL THEN v_due := make_date(_year,a.due_month,LEAST(a.due_day,extract(day FROM v_due)::integer)); END IF;
 SELECT display_name INTO v_actor FROM public.profiles WHERE user_id=auth.uid() AND tenant_id=a.tenant_id LIMIT 1;
 INSERT INTO public.tasks(id,user_id,tenant_id,title,description,assigned_to,status,priority,category,due_date,ball_owner,ball_assignee_id,next_action,next_action_due,source_type,source_id,timeline)
 VALUES(v_task,auth.uid(),a.tenant_id,a.title || ' (' || _year || ')',a.description,v_owner::text,'todo','medium','personal',(v_due + time '17:00') AT TIME ZONE 'Europe/Berlin','office',v_owner,a.title,v_due,'annual_task',c.id,
 jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','system','at',now(),'actorName',COALESCE(v_actor,'Büro'),'text','Jahresaufgabe ' || _year || ' ins Büro übergeben')));
 UPDATE public.annual_task_completions SET linked_task_id=v_task WHERE id=c.id;
 RETURN v_task;
END $$;
REVOKE ALL ON FUNCTION public.spawn_annual_task_to_stafette(uuid,integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spawn_annual_task_to_stafette(uuid,integer,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_annual_completion_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.linked_task_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM public.tasks t JOIN public.annual_tasks a ON a.id=NEW.annual_task_id WHERE t.id=NEW.linked_task_id AND t.source_type='annual_task' AND t.source_id=NEW.id AND t.tenant_id=a.tenant_id
 ) THEN RAISE EXCEPTION 'Ungültige Jahresaufgaben-Verknüpfung'; END IF;
 IF TG_OP='UPDATE' AND OLD.linked_task_id IS NOT NULL AND pg_trigger_depth()=1 AND
 (NEW.annual_task_id IS DISTINCT FROM OLD.annual_task_id OR NEW.year IS DISTINCT FROM OLD.year OR NEW.linked_task_id IS DISTINCT FROM OLD.linked_task_id OR NEW.completed_at IS DISTINCT FROM OLD.completed_at OR NEW.completed_by IS DISTINCT FROM OLD.completed_by)
 THEN RAISE EXCEPTION 'Verknüpfte Jahresaufgaben werden über die Büroaufgabe abgeschlossen'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_annual_completion_link BEFORE INSERT OR UPDATE ON public.annual_task_completions FOR EACH ROW EXECUTE FUNCTION public.guard_annual_completion_link();

CREATE OR REPLACE FUNCTION public.sync_annual_task_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 UPDATE public.annual_task_completions c SET completed_at=CASE WHEN NEW.status='completed' THEN now() ELSE NULL END,
 completed_by=CASE WHEN NEW.status='completed' THEN auth.uid() ELSE NULL END
 FROM public.annual_tasks a WHERE c.linked_task_id=NEW.id AND a.id=c.annual_task_id AND a.tenant_id=NEW.tenant_id;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_annual_task_completion AFTER UPDATE OF status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.sync_annual_task_completion();
REVOKE ALL ON FUNCTION public.guard_annual_completion_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_annual_task_completion() FROM PUBLIC, anon, authenticated;