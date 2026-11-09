-- Regular appointments are tenant-visible; their preparations and attachments inherit team read access.
-- There is no internet-public access and no copied list of individual team members.
CREATE POLICY "Active team can read linked appointment preparations"
ON public.appointment_preparations FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.tenant_id = appointment_preparations.tenant_id AND m.user_id = auth.uid() AND m.is_active)
  AND EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_preparations.appointment_id AND a.tenant_id = appointment_preparations.tenant_id)
);

CREATE POLICY "Briefing assignee can edit preparation"
ON public.appointment_preparations FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.tenant_id = appointment_preparations.tenant_id AND m.user_id = auth.uid() AND m.is_active)
  AND EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_preparations.appointment_id AND a.tenant_id = appointment_preparations.tenant_id AND a.briefing_assignee_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.tenant_id = appointment_preparations.tenant_id AND m.user_id = auth.uid() AND m.is_active)
  AND EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_preparations.appointment_id AND a.tenant_id = appointment_preparations.tenant_id AND a.briefing_assignee_id = auth.uid())
);

CREATE POLICY "Team can read linked preparation documents"
ON public.appointment_preparation_documents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.appointment_preparations p WHERE p.id = appointment_preparation_documents.preparation_id));

CREATE POLICY "Briefing assignee can manage preparation documents"
ON public.appointment_preparation_documents FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.appointment_preparations p JOIN public.appointments a ON a.id = p.appointment_id AND a.tenant_id = p.tenant_id
  JOIN public.user_tenant_memberships m ON m.tenant_id = p.tenant_id AND m.user_id = auth.uid() AND m.is_active
  WHERE p.id = appointment_preparation_documents.preparation_id AND a.briefing_assignee_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.appointment_preparations p JOIN public.appointments a ON a.id = p.appointment_id AND a.tenant_id = p.tenant_id
  JOIN public.user_tenant_memberships m ON m.tenant_id = p.tenant_id AND m.user_id = auth.uid() AND m.is_active
  WHERE p.id = appointment_preparation_documents.preparation_id AND a.briefing_assignee_id = auth.uid()
));

-- Assignment, depth, task and preparation are saved in one transaction.
DROP FUNCTION public.set_appointment_briefing(uuid, text, uuid, timestamptz, text);
CREATE OR REPLACE FUNCTION public.set_appointment_briefing(_appointment_id uuid, _decision text, _assignee uuid DEFAULT NULL, _due timestamptz DEFAULT NULL, _instructions text DEFAULT NULL, _depth text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_task uuid;
BEGIN
  IF _depth IS NOT NULL AND _depth NOT IN ('compact','full') THEN RAISE EXCEPTION 'invalid depth'; END IF;
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
    briefing_instructions = _instructions, briefing_task_id = v_task, briefing_depth = COALESCE(_depth, briefing_depth) WHERE id = a.id;
  -- A briefing assignment always has an editable, team-visible preparation.
  -- The locked appointment serialises repeated assignments, so they reuse the same record.
  IF NOT EXISTS (SELECT 1 FROM public.appointment_preparations p WHERE p.appointment_id = a.id AND p.tenant_id = a.tenant_id AND NOT p.is_archived) THEN
    INSERT INTO public.appointment_preparations (appointment_id, tenant_id, created_by, title, status, checklist_items)
    VALUES (a.id, a.tenant_id, auth.uid(), 'Terminvorbereitung: ' || a.title, 'draft', jsonb_build_array(
      jsonb_build_object('id',gen_random_uuid(),'label','Agenda vorbereiten','completed',false),
      jsonb_build_object('id',gen_random_uuid(),'label','Unterlagen zusammenstellen','completed',false),
      jsonb_build_object('id',gen_random_uuid(),'label','Teilnehmer informieren','completed',false)
    ));
  END IF;
  RETURN v_task;
END $$;
REVOKE ALL ON FUNCTION public.set_appointment_briefing(uuid, text, uuid, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_appointment_briefing(uuid, text, uuid, timestamptz, text, text) TO authenticated;

-- Existing assignments receive a preparation too; existing content is kept.
INSERT INTO public.appointment_preparations (appointment_id,tenant_id,created_by,title,status)
SELECT a.id,a.tenant_id,a.user_id,'Terminvorbereitung: ' || a.title,'draft'
FROM public.appointments a
WHERE a.briefing_status IN ('assigned','in_review') AND a.briefing_assignee_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.appointment_preparations p WHERE p.appointment_id = a.id AND NOT p.is_archived);
