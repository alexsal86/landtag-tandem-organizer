-- Preserve existing compact briefings in the canonical fields before removing legacy keys.
UPDATE public.appointment_preparations SET preparation_data =
  (COALESCE(preparation_data,'{}') || jsonb_strip_nulls(jsonb_build_object(
    'visit_reason_details',COALESCE(preparation_data->'visit_reason_details', preparation_data->'compact_goal'),
    'position_statements',COALESCE(preparation_data->'position_statements', preparation_data->'compact_positions'),
    'materials_needed',COALESCE(preparation_data->'materials_needed', preparation_data->'compact_documents'),
    'questions_answers',COALESCE(preparation_data->'questions_answers', preparation_data->'compact_qa'),
    'facts_figures',COALESCE(preparation_data->'facts_figures', preparation_data->'compact_facts'),
    'debrief_summary',COALESCE(preparation_data->'debrief_summary', preparation_data->'compact_debrief'),
    'conversation_partners',CASE WHEN jsonb_array_length(COALESCE(preparation_data->'conversation_partners','[]')) = 0 AND NULLIF(btrim(preparation_data->>'compact_partners'),'') IS NOT NULL
      THEN (SELECT jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name',name)) FROM regexp_split_to_table(preparation_data->>'compact_partners',E'\n') name WHERE btrim(name) <> '')
      ELSE preparation_data->'conversation_partners' END
  ))) - ARRAY['compact_goal','compact_positions','compact_documents','compact_qa','compact_facts','compact_debrief','compact_partners']
WHERE preparation_data ?| ARRAY['compact_goal','compact_positions','compact_documents','compact_qa','compact_facts','compact_debrief','compact_partners'];

-- Completion criteria shared with the preparation workflow, including legacy compact data.
CREATE OR REPLACE FUNCTION public.appointment_preparation_ready(d jsonb, checklist jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT
   (NULLIF(btrim(d->>'visit_reason'), '') IS NOT NULL OR NULLIF(btrim(COALESCE(d->>'visit_reason_details', d->>'compact_goal')), '') IS NOT NULL)
   AND (EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(d->'conversation_partners','[]')) p WHERE NULLIF(btrim(p->>'name'), '') IS NOT NULL) OR NULLIF(btrim(d->>'compact_partners'),'') IS NOT NULL)
   AND (EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(d->'structured_facts','[]')) f WHERE NULLIF(btrim(f->>'text'),'') IS NOT NULL OR f->>'fact_id' IS NOT NULL) OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(d->'key_topic_items','[]')) t WHERE NULLIF(btrim(t->>'topic'),'') IS NOT NULL) OR NULLIF(btrim(COALESCE(d->>'facts_figures',d->>'compact_facts')),'') IS NOT NULL OR NULLIF(btrim(COALESCE(d->>'position_statements',d->>'compact_positions')),'') IS NOT NULL)
   AND (EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(d->'talking_point_items','[]')) t WHERE NULLIF(btrim(t->>'point'),'') IS NOT NULL)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(d->'qa_pairs','[]')) q WHERE NULLIF(btrim(q->>'question'),'') IS NOT NULL AND NULLIF(btrim(q->>'answer'),'') IS NOT NULL)
     OR NULLIF(btrim(COALESCE(d->>'position_statements',d->>'compact_positions')),'') IS NOT NULL OR NULLIF(btrim(d->>'talking_points'),'') IS NOT NULL OR (jsonb_array_length(COALESCE(d->'qa_pairs','[]')) = 0 AND NULLIF(btrim(COALESCE(d->>'questions_answers',d->>'compact_qa')),'') IS NOT NULL))
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(checklist,'[]')) c WHERE COALESCE(c->>'completed','false') <> 'true');
$$;
CREATE OR REPLACE FUNCTION public.set_appointment_briefing(_appointment_id uuid, _decision text, _assignee uuid DEFAULT NULL, _due timestamptz DEFAULT NULL, _instructions text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_task uuid;
BEGIN
  IF _decision NOT IN ('none','assigned') THEN RAISE EXCEPTION 'invalid decision'; END IF;
  SELECT * INTO a FROM public.appointments WHERE id = _appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT public.has_active_tenant_role(auth.uid(), a.tenant_id, ARRAY['abgeordneter','bueroleitung']) THEN
    RAISE EXCEPTION 'Nur Abgeordnete oder Büroleitung dürfen Briefings vergeben';
  END IF;
  PERFORM set_config('app.briefing_workflow', 'on', true);
  IF _decision = 'none' THEN
    IF a.briefing_task_id IS NOT NULL THEN
      UPDATE public.tasks SET status = 'completed', updated_at = now() WHERE id = a.briefing_task_id AND status <> 'completed';
      PERFORM public._briefing_task_event(a.briefing_task_id, 'Briefing nicht mehr nötig – Aufgabe geschlossen');
    END IF;
    UPDATE public.appointments SET briefing_status = 'none', briefing_assignee_id = NULL, briefing_due_at = NULL, briefing_task_id = NULL WHERE id = a.id;
    RETURN NULL;
  END IF;
  IF _assignee IS NULL THEN RAISE EXCEPTION 'Bitte eine Person wählen'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.user_id = _assignee AND m.tenant_id = a.tenant_id AND m.is_active) THEN
    RAISE EXCEPTION 'Person gehört nicht zum Büro';
  END IF;
  IF a.briefing_task_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tasks WHERE id = a.briefing_task_id AND status <> 'completed') THEN
    v_task := a.briefing_task_id;
    UPDATE public.tasks SET assigned_to = _assignee::text, ball_owner = 'office', ball_assignee_id = _assignee,
      due_date = _due, next_action = 'Briefing erstellen', next_action_due = _due::date,
      description = COALESCE(_instructions, description) WHERE id = v_task;
    PERFORM public._briefing_task_event(v_task, 'Briefing neu vergeben');
  ELSE
    v_task := gen_random_uuid();
    INSERT INTO public.tasks(id, user_id, tenant_id, title, description, assigned_to, status, priority, category, due_date,
      ball_owner, ball_assignee_id, next_action, next_action_due, source_type, source_id, timeline)
    VALUES (v_task, auth.uid(), a.tenant_id, 'Briefing: ' || a.title, _instructions, _assignee::text, 'todo', 'medium', 'personal', _due,
      'office', _assignee, 'Briefing erstellen', _due::date, 'appointment_briefing', a.id::text,
      jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'type','system','at', now(), 'text', 'Briefing beauftragt')));
  END IF;
  UPDATE public.appointments SET briefing_status = 'assigned', briefing_assignee_id = _assignee, briefing_due_at = _due,
    briefing_instructions = _instructions, briefing_task_id = v_task WHERE id = a.id;
  RETURN v_task;
END $$;
REVOKE ALL ON FUNCTION public.set_appointment_briefing(uuid, text, uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_appointment_briefing(uuid, text, uuid, timestamptz, text) TO authenticated;


DROP FUNCTION public.advance_appointment_briefing(uuid, text);
CREATE OR REPLACE FUNCTION public.advance_appointment_briefing(_appointment_id uuid, _action text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; is_decider boolean; p public.appointment_preparations;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = _appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  is_decider := public.has_active_tenant_role(auth.uid(), a.tenant_id, ARRAY['abgeordneter','bueroleitung']);
  PERFORM set_config('app.briefing_workflow', 'on', true);
  IF _action = 'submit' THEN
    IF a.briefing_status <> 'assigned' THEN RAISE EXCEPTION 'Briefing ist nicht in Zuarbeit'; END IF;
    IF NOT (is_decider OR a.briefing_assignee_id = auth.uid()) THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
    UPDATE public.appointments SET briefing_status = 'in_review' WHERE id = a.id;
    UPDATE public.tasks SET ball_owner = 'deputy', ball_assignee_id = NULL, next_action = 'Briefing freigeben' WHERE id = a.briefing_task_id;
    PERFORM public._briefing_task_event(a.briefing_task_id, 'Briefing zur Freigabe vorgelegt – Ball bei Abgeordnete/r');
  ELSIF _action = 'approve' THEN
    IF a.briefing_status <> 'in_review' THEN RAISE EXCEPTION 'Briefing liegt nicht zur Freigabe vor'; END IF;
    IF NOT is_decider THEN RAISE EXCEPTION 'Nur Abgeordnete oder Büroleitung dürfen freigeben'; END IF;
    SELECT * INTO p FROM public.appointment_preparations WHERE appointment_id = a.id AND NOT is_archived ORDER BY created_at LIMIT 1 FOR UPDATE;
    IF NOT FOUND OR NOT public.appointment_preparation_ready(p.preparation_data, p.checklist_items) THEN
      RAISE EXCEPTION 'Vorbereitung unvollständig: Anlass, Gesprächspartner, Fakten/Positionen, Talking Points/Q&A und Checkliste prüfen';
    END IF;
    UPDATE public.appointments SET briefing_status = 'approved' WHERE id = a.id;
    UPDATE public.tasks SET status = 'completed', next_action = NULL WHERE id = a.briefing_task_id;
    PERFORM public._briefing_task_event(a.briefing_task_id, 'Briefing freigegeben – Aufgabe erledigt');
  ELSIF _action = 'return' THEN
    IF a.briefing_status <> 'in_review' THEN RAISE EXCEPTION 'Briefing liegt nicht zur Freigabe vor'; END IF;
    IF NOT is_decider THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
    IF NULLIF(btrim(_note), '') IS NULL THEN RAISE EXCEPTION 'Bitte eine Begründung für die Rückgabe angeben'; END IF;
    UPDATE public.appointments SET briefing_instructions = concat_ws(E'\n', briefing_instructions, 'Rückgabe: ' || _note), briefing_status = 'assigned' WHERE id = a.id;
    UPDATE public.tasks SET ball_owner = 'office', ball_assignee_id = a.briefing_assignee_id, next_action = 'Briefing überarbeiten' WHERE id = a.briefing_task_id;
    PERFORM public._briefing_task_event(a.briefing_task_id, 'Briefing zurück an Zuarbeit: ' || _note);
  ELSE
    RAISE EXCEPTION 'invalid action';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.advance_appointment_briefing(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_appointment_briefing(uuid, text, text) TO authenticated;


-- Changes to briefing content invalidate approval; debrief-only changes do not.
CREATE OR REPLACE FUNCTION public.reopen_changed_appointment_briefing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_task uuid;
BEGIN
  IF (NEW.preparation_data - ARRAY['debrief_summary','debrief_outcomes','debrief_mood','debrief_open_points','debrief_followup_scheduled','debrief_followup_task_id','compact_debrief'])
       IS DISTINCT FROM (OLD.preparation_data - ARRAY['debrief_summary','debrief_outcomes','debrief_mood','debrief_open_points','debrief_followup_scheduled','debrief_followup_task_id','compact_debrief'])
     OR NEW.checklist_items IS DISTINCT FROM OLD.checklist_items OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    PERFORM set_config('app.briefing_workflow', 'on', true);
    UPDATE public.appointments SET briefing_status = 'in_review' WHERE id = NEW.appointment_id AND briefing_status = 'approved' RETURNING briefing_task_id INTO v_task;
    IF FOUND AND v_task IS NOT NULL THEN
      UPDATE public.tasks SET status = 'todo', ball_owner = 'deputy', ball_assignee_id = NULL, next_action = 'Geändertes Briefing erneut freigeben' WHERE id = v_task;
      PERFORM public._briefing_task_event(v_task, 'Briefing geändert – erneute Freigabe erforderlich');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reopen_changed_appointment_briefing AFTER UPDATE ON public.appointment_preparations FOR EACH ROW EXECUTE FUNCTION public.reopen_changed_appointment_briefing();

-- Row lock and transaction keep task creation and its backlink atomic and idempotent.
CREATE OR REPLACE FUNCTION public.create_preparation_followup(_preparation_id uuid, _point_id text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE p public.appointment_preparations; point jsonb; v_task uuid; v_assignee uuid; v_due timestamptz; v_title text; v_points jsonb;
BEGIN
  SELECT * INTO p FROM public.appointment_preparations WHERE id = _preparation_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Vorbereitung nicht verfügbar'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id = p.tenant_id AND user_id = auth.uid() AND is_active) THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF _point_id IS NULL THEN
    IF p.preparation_data->>'debrief_followup_task_id' IS NOT NULL THEN RETURN (p.preparation_data->>'debrief_followup_task_id')::uuid; END IF;
    SELECT start_time + interval '28 days' INTO v_due FROM public.appointments WHERE id = p.appointment_id;
    IF v_due IS NULL THEN RAISE EXCEPTION 'Für den Erfolgs-Check ist ein verknüpfter Termin erforderlich'; END IF;
    v_title := 'Erfolgs-Check: ' || p.title; v_assignee := auth.uid();
  ELSE
    SELECT item INTO point FROM jsonb_array_elements(COALESCE(p.preparation_data->'debrief_open_points','[]')) item WHERE item->>'id' = _point_id;
    IF point IS NULL OR NULLIF(btrim(point->>'text'),'') IS NULL THEN RAISE EXCEPTION 'Offener Punkt fehlt'; END IF;
    IF point->>'task_id' IS NOT NULL THEN RETURN (point->>'task_id')::uuid; END IF;
    IF point->>'task_created' = 'true' THEN RAISE EXCEPTION 'Für diesen Punkt wurde bereits eine Aufgabe angelegt'; END IF;
    v_assignee := COALESCE(NULLIF(point->>'assignee','')::uuid, auth.uid());
    v_title := left(point->>'text',200); v_due := NULLIF(point->>'due_date','')::timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id = p.tenant_id AND user_id = v_assignee AND is_active) THEN RAISE EXCEPTION 'Person gehört nicht zum Büro'; END IF;
  INSERT INTO public.tasks (tenant_id,user_id,assigned_to,title,description,due_date,status,priority,source_type,source_id,ball_owner,ball_assignee_id,next_action)
    VALUES(p.tenant_id,auth.uid(),v_assignee::text,v_title,'Aus Nachbereitung: ' || p.title,v_due,'todo','medium','appointment_preparation',p.id::text,'office',v_assignee,v_title) RETURNING id INTO v_task;
  IF _point_id IS NULL THEN
    UPDATE public.appointment_preparations SET preparation_data = preparation_data || jsonb_build_object('debrief_followup_scheduled',true,'debrief_followup_task_id',v_task) WHERE id = p.id;
  ELSE
    SELECT jsonb_agg(CASE WHEN item->>'id' = _point_id THEN item || jsonb_build_object('task_created',true,'task_id',v_task) ELSE item END ORDER BY ord) INTO v_points
      FROM jsonb_array_elements(p.preparation_data->'debrief_open_points') WITH ORDINALITY AS x(item,ord);
    UPDATE public.appointment_preparations SET preparation_data = preparation_data || jsonb_build_object('debrief_open_points',v_points) WHERE id = p.id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vorbereitung konnte nicht aktualisiert werden'; END IF;
  RETURN v_task;
END $$;
REVOKE ALL ON FUNCTION public.create_preparation_followup(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_preparation_followup(uuid,text) TO authenticated;

-- Prevent direct status/assignment writes from bypassing role-checked workflow RPCs.
CREATE OR REPLACE FUNCTION public.guard_appointment_briefing_workflow()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('app.briefing_workflow', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.briefing_status <> 'undecided' OR NEW.briefing_assignee_id IS NOT NULL OR NEW.briefing_task_id IS NOT NULL THEN
        RAISE EXCEPTION 'Briefings nur über den Freigabeprozess ändern';
      END IF;
    ELSIF ROW(NEW.briefing_status,NEW.briefing_assignee_id,NEW.briefing_task_id,NEW.briefing_due_at,NEW.briefing_instructions)
        IS DISTINCT FROM ROW(OLD.briefing_status,OLD.briefing_assignee_id,OLD.briefing_task_id,OLD.briefing_due_at,OLD.briefing_instructions) THEN
      RAISE EXCEPTION 'Briefings nur über den Freigabeprozess ändern';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_appointment_briefing_workflow BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_briefing_workflow();

-- A stale editor must not erase task backlinks created by the transactional RPC.
CREATE OR REPLACE FUNCTION public.preserve_preparation_task_links()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_points jsonb;
BEGIN
  IF OLD.preparation_data->>'debrief_followup_task_id' IS NOT NULL THEN
    NEW.preparation_data := NEW.preparation_data || jsonb_build_object('debrief_followup_task_id',OLD.preparation_data->>'debrief_followup_task_id','debrief_followup_scheduled',true);
  END IF;
  SELECT jsonb_agg(CASE WHEN prior.item->>'task_id' IS NOT NULL THEN point.item || jsonb_build_object('task_id',prior.item->>'task_id','task_created',true) ELSE point.item END ORDER BY point.ord) INTO v_points
    FROM jsonb_array_elements(COALESCE(NEW.preparation_data->'debrief_open_points','[]')) WITH ORDINALITY point(item,ord)
    LEFT JOIN LATERAL (SELECT item FROM jsonb_array_elements(COALESCE(OLD.preparation_data->'debrief_open_points','[]')) item WHERE item->>'id' = point.item->>'id' LIMIT 1) prior ON true;
  IF v_points IS NOT NULL THEN NEW.preparation_data := NEW.preparation_data || jsonb_build_object('debrief_open_points',v_points); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER preserve_preparation_task_links BEFORE UPDATE ON public.appointment_preparations FOR EACH ROW EXECUTE FUNCTION public.preserve_preparation_task_links();

CREATE TABLE public.appointment_preparation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preparation_id uuid NOT NULL REFERENCES public.appointment_preparations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  actor_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_fields text[] NOT NULL
);
CREATE INDEX ON public.appointment_preparation_history(preparation_id, changed_at DESC);
ALTER TABLE public.appointment_preparation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY preparation_history_read ON public.appointment_preparation_history FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.appointment_preparations p WHERE p.id = preparation_id)
);
GRANT SELECT ON public.appointment_preparation_history TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.appointment_preparation_history FROM authenticated,anon;
CREATE OR REPLACE FUNCTION public.record_preparation_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fields text[];
BEGIN
  SELECT array_agg(n.key ORDER BY n.key) INTO fields FROM jsonb_each(to_jsonb(NEW)) n
    WHERE n.key <> 'updated_at' AND n.value IS DISTINCT FROM to_jsonb(OLD)->n.key;
  IF fields IS NOT NULL THEN
    INSERT INTO public.appointment_preparation_history(preparation_id,tenant_id,actor_id,changed_fields) VALUES(NEW.id,NEW.tenant_id,auth.uid(),fields);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER record_preparation_history AFTER UPDATE ON public.appointment_preparations FOR EACH ROW EXECUTE FUNCTION public.record_preparation_history();
