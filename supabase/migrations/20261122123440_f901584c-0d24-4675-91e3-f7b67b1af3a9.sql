ALTER TABLE public.task_decisions ADD COLUMN IF NOT EXISTS case_file_id uuid REFERENCES public.case_files(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS task_decisions_case_file_id_idx ON public.task_decisions(case_file_id);

CREATE OR REPLACE FUNCTION public.create_work_decision(p_id uuid,p_data jsonb,p_participants uuid[],p_note_id uuid DEFAULT NULL) RETURNS jsonb
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
 IF EXISTS(SELECT 1 FROM unnest(p_participants) u WHERE NOT public.is_tenant_member((p_data->>'tenant_id')::uuid, u)) THEN
  RAISE EXCEPTION 'Teilnehmer gehört nicht zum Büro' USING ERRCODE='42501';
 END IF;
 INSERT INTO task_decisions(id,title,description,created_by,tenant_id,task_id,case_item_id,case_file_id,response_deadline,response_options,priority,visible_to_all)
 VALUES(p_id,p_data->>'title',p_data->>'description',auth.uid(),(p_data->>'tenant_id')::uuid,(p_data->>'task_id')::uuid,(p_data->>'case_item_id')::uuid,(p_data->>'case_file_id')::uuid,(p_data->>'response_deadline')::timestamptz,p_data->'response_options',coalesce((p_data->>'priority')::integer,0),coalesce((p_data->>'visible_to_all')::boolean,false)) RETURNING * INTO d;
 INSERT INTO task_decision_participants(decision_id,user_id) SELECT d.id,u FROM (SELECT DISTINCT unnest(p_participants) u) members;
 IF p_note_id IS NOT NULL THEN UPDATE quick_notes SET decision_id=d.id WHERE id=p_note_id; END IF;
 RETURN to_jsonb(d);
END $$;
REVOKE ALL ON FUNCTION public.create_work_decision(uuid,jsonb,uuid[],uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_work_decision(uuid,jsonb,uuid[],uuid) TO authenticated;