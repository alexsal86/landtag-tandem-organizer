-- User-facing transitions run with the caller's RLS, locks serialize retries.
ALTER TABLE public.task_decisions ADD COLUMN case_file_id uuid REFERENCES public.case_files(id) ON DELETE SET NULL;
CREATE INDEX ON public.task_decisions(case_file_id);

CREATE FUNCTION public.validate_decision_case_file() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.case_file_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM case_files WHERE id=NEW.case_file_id AND tenant_id=NEW.tenant_id) THEN
  RAISE EXCEPTION 'Kein Zugriff auf die Akte' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decision_case_file BEFORE INSERT OR UPDATE ON public.task_decisions FOR EACH ROW EXECUTE FUNCTION public.validate_decision_case_file();

CREATE FUNCTION public.create_note_work(p_note_id uuid, p_kind text) RETURNS uuid
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n public.quick_notes%ROWTYPE; result uuid; headline text; prio text;
BEGIN
 SELECT * INTO n FROM quick_notes WHERE id=p_note_id AND user_id=auth.uid() AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kein Zugriff auf die Notiz' USING ERRCODE='42501'; END IF;
 headline := coalesce(nullif(regexp_replace(n.title,'<[^>]*>','','g'),''),left(regexp_replace(n.content,'<[^>]*>','','g'),100),'Ohne Titel');
 prio := CASE WHEN coalesce(n.priority_level,0)<=1 THEN 'low' WHEN n.priority_level=2 THEN 'medium' ELSE 'high' END;
 IF p_kind='task' THEN
  IF n.task_id IS NOT NULL THEN RETURN n.task_id; END IF;
  INSERT INTO tasks(user_id,tenant_id,title,description,assigned_to,priority,category,status,source_type,source_id)
   VALUES(auth.uid(),n.tenant_id,headline,n.content,auth.uid()::text,prio,'personal','todo','quick_note',n.id) RETURNING id INTO result;
  UPDATE quick_notes SET task_id=result WHERE id=n.id;
 ELSIF p_kind='case' THEN
  IF n.case_item_id IS NOT NULL THEN RETURN n.case_item_id; END IF;
  INSERT INTO case_items(user_id,tenant_id,owner_user_id,subject,summary,status,priority,source_channel,intake_payload)
   VALUES(auth.uid(),n.tenant_id,auth.uid(),headline,n.content,'neu',prio,'other',jsonb_build_object('source_note_id',n.id)) RETURNING id INTO result;
  UPDATE quick_notes SET case_item_id=result WHERE id=n.id;
 ELSE RAISE EXCEPTION 'Unbekannter Zieltyp'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.create_decision_task(p_decision_id uuid) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE d public.task_decisions%ROWTYPE; result uuid; file_id uuid; yes_count int; no_count int; outcome text;
BEGIN
 SELECT * INTO d FROM task_decisions WHERE id=p_decision_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Kein Zugriff auf die Entscheidung' USING ERRCODE='42501'; END IF;
 SELECT id INTO result FROM tasks WHERE tenant_id=d.tenant_id AND source_type='decision' AND source_id=d.id LIMIT 1;
 IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT count(*) FILTER(WHERE response_type='yes'),count(*) FILTER(WHERE response_type='no') INTO yes_count,no_count
 FROM (SELECT DISTINCT ON (participant_id) participant_id,response_type FROM task_decision_responses WHERE decision_id=d.id ORDER BY participant_id,created_at DESC) latest;
 outcome:=CASE WHEN yes_count>no_count THEN 'Angenommen' WHEN no_count>yes_count THEN 'Abgelehnt' ELSE 'Unentschieden' END;
 INSERT INTO tasks(user_id,tenant_id,title,description,assigned_to,priority,category,status,source_type,source_id)
 VALUES(auth.uid(),d.tenant_id,'[Entscheidung] '||d.title,concat_ws(E'\n',d.description,'Ergebnis: '||outcome||' (Ja: '||yes_count||', Nein: '||no_count||')'),auth.uid()::text,'medium','personal','todo','decision',d.id) RETURNING id INTO result;
 file_id:=d.case_file_id;
 IF file_id IS NULL AND d.case_item_id IS NOT NULL THEN SELECT case_file_id INTO file_id FROM case_items WHERE id=d.case_item_id; END IF;
 IF file_id IS NOT NULL THEN INSERT INTO case_file_tasks(case_file_id,task_id) VALUES(file_id,result); END IF;
 RETURN result;
END $$;

-- Reverse synchronization is guarded by value comparisons in both directions. Lock order is task -> case here;
-- concurrent opposing writes may be retried after PostgreSQL deadlock detection.
CREATE FUNCTION public.sync_case_step_from_task() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.source_type IS DISTINCT FROM 'case_step' THEN RETURN NULL; END IF;
 IF auth.uid() IS NOT NULL AND NOT public.user_can_access_case_item(auth.uid(),NEW.source_id) THEN RAISE EXCEPTION 'Kein Zugriff auf den Vorgang' USING ERRCODE='42501'; END IF;
 IF NEW.status IN ('completed','cancelled') AND OLD.status IS DISTINCT FROM NEW.status AND pg_trigger_depth()=1 THEN
  UPDATE case_items SET next_action_label=NULL,next_action_due_at=NULL,next_action_assignee_id=NULL WHERE id=NEW.source_id AND tenant_id=NEW.tenant_id;
 ELSIF NEW.status NOT IN ('completed','cancelled') THEN
  UPDATE case_items SET next_action_label=NEW.title,next_action_due_at=NEW.due_date,
   next_action_assignee_id=CASE WHEN NEW.assigned_to ~ '^[0-9a-fA-F-]{36}$' THEN NEW.assigned_to::uuid ELSE next_action_assignee_id END
   WHERE id=NEW.source_id AND tenant_id=NEW.tenant_id AND (NEW.title,NEW.due_date,NEW.assigned_to) IS DISTINCT FROM (OLD.title,OLD.due_date,OLD.assigned_to);
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER case_step_reverse AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.sync_case_step_from_task();
REVOKE ALL ON FUNCTION public.create_note_work(uuid,text),public.create_decision_task(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_note_work(uuid,text),public.create_decision_task(uuid) TO authenticated;

CREATE FUNCTION public.create_work_decision(p_id uuid,p_data jsonb,p_participants uuid[],p_note_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE d public.task_decisions%ROWTYPE; n public.quick_notes%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 IF p_note_id IS NOT NULL THEN
  SELECT * INTO n FROM quick_notes WHERE id=p_note_id AND user_id=auth.uid() AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR n.tenant_id::text IS DISTINCT FROM p_data->>'tenant_id' THEN RAISE EXCEPTION 'Kein Zugriff auf die Notiz' USING ERRCODE='42501'; END IF;
  IF n.decision_id IS NOT NULL THEN SELECT * INTO d FROM task_decisions WHERE id=n.decision_id; RETURN to_jsonb(d); END IF;
 END IF;
 SELECT * INTO d FROM task_decisions WHERE id=p_id AND created_by=auth.uid();
 IF FOUND THEN RETURN to_jsonb(d); END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_participants) u WHERE NOT EXISTS(SELECT 1 FROM user_tenant_memberships m WHERE m.user_id=u AND m.tenant_id=(p_data->>'tenant_id')::uuid AND m.is_active)) THEN
  RAISE EXCEPTION 'Teilnehmer gehört nicht zum Büro' USING ERRCODE='42501';
 END IF;
 INSERT INTO task_decisions(id,title,description,created_by,tenant_id,task_id,case_item_id,case_file_id,response_deadline,response_options,priority,visible_to_all)
 VALUES(p_id,p_data->>'title',p_data->>'description',auth.uid(),(p_data->>'tenant_id')::uuid,(p_data->>'task_id')::uuid,(p_data->>'case_item_id')::uuid,(p_data->>'case_file_id')::uuid,(p_data->>'response_deadline')::timestamptz,p_data->'response_options',coalesce((p_data->>'priority')::integer,0),coalesce((p_data->>'visible_to_all')::boolean,false)) RETURNING * INTO d;
 INSERT INTO task_decision_participants(decision_id,user_id) SELECT d.id,u FROM (SELECT DISTINCT unnest(p_participants) u) members;
 IF p_note_id IS NOT NULL THEN UPDATE quick_notes SET decision_id=d.id WHERE id=p_note_id; END IF;
 RETURN to_jsonb(d);
END $$;
REVOKE ALL ON FUNCTION public.create_work_decision(uuid,jsonb,uuid[],uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_work_decision(uuid,jsonb,uuid[],uuid) TO authenticated;

CREATE FUNCTION public.create_case_file_task(p_id uuid,p_case_file_id uuid,p_title text,p_assigned_to text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE f public.case_files%ROWTYPE; existing uuid;
BEGIN
 SELECT * INTO f FROM case_files WHERE id=p_case_file_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR nullif(btrim(p_title),'') IS NULL THEN RAISE EXCEPTION 'Akte oder Aufgabentitel fehlt' USING ERRCODE='42501'; END IF;
 SELECT task_id INTO existing FROM case_file_tasks WHERE case_file_id=f.id AND task_id=p_id;
 IF existing IS NOT NULL THEN RETURN existing; END IF;
 INSERT INTO tasks(id,user_id,tenant_id,title,assigned_to,priority,category,status,source_type,source_id)
 VALUES(p_id,auth.uid(),f.tenant_id,btrim(p_title),coalesce(p_assigned_to,auth.uid()::text),'medium','personal','todo','case_file',f.id);
 INSERT INTO case_file_tasks(case_file_id,task_id) VALUES(f.id,p_id);
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.create_case_file_task(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_case_file_task(uuid,uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_case_step_from_task() FROM PUBLIC;

-- The archive RPC can delete directly, without a preceding status update.
CREATE FUNCTION public.complete_case_step_on_archive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.source_type='case_step' AND EXISTS(SELECT 1 FROM archived_tasks WHERE task_id=OLD.id) THEN
  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_case_item(auth.uid(),OLD.source_id) THEN RAISE EXCEPTION 'Kein Zugriff auf den Vorgang' USING ERRCODE='42501'; END IF;
  UPDATE case_items SET next_action_label=NULL,next_action_due_at=NULL,next_action_assignee_id=NULL
   WHERE id=OLD.source_id AND tenant_id=OLD.tenant_id;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER case_step_archived AFTER DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.complete_case_step_on_archive();
REVOKE ALL ON FUNCTION public.complete_case_step_on_archive() FROM PUBLIC;
