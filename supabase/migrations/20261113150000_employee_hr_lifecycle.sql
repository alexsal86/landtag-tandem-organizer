-- HR is an additional context for the existing durable routine packages.
CREATE TABLE IF NOT EXISTS public.employee_lifecycle (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), employment_type text NOT NULL CHECK(length(employment_type) BETWEEN 1 AND 40),
 start_date date NOT NULL, end_date date, mentor_user_id uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(end_date IS NULL OR end_date>=start_date),
 UNIQUE(tenant_id,user_id,start_date), UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.employee_hr_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),employment_type text NOT NULL CHECK(length(employment_type) BETWEEN 1 AND 40),
 direction text NOT NULL CHECK(direction IN ('onboarding','offboarding')),steps jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,employment_type,direction), UNIQUE(tenant_id,id)
);
ALTER TABLE public.routine_package_runs ALTER COLUMN annual_task_id DROP NOT NULL;
ALTER TABLE public.routine_package_runs ADD COLUMN IF NOT EXISTS employee_lifecycle_id uuid;
ALTER TABLE public.routine_package_runs ADD COLUMN IF NOT EXISTS hr_direction text CHECK(hr_direction IN ('onboarding','offboarding'));
ALTER TABLE public.routine_package_runs ADD COLUMN IF NOT EXISTS hr_template_id uuid REFERENCES public.employee_hr_templates(id);
ALTER TABLE public.routine_package_runs ADD COLUMN IF NOT EXISTS hr_template_revision integer;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='hr_run_lifecycle_tenant_fk') THEN
 ALTER TABLE public.routine_package_runs ADD CONSTRAINT hr_run_lifecycle_tenant_fk FOREIGN KEY(tenant_id,employee_lifecycle_id) REFERENCES public.employee_lifecycle(tenant_id,id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='routine_run_context_check') THEN
 ALTER TABLE public.routine_package_runs ADD CONSTRAINT routine_run_context_check CHECK(
  (annual_task_id IS NOT NULL AND employee_lifecycle_id IS NULL AND hr_direction IS NULL) OR
  (annual_task_id IS NULL AND employee_lifecycle_id IS NOT NULL AND hr_direction IS NOT NULL));
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS hr_run_once_per_employment ON public.routine_package_runs(employee_lifecycle_id,hr_direction) WHERE employee_lifecycle_id IS NOT NULL;
ALTER TABLE public.routine_package_steps ADD COLUMN IF NOT EXISTS hr_phase text CHECK(hr_phase IN ('before_start','first_week','probation_or_end'));
ALTER TABLE public.routine_package_steps ADD COLUMN IF NOT EXISTS is_mandatory boolean NOT NULL DEFAULT false;
ALTER TABLE public.routine_package_steps ADD COLUMN IF NOT EXISTS hr_anchor_day date;
ALTER TABLE public.routine_package_steps ADD COLUMN IF NOT EXISTS hr_evidence_kind text NOT NULL DEFAULT 'none' CHECK(hr_evidence_kind IN ('none','gdpr','handover'));
CREATE TABLE IF NOT EXISTS public.employee_hr_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 step_id uuid NOT NULL UNIQUE REFERENCES public.routine_package_steps(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),confirmed_on date NOT NULL,confirmed_by uuid NOT NULL REFERENCES auth.users(id),
 document_id uuid REFERENCES public.documents(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.employee_hr_reminder_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 lifecycle_id uuid NOT NULL REFERENCES public.employee_lifecycle(id),recipient_id uuid NOT NULL REFERENCES auth.users(id),
 reminder_day date NOT NULL,UNIQUE(lifecycle_id,recipient_id,reminder_day)
);
CREATE OR REPLACE FUNCTION public.can_view_employee_hr(p_tenant uuid,p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.user_belongs_to_tenant(p_tenant) AND (auth.uid()=p_user OR public.is_tenant_config_admin(p_tenant))
$$;
REVOKE ALL ON FUNCTION public.can_view_employee_hr(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_view_employee_hr(uuid,uuid) TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['employee_lifecycle','employee_hr_templates','employee_hr_evidence','employee_hr_reminder_log'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
END $$;
DROP POLICY IF EXISTS hr_lifecycle_read ON public.employee_lifecycle;
CREATE POLICY hr_lifecycle_read ON public.employee_lifecycle FOR SELECT TO authenticated USING(public.can_view_employee_hr(tenant_id,user_id));
DROP POLICY IF EXISTS hr_templates_read ON public.employee_hr_templates;
CREATE POLICY hr_templates_read ON public.employee_hr_templates FOR SELECT TO authenticated USING(public.is_tenant_config_admin(tenant_id));
DROP POLICY IF EXISTS hr_evidence_read ON public.employee_hr_evidence;
CREATE POLICY hr_evidence_read ON public.employee_hr_evidence FOR SELECT TO authenticated USING(public.can_view_employee_hr(tenant_id,user_id));
DROP POLICY IF EXISTS hr_reminders_read ON public.employee_hr_reminder_log;
CREATE POLICY hr_reminders_read ON public.employee_hr_reminder_log FOR SELECT TO authenticated USING(public.can_view_employee_hr(tenant_id,recipient_id));
DROP POLICY IF EXISTS hr_run_read ON public.routine_package_runs;
CREATE POLICY hr_run_read ON public.routine_package_runs FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.employee_lifecycle e WHERE e.id=employee_lifecycle_id AND public.can_view_employee_hr(e.tenant_id,e.user_id)));
DROP POLICY IF EXISTS hr_run_boundary ON public.routine_package_runs;
CREATE POLICY hr_run_boundary ON public.routine_package_runs AS RESTRICTIVE FOR SELECT TO authenticated USING(employee_lifecycle_id IS NULL OR EXISTS(SELECT 1 FROM public.employee_lifecycle e WHERE e.id=employee_lifecycle_id AND public.can_view_employee_hr(e.tenant_id,e.user_id)));
DROP POLICY IF EXISTS hr_step_read ON public.routine_package_steps;
CREATE POLICY hr_step_read ON public.routine_package_steps FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.routine_package_runs r WHERE r.id=run_id AND r.employee_lifecycle_id IS NOT NULL));
DROP POLICY IF EXISTS hr_step_boundary ON public.routine_package_steps;
CREATE POLICY hr_step_boundary ON public.routine_package_steps AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.routine_package_runs r WHERE r.id=run_id));
-- Existing broad task policies must not expose other employees' HR points.
CREATE OR REPLACE FUNCTION public.hr_task_visible(p_task uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM routine_package_runs r JOIN employee_lifecycle e ON e.id=r.employee_lifecycle_id
 WHERE (r.task_id=p_task OR EXISTS(SELECT 1 FROM routine_package_steps s WHERE s.run_id=r.id AND s.kind='task' AND s.entity_id=p_task))
 AND NOT public.can_view_employee_hr(e.tenant_id,e.user_id))
$$;
REVOKE ALL ON FUNCTION public.hr_task_visible(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_task_visible(uuid) TO authenticated;
DROP POLICY IF EXISTS hr_task_boundary ON public.tasks;
CREATE POLICY hr_task_boundary ON public.tasks AS RESTRICTIVE FOR ALL TO authenticated USING(public.hr_task_visible(id)) WITH CHECK(public.hr_task_visible(id));
DROP POLICY IF EXISTS hr_subtask_boundary ON public.subtasks;
CREATE POLICY hr_subtask_boundary ON public.subtasks AS RESTRICTIVE FOR ALL TO authenticated USING(public.hr_task_visible(task_id)) WITH CHECK(public.hr_task_visible(task_id));

CREATE OR REPLACE FUNCTION public.save_employee_lifecycle(p_tenant uuid,p_user uuid,p_type text,p_start date,p_end date DEFAULT NULL,p_mentor uuid DEFAULT NULL,p_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF NOT is_tenant_config_admin(p_tenant) OR NOT user_belongs_to_tenant(p_tenant) THEN RAISE EXCEPTION 'Nur die Büroleitung oder Abgeordnete dürfen Beschäftigungen ändern.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_user)
 OR (p_mentor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_mentor AND is_active)) THEN RAISE EXCEPTION 'Person oder Mentor gehört nicht zum Büro.' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO employee_lifecycle(tenant_id,user_id,employment_type,start_date,end_date,mentor_user_id) VALUES(p_tenant,p_user,btrim(p_type),p_start,p_end,p_mentor)
  ON CONFLICT(tenant_id,user_id,start_date) DO UPDATE SET employment_type=excluded.employment_type,end_date=excluded.end_date,mentor_user_id=excluded.mentor_user_id RETURNING id INTO result;
 ELSE
  UPDATE employee_lifecycle SET employment_type=btrim(p_type),start_date=p_start,end_date=p_end,mentor_user_id=p_mentor WHERE id=p_id AND tenant_id=p_tenant AND user_id=p_user RETURNING id INTO result;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'Beschäftigung nicht gefunden.' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_employee_lifecycle(uuid,uuid,text,date,date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_employee_lifecycle(uuid,uuid,text,date,date,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_employee_hr_template(p_tenant uuid,p_name text,p_type text,p_direction text,p_steps jsonb,p_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; result uuid;
BEGIN
 IF NOT is_tenant_config_admin(p_tenant) OR NOT user_belongs_to_tenant(p_tenant) THEN RAISE EXCEPTION 'Keine Berechtigung für HR-Vorlagen.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_steps) IS DISTINCT FROM 'array' OR jsonb_array_length(p_steps) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Eine Vorlage benötigt 1–20 Schritte.' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_steps) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR length(btrim(coalesce(item->>'title',''))) NOT BETWEEN 1 AND 500
  OR coalesce(item->>'phase','') NOT IN ('before_start','first_week','probation_or_end') OR coalesce(item->>'anchor','') NOT IN ('start','end')
  OR jsonb_typeof(item->'is_mandatory') IS DISTINCT FROM 'boolean' OR jsonb_typeof(item->'offset_days') IS DISTINCT FROM 'number'
  OR (item->>'offset_days')::numeric <> trunc((item->>'offset_days')::numeric) OR abs((item->>'offset_days')::numeric)>365
  OR coalesce(item->>'evidence','') NOT IN ('none','gdpr','handover') OR coalesce(item->>'kind','') NOT IN ('task','subtask')
  OR coalesce(item->>'release','') NOT IN ('package_start','scheduled') THEN RAISE EXCEPTION 'Ungültiger HR-Arbeitsschritt.' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_id IS NULL THEN
  INSERT INTO employee_hr_templates(tenant_id,name,employment_type,direction,steps) VALUES(p_tenant,btrim(p_name),btrim(p_type),p_direction,p_steps)
  ON CONFLICT(tenant_id,employment_type,direction) DO UPDATE SET name=excluded.name,steps=excluded.steps,revision=employee_hr_templates.revision+1 RETURNING id INTO result;
 ELSE
  UPDATE employee_hr_templates SET name=btrim(p_name),employment_type=btrim(p_type),direction=p_direction,steps=p_steps,revision=revision+1 WHERE id=p_id AND tenant_id=p_tenant RETURNING id INTO result;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'Vorlage nicht gefunden.' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_employee_hr_template(uuid,text,text,text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_employee_hr_template(uuid,text,text,text,jsonb,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION automation_private.seed_employee_hr_templates(p_tenant uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE item jsonb;
BEGIN
 FOR item IN SELECT * FROM jsonb_array_elements($seed$[{"employment_type":"praktikum","direction":"onboarding","name":"Praktikum (4–12 Wochen)","steps":[{"title":"Vertrag abschließen","phase":"before_start","anchor":"start","offset_days":-14,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Landtagsausweis beantragen","phase":"before_start","anchor":"start","offset_days":-7,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Hardware und Arbeitsplatz vorbereiten","phase":"before_start","anchor":"start","offset_days":-3,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Vorstellungsrunde und System-Tour","phase":"first_week","anchor":"start","offset_days":0,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Mentor-Zuweisung besprechen","phase":"first_week","anchor":"start","offset_days":1,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"IT-Einweisung","phase":"first_week","anchor":"start","offset_days":1,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"DSGVO-Verpflichtung","phase":"first_week","anchor":"start","offset_days":14,"is_mandatory":true,"evidence":"gdpr","kind":"subtask","release":"package_start"},{"title":"Halbzeitgespräch","phase":"probation_or_end","anchor":"end","offset_days":-14,"is_mandatory":false,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Abschlusszeugnis und Feedback","phase":"probation_or_end","anchor":"end","offset_days":0,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"}]},{"employment_type":"hilfskraft","direction":"onboarding","name":"Studentische Hilfskraft","steps":[{"title":"Vertrag abschließen","phase":"before_start","anchor":"start","offset_days":-14,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Landtagsausweis beantragen","phase":"before_start","anchor":"start","offset_days":-7,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Hardware und Arbeitsplatz vorbereiten","phase":"before_start","anchor":"start","offset_days":-3,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Vorstellungsrunde und System-Tour","phase":"first_week","anchor":"start","offset_days":0,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Mentor-Zuweisung besprechen","phase":"first_week","anchor":"start","offset_days":1,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"DSGVO-Verpflichtung","phase":"first_week","anchor":"start","offset_days":14,"is_mandatory":true,"evidence":"gdpr","kind":"subtask","release":"package_start"},{"title":"Zeiterfassungs-Einweisung","phase":"first_week","anchor":"start","offset_days":1,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"E-Mail-Signatur einrichten","phase":"first_week","anchor":"start","offset_days":2,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Schlüsselübergabe","phase":"first_week","anchor":"start","offset_days":0,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Probezeitgespräch","phase":"probation_or_end","anchor":"start","offset_days":90,"is_mandatory":false,"evidence":"none","kind":"subtask","release":"package_start"}]},{"employment_type":"referent","direction":"onboarding","name":"Wissenschaftliche:r Referent:in","steps":[{"title":"Vertrag abschließen","phase":"before_start","anchor":"start","offset_days":-14,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Landtagsausweis beantragen","phase":"before_start","anchor":"start","offset_days":-7,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Hardware und Arbeitsplatz vorbereiten","phase":"before_start","anchor":"start","offset_days":-3,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Vorstellungsrunde und System-Tour","phase":"first_week","anchor":"start","offset_days":0,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Mentor-Zuweisung besprechen","phase":"first_week","anchor":"start","offset_days":1,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Mandats-Zugänge bereitstellen","phase":"before_start","anchor":"start","offset_days":-1,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Einweisung Ausschussdienst","phase":"first_week","anchor":"start","offset_days":3,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Vertretungsregelung abstimmen","phase":"first_week","anchor":"start","offset_days":4,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Vorstellungsgespräch mit Fraktion","phase":"first_week","anchor":"start","offset_days":5,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"DSGVO-Verpflichtung","phase":"first_week","anchor":"start","offset_days":14,"is_mandatory":true,"evidence":"gdpr","kind":"subtask","release":"package_start"},{"title":"Probezeitgespräch","phase":"probation_or_end","anchor":"start","offset_days":90,"is_mandatory":false,"evidence":"none","kind":"subtask","release":"package_start"}]},{"employment_type":"all","direction":"offboarding","name":"Offboarding","steps":[{"title":"Offene Aufgaben übergeben","phase":"probation_or_end","anchor":"end","offset_days":-3,"is_mandatory":true,"evidence":"handover","kind":"subtask","release":"package_start"},{"title":"Zeugnis und Feedback","phase":"probation_or_end","anchor":"end","offset_days":-1,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Schlüssel zurücknehmen","phase":"probation_or_end","anchor":"end","offset_days":0,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"},{"title":"Zugänge, Matrix-Konto und Postfach sperren","phase":"probation_or_end","anchor":"end","offset_days":0,"is_mandatory":true,"evidence":"none","kind":"subtask","release":"package_start"}]}]$seed$::jsonb) LOOP
  INSERT INTO employee_hr_templates(tenant_id,name,employment_type,direction,steps) VALUES(p_tenant,item->>'name',item->>'employment_type',item->>'direction',item->'steps') ON CONFLICT(tenant_id,employment_type,direction) DO NOTHING;
 END LOOP;
END $fn$;
REVOKE ALL ON FUNCTION automation_private.seed_employee_hr_templates(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.seed_employee_hr_templates(p_tenant uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT is_tenant_config_admin(p_tenant) OR NOT user_belongs_to_tenant(p_tenant) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 PERFORM automation_private.seed_employee_hr_templates(p_tenant);
END $$;
REVOKE ALL ON FUNCTION public.seed_employee_hr_templates(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.seed_employee_hr_templates(uuid) TO authenticated;
DO $$ DECLARE t uuid; BEGIN FOR t IN SELECT id FROM public.tenants LOOP PERFORM automation_private.seed_employee_hr_templates(t); END LOOP; END $$;

-- Extend date anchors and gate only; the existing runner still owns all target creation.
CREATE OR REPLACE FUNCTION automation_private.routine_due_day(_step uuid,_trail uuid[] DEFAULT '{}') RETURNS date LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.routine_package_steps; pkg public.routine_package_runs; ref public.routine_package_steps; base date;
BEGIN
 IF _step=ANY(_trail) OR cardinality(_trail)>40 THEN RAISE EXCEPTION 'Kreis in relativen Fristen' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.routine_package_steps WHERE id=_step;
 SELECT * INTO pkg FROM public.routine_package_runs WHERE id=s.run_id;
 IF pkg.employee_lifecycle_id IS NOT NULL THEN RETURN s.hr_anchor_day+s.deadline_offset; END IF;
 IF (s.entity_id IS NOT NULL OR s.approval_id IS NOT NULL) AND s.due_day IS NOT NULL THEN RETURN s.due_day; END IF;
 IF s.deadline_basis='finish' THEN base:=pkg.finish_day;
 ELSE
   SELECT * INTO ref FROM public.routine_package_steps WHERE run_id=s.run_id AND position=s.position+CASE WHEN s.deadline_basis LIKE 'previous_%' THEN -1 ELSE 1 END;
   IF NOT FOUND THEN RAISE EXCEPTION 'Bezugsschritt fehlt' USING ERRCODE='22023'; END IF;
   IF s.deadline_basis LIKE '%_completed' THEN
     IF ref.status<>'completed' OR ref.completed_at IS NULL THEN RETURN NULL; END IF;
     base:=(ref.completed_at AT TIME ZONE 'Europe/Berlin')::date;
   ELSE base:=automation_private.routine_due_day(ref.id,array_append(_trail,_step)); END IF;
 END IF;
 IF base IS NULL THEN RETURN NULL; END IF;
 RETURN GREATEST(pkg.start_day,base+s.deadline_offset);
END $$;
REVOKE ALL ON FUNCTION automation_private.routine_due_day(uuid,uuid[]) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION automation_private.advance_routine_package(_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pkg public.routine_package_runs; s public.routine_package_steps; parent public.tasks; rid uuid; vote text; done boolean; exists_target boolean; completion_time timestamptz; new_due date;
BEGIN
 SELECT * INTO pkg FROM public.routine_package_runs WHERE id=_run_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=pkg.tenant_id AND coalesce(t.automations_paused,false)) THEN RETURN; END IF;
 IF pkg.employee_lifecycle_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.automation_rules r WHERE r.id=pkg.rule_id AND r.enabled AND r.tenant_id=pkg.tenant_id) THEN RETURN; END IF;
 SELECT * INTO parent FROM public.tasks WHERE id=pkg.task_id;
 FOR s IN SELECT * FROM public.routine_package_steps WHERE run_id=pkg.id AND status<>'completed' ORDER BY position FOR UPDATE LOOP
   IF s.status='failed' THEN CONTINUE; END IF;
   BEGIN
     IF s.entity_id IS NOT NULL THEN
       done:=false; exists_target:=false; completion_time:=NULL;
       IF s.kind='subtask' THEN SELECT true,is_completed,coalesce(completed_at,updated_at) INTO exists_target,done,completion_time FROM public.subtasks WHERE id=s.entity_id AND task_id=pkg.task_id;
       ELSIF s.kind='task' THEN SELECT true,status='completed',updated_at INTO exists_target,done,completion_time FROM public.tasks WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
       ELSIF s.kind IN ('case','jour_fixe') THEN SELECT true,status IN ('erledigt','archiviert'),coalesce(completed_at,updated_at) INTO exists_target,done,completion_time FROM public.case_items WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
       ELSE
         SELECT true INTO exists_target FROM public.task_decisions WHERE id=s.entity_id AND tenant_id=pkg.tenant_id;
         vote:=automation_private.routine_vote(s.entity_id,s.assignee_id);
         done:=vote='yes';
         SELECT coalesce(resp.updated_at,resp.created_at) INTO completion_time FROM public.task_decision_responses resp JOIN public.task_decision_participants participant ON participant.id=resp.participant_id AND participant.decision_id=resp.decision_id WHERE participant.decision_id=s.entity_id AND participant.user_id=s.assignee_id ORDER BY resp.updated_at DESC,resp.created_at DESC,resp.id DESC LIMIT 1;
         IF vote='no' THEN UPDATE public.routine_package_steps SET status='blocked',error_message='Entscheidung abgelehnt. Die entscheidende Person muss ihr Votum ändern, bevor der Ablauf weitergeht.' WHERE id=s.id; CONTINUE; END IF;
       END IF;
       IF NOT coalesce(exists_target,false) THEN RAISE EXCEPTION 'Der verknüpfte Eintrag wurde gelöscht. Er wird nicht automatisch neu angelegt.'; END IF;
       IF coalesce(done,false) THEN
         SELECT coalesce((SELECT e.completed_at FROM automation_private.routine_completion_events e WHERE e.entity_id=s.entity_id AND e.kind=CASE WHEN s.kind='jour_fixe' THEN 'case' ELSE s.kind END),completion_time,clock_timestamp()) INTO completion_time;
       ELSIF NOT automation_private.apply_routine_deputy(s.id) THEN CONTINUE; END IF;
       UPDATE public.routine_package_steps SET status=CASE WHEN coalesce(done,false) THEN 'completed' ELSE 'active' END,completed_at=CASE WHEN coalesce(done,false) THEN coalesce(completion_time,now()) ELSE NULL END,error_message=NULL WHERE id=s.id;
       CONTINUE;
     END IF;
     new_due:=automation_private.routine_due_day(s.id);
     UPDATE public.routine_package_steps SET due_day=new_due WHERE id=s.id;
     s.due_day:=new_due;
     IF new_due IS NULL THEN UPDATE public.routine_package_steps SET status='waiting',error_message=NULL WHERE id=s.id; CONTINUE; END IF;
     IF s.release='scheduled' AND s.due_day>(now() AT TIME ZONE 'Europe/Berlin')::date THEN CONTINUE; END IF;
     IF s.release='after_previous' AND NOT EXISTS(SELECT 1 FROM public.routine_package_steps WHERE run_id=pkg.id AND position=s.position-1 AND status='completed') THEN CONTINUE; END IF;
     IF NOT automation_private.apply_routine_deputy(s.id) THEN CONTINUE; END IF;
     SELECT refreshed.* INTO s FROM public.routine_package_steps refreshed WHERE refreshed.id=s.id;
     IF NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=pkg.tenant_id AND user_id=s.assignee_id AND (is_active OR pkg.hr_direction='offboarding')) THEN RAISE EXCEPTION 'Die zuständige Person ist nicht mehr im Büro aktiv. Bitte die Zuständigkeit ändern.'; END IF;
     IF s.release='after_approval' THEN
       IF NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=pkg.tenant_id AND user_id=s.approver_id AND is_active) THEN RAISE EXCEPTION 'Die freigebende Person ist nicht mehr im Büro aktiv.'; END IF;
       IF s.approval_id IS NULL THEN
         INSERT INTO public.task_decisions(task_id,tenant_id,created_by,title,description,status,response_deadline,visible_to_all)
         VALUES(pkg.task_id,pkg.tenant_id,parent.user_id,'Freigabe: '||s.title,'Bitte diesen Schritt aus dem Aufgabenpaket freigeben: '||parent.title,'active',(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin',false) RETURNING id INTO rid;
         INSERT INTO public.task_decision_participants(decision_id,user_id) VALUES(rid,s.approver_id);
         UPDATE public.routine_package_steps SET approval_id=rid,error_message=NULL WHERE id=s.id;
         CONTINUE;
       END IF;
       vote:=automation_private.routine_vote(s.approval_id,s.approver_id);
       IF vote IS DISTINCT FROM 'yes' THEN
         UPDATE public.routine_package_steps SET status=CASE WHEN vote='no' THEN 'blocked' ELSE 'waiting' END,error_message=CASE WHEN vote='no' THEN 'Freigabe abgelehnt. Der Schritt bleibt angehalten.' ELSE NULL END WHERE id=s.id;
         CONTINUE;
       END IF;
     END IF;
     IF s.kind='subtask' THEN
       INSERT INTO public.subtasks(task_id,user_id,description,assigned_to,due_date,order_index,is_completed)
       VALUES(pkg.task_id,parent.user_id,s.title,s.assignee_id::text,(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin',s.position,false) RETURNING id INTO rid;
     ELSIF s.kind='task' THEN
       INSERT INTO public.tasks(user_id,tenant_id,title,description,assigned_to,parent_task_id,status,priority,category,due_date,ball_owner,ball_assignee_id,next_action,next_action_due,source_type,source_id,timeline)
       VALUES(parent.user_id,pkg.tenant_id,s.title,'Aus Aufgabenpaket: '||parent.title,s.assignee_id::text,pkg.task_id,'todo','medium','personal',(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin','office',s.assignee_id,s.title,s.due_day,'annual_routine_step',s.id,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'text','Aus Routine: '||parent.title))) RETURNING id INTO rid;
     ELSIF s.kind IN ('case','jour_fixe') THEN
       INSERT INTO public.case_items(user_id,tenant_id,subject,summary,owner_user_id,source_channel,status,priority,due_at,ball_owner,next_action_assignee_id,next_action_label,next_action_due_at,pending_for_jour_fixe,source_reference,intake_payload)
       VALUES(parent.user_id,pkg.tenant_id,s.title,'Aus Aufgabenpaket: '||parent.title,s.assignee_id,'other','neu','medium',(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin','office',s.assignee_id,s.title,(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin',s.kind='jour_fixe','Aufgabenpaket: '||pkg.task_id::text,jsonb_build_object('routine_task_id',pkg.task_id,'routine_step_id',s.id)) RETURNING id INTO rid;
     ELSE
       INSERT INTO public.task_decisions(task_id,tenant_id,created_by,title,description,status,response_deadline,visible_to_all)
       VALUES(pkg.task_id,pkg.tenant_id,parent.user_id,s.title,'Aus Aufgabenpaket: '||parent.title,'active',(s.due_day+time '17:00') AT TIME ZONE 'Europe/Berlin',false) RETURNING id INTO rid;
       INSERT INTO public.task_decision_participants(decision_id,user_id) VALUES(rid,s.assignee_id);
     END IF;
     UPDATE public.routine_package_steps SET entity_id=rid,status='active',error_message=NULL,attempts=attempts+1 WHERE id=s.id;
   EXCEPTION WHEN OTHERS THEN
     -- The entire step subtransaction rolls back, including its target and invitations.
     UPDATE public.routine_package_steps SET status='failed',error_message=left(SQLERRM,1000),attempts=attempts+1 WHERE id=s.id;
   END;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.routine_package_steps WHERE run_id=pkg.id) AND NOT EXISTS(SELECT 1 FROM public.routine_package_steps WHERE run_id=pkg.id AND status<>'completed') AND NOT EXISTS(SELECT 1 FROM public.subtasks WHERE task_id=pkg.task_id AND NOT is_completed) AND NOT EXISTS(SELECT 1 FROM public.tasks WHERE parent_task_id=pkg.task_id AND status<>'completed') THEN
   UPDATE public.tasks SET status='completed' WHERE id=pkg.task_id AND status<>'completed';
 END IF;
END $$;
REVOKE ALL ON FUNCTION automation_private.advance_routine_package(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.start_employee_hr(p_lifecycle uuid,p_template uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE employment employee_lifecycle; template employee_hr_templates; run_id uuid; parent_id uuid; item jsonb; pos integer:=0; anchor date; earliest date; latest date;
BEGIN
 SELECT * INTO employment FROM employee_lifecycle WHERE id=p_lifecycle FOR UPDATE;
 IF NOT FOUND OR NOT is_tenant_config_admin(employment.tenant_id) OR NOT user_belongs_to_tenant(employment.tenant_id) THEN RAISE EXCEPTION 'Keine Berechtigung zum Starten.' USING ERRCODE='42501'; END IF;
 SELECT * INTO template FROM employee_hr_templates WHERE id=p_template AND tenant_id=employment.tenant_id;
 IF NOT FOUND OR template.employment_type NOT IN (employment.employment_type,'all') THEN RAISE EXCEPTION 'Vorlage passt nicht zur Beschäftigung.' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=employment.tenant_id AND user_id=employment.user_id AND (is_active OR template.direction='offboarding')) THEN RAISE EXCEPTION 'Person ist nicht im Büro aktiv.' USING ERRCODE='42501'; END IF;
 SELECT id INTO run_id FROM routine_package_runs WHERE employee_lifecycle_id=employment.id AND hr_direction=template.direction;
 IF run_id IS NOT NULL THEN PERFORM automation_private.advance_routine_package(run_id); RETURN run_id; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(template.steps) x WHERE x->>'anchor'='end') AND employment.end_date IS NULL THEN RAISE EXCEPTION 'Diese Vorlage benötigt ein Austrittsdatum.' USING ERRCODE='22023'; END IF;
 SELECT min(CASE WHEN x->>'anchor'='end' THEN employment.end_date ELSE employment.start_date END+(x->>'offset_days')::integer),max(CASE WHEN x->>'anchor'='end' THEN employment.end_date ELSE employment.start_date END+(x->>'offset_days')::integer) INTO earliest,latest FROM jsonb_array_elements(template.steps) x;
 INSERT INTO tasks(user_id,tenant_id,title,status,priority,category,assigned_to,ball_owner,ball_assignee_id,next_action,next_action_due,due_date,source_type,source_id,timeline)
 VALUES(employment.user_id,employment.tenant_id,'HR: '||template.name,'todo','medium','personal',employment.user_id::text,'office',employment.user_id,'Pflichtpunkte bearbeiten',earliest,(latest+time '17:00') AT TIME ZONE 'Europe/Berlin','employee_hr',employment.id,'[]') RETURNING id INTO parent_id;
 INSERT INTO routine_package_runs(tenant_id,annual_task_id,rule_id,year,task_id,start_day,finish_day,employee_lifecycle_id,hr_direction,hr_template_id,hr_template_revision)
 VALUES(employment.tenant_id,NULL,NULL,extract(year FROM employment.start_date)::integer,parent_id,earliest,latest,employment.id,template.direction,template.id,template.revision) RETURNING id INTO run_id;
 FOR item IN SELECT * FROM jsonb_array_elements(template.steps) LOOP
  anchor:=CASE WHEN item->>'anchor'='end' THEN employment.end_date ELSE employment.start_date END;
  INSERT INTO routine_package_steps(run_id,position,title,kind,release,assignee_id,nominal_assignee_id,use_deputy,deadline_basis,deadline_offset,due_day,hr_phase,is_mandatory,hr_anchor_day,hr_evidence_kind)
  VALUES(run_id,pos,item->>'title',item->>'kind',item->>'release',employment.user_id,employment.user_id,false,'finish',(item->>'offset_days')::integer,anchor+(item->>'offset_days')::integer,item->>'phase',(item->>'is_mandatory')::boolean,anchor,item->>'evidence');
  pos:=pos+1;
 END LOOP;
 PERFORM automation_private.advance_routine_package(run_id);
 RETURN run_id;
END $$;
REVOKE ALL ON FUNCTION public.start_employee_hr(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_employee_hr(uuid,uuid) TO authenticated;

-- Deliberately minimal replacement for the omitted Phase 2 dependency.
CREATE OR REPLACE FUNCTION public.handover_tasks_to_deputy(p_tenant uuid,p_user uuid,p_deputy uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item tasks; moved integer:=0; recipient_name text;
BEGIN
 IF NOT is_tenant_config_admin(p_tenant) OR NOT user_belongs_to_tenant(p_tenant) THEN RAISE EXCEPTION 'Nur Leitung und Abgeordnete dürfen Aufgaben übergeben.' USING ERRCODE='42501'; END IF;
 IF p_user=p_deputy OR p_deputy IS NULL OR NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_user)
 OR NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_deputy AND is_active) THEN RAISE EXCEPTION 'Ungültige Übergabe im Büro.' USING ERRCODE='42501'; END IF;
 SELECT coalesce(display_name,'Vertretung') INTO recipient_name FROM profiles WHERE user_id=p_deputy;
 FOR item IN SELECT * FROM tasks t WHERE t.tenant_id=p_tenant AND t.ball_assignee_id=p_user AND t.status NOT IN ('completed','archived')
 AND NOT EXISTS(SELECT 1 FROM routine_package_runs r WHERE r.employee_lifecycle_id IS NOT NULL AND (r.task_id=t.id OR EXISTS(SELECT 1 FROM routine_package_steps s WHERE s.run_id=r.id AND s.kind='task' AND s.entity_id=t.id))) FOR UPDATE LOOP
  UPDATE tasks SET ball_assignee_id=p_deputy,
   assigned_to=(SELECT string_agg(DISTINCT person,', ') FROM (SELECT btrim(part) AS person FROM unnest(string_to_array(coalesce(item.assigned_to,''),',')) part WHERE btrim(part)<>'' AND btrim(part)<>p_user::text UNION SELECT p_deputy::text) people),
   timeline=coalesce(item.timeline,'[]')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'text','Offboarding: Verantwortung an '||coalesce(recipient_name,'Vertretung')||' übergeben'))
   WHERE id=item.id;
  moved:=moved+1;
 END LOOP;
 RETURN moved;
END $$;
REVOKE ALL ON FUNCTION public.handover_tasks_to_deputy(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.handover_tasks_to_deputy(uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_employee_hr_target()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item routine_package_steps; done boolean;
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM routine_package_runs r WHERE r.employee_lifecycle_id IS NOT NULL AND (r.task_id=OLD.id OR EXISTS(SELECT 1 FROM routine_package_steps s WHERE s.run_id=r.id AND s.entity_id=OLD.id AND s.kind=CASE WHEN TG_TABLE_NAME='tasks' THEN 'task' ELSE 'subtask' END))) THEN RAISE EXCEPTION 'HR-Nachweise und laufende Punkte bleiben erhalten.' USING ERRCODE='42501'; END IF;
  RETURN OLD;
 END IF;
 IF EXISTS(SELECT 1 FROM routine_package_runs r WHERE r.employee_lifecycle_id IS NOT NULL AND (r.task_id=OLD.id OR EXISTS(SELECT 1 FROM routine_package_steps s WHERE s.run_id=r.id AND s.entity_id=OLD.id AND s.kind=CASE WHEN TG_TABLE_NAME='tasks' THEN 'task' ELSE 'subtask' END)))
 AND (NEW.id IS DISTINCT FROM OLD.id OR (TG_TABLE_NAME='subtasks' AND to_jsonb(NEW)->>'task_id' IS DISTINCT FROM to_jsonb(OLD)->>'task_id')) THEN RAISE EXCEPTION 'HR-Punkte dürfen nicht aus ihrem Paket verschoben werden.' USING ERRCODE='42501'; END IF;
 done:=CASE WHEN TG_TABLE_NAME='tasks' THEN to_jsonb(NEW)->>'status'='completed' ELSE (to_jsonb(NEW)->>'is_completed')::boolean END;
 IF NOT coalesce(done,false) THEN RETURN NEW; END IF;
 SELECT s.* INTO item FROM routine_package_steps s JOIN routine_package_runs r ON r.id=s.run_id
 WHERE r.employee_lifecycle_id IS NOT NULL AND s.entity_id=NEW.id AND s.kind=CASE WHEN TG_TABLE_NAME='tasks' THEN 'task' ELSE 'subtask' END;
 IF FOUND AND item.hr_evidence_kind<>'none' AND NOT EXISTS(SELECT 1 FROM employee_hr_evidence WHERE step_id=item.id) THEN RAISE EXCEPTION 'Dieser Punkt benötigt den bestätigten Nachweis bzw. die Aufgabenübergabe durch die Leitung.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_employee_hr_target() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_employee_hr_task ON public.tasks;
CREATE TRIGGER guard_employee_hr_task BEFORE UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.guard_employee_hr_target();
DROP TRIGGER IF EXISTS guard_employee_hr_subtask ON public.subtasks;
CREATE TRIGGER guard_employee_hr_subtask BEFORE UPDATE OR DELETE ON public.subtasks FOR EACH ROW EXECUTE FUNCTION public.guard_employee_hr_target();

CREATE OR REPLACE FUNCTION public.complete_employee_hr_step(p_step uuid,p_confirmed_on date DEFAULT NULL,p_document uuid DEFAULT NULL,p_deputy uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item routine_package_steps; pkg routine_package_runs; employment employee_lifecycle; today date:=(now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
 SELECT r.* INTO pkg FROM routine_package_runs r JOIN routine_package_steps s ON s.run_id=r.id WHERE s.id=p_step FOR UPDATE OF r;
 SELECT * INTO employment FROM employee_lifecycle WHERE id=pkg.employee_lifecycle_id;
 IF NOT FOUND OR NOT can_view_employee_hr(employment.tenant_id,employment.user_id) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 PERFORM automation_private.advance_routine_package(pkg.id);
 SELECT * INTO item FROM routine_package_steps WHERE id=p_step;
 IF item.status='completed' THEN RETURN; END IF;
 IF item.entity_id IS NULL OR item.status NOT IN ('active','blocked') THEN RAISE EXCEPTION 'Der Arbeitsschritt wurde noch nicht gestartet: %',coalesce(item.error_message,'Wartet auf Termin oder Fortsetzung') USING ERRCODE='22023'; END IF;
 IF item.hr_evidence_kind<>'none' THEN
  IF NOT is_tenant_config_admin(employment.tenant_id) THEN RAISE EXCEPTION 'Nachweise bestätigt die Büroleitung oder eine abgeordnete Person.' USING ERRCODE='42501'; END IF;
  IF item.hr_evidence_kind='gdpr' AND (p_confirmed_on IS NULL OR p_confirmed_on>today) THEN RAISE EXCEPTION 'Ein gültiges Nachweisdatum bis heute ist erforderlich.' USING ERRCODE='22023'; END IF;
  IF p_document IS NOT NULL AND NOT EXISTS(SELECT 1 FROM documents WHERE id=p_document AND tenant_id=employment.tenant_id) THEN RAISE EXCEPTION 'Dokument gehört nicht zum Büro.' USING ERRCODE='42501'; END IF;
  IF item.hr_evidence_kind='handover' THEN PERFORM handover_tasks_to_deputy(employment.tenant_id,employment.user_id,p_deputy); END IF;
  INSERT INTO employee_hr_evidence(tenant_id,step_id,user_id,confirmed_on,confirmed_by,document_id) VALUES(employment.tenant_id,item.id,employment.user_id,coalesce(p_confirmed_on,today),auth.uid(),p_document) ON CONFLICT(step_id) DO NOTHING;
 END IF;
 IF item.kind='task' THEN UPDATE tasks SET status='completed' WHERE id=item.entity_id AND tenant_id=employment.tenant_id;
 ELSIF item.kind='subtask' THEN UPDATE subtasks SET is_completed=true WHERE id=item.entity_id AND task_id=pkg.task_id; END IF;
 PERFORM automation_private.advance_routine_package(pkg.id);
END $$;
REVOKE ALL ON FUNCTION public.complete_employee_hr_step(uuid,date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_employee_hr_step(uuid,date,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION automation_private.remind_employee_hr(p_lifecycle uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE employment public.employee_lifecycle; person uuid; inserted uuid; notification_kind uuid; sent integer:=0; today date:=(now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
 SELECT * INTO employment FROM public.employee_lifecycle WHERE id=p_lifecycle FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM tenants WHERE id=employment.tenant_id AND automations_paused) THEN RETURN 0; END IF;
 IF NOT EXISTS(SELECT 1 FROM routine_package_steps s JOIN routine_package_runs r ON r.id=s.run_id WHERE r.employee_lifecycle_id=employment.id AND s.is_mandatory AND s.status<>'completed' AND s.due_day<today)
 AND NOT (employment.end_date BETWEEN today AND today+30) THEN RETURN 0; END IF;
 INSERT INTO notification_types(tenant_id,name,label,is_active) VALUES(employment.tenant_id,'employee_hr_reminder','HR-Pflichtpunkte und Austritt',true) ON CONFLICT(tenant_id,name) DO NOTHING;
 SELECT id INTO notification_kind FROM notification_types WHERE tenant_id=employment.tenant_id AND name='employee_hr_reminder';
 FOR person IN SELECT user_id FROM user_tenant_memberships WHERE tenant_id=employment.tenant_id AND is_active AND (user_id=employment.user_id OR role IN ('abgeordneter','bueroleitung')) LOOP
  inserted:=NULL;
  INSERT INTO employee_hr_reminder_log(tenant_id,lifecycle_id,recipient_id,reminder_day) VALUES(employment.tenant_id,employment.id,person,today) ON CONFLICT(lifecycle_id,recipient_id,reminder_day) DO NOTHING RETURNING id INTO inserted;
  IF inserted IS NOT NULL THEN
   INSERT INTO notifications(user_id,tenant_id,notification_type_id,title,message,priority,data)
   VALUES(person,employment.tenant_id,notification_kind,'HR-Pflichtpunkte / anstehender Austritt','Bitte die offenen Pflichtpunkte und die Austrittsvorbereitung im Mitarbeiterbereich prüfen.','medium',jsonb_build_object('lifecycle_id',employment.id,'url','/employee?tab=hr&employee='||employment.user_id::text));
   sent:=sent+1;
  END IF;
 END LOOP;
 RETURN sent;
END $$;
REVOKE ALL ON FUNCTION automation_private.remind_employee_hr(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.remind_employee_hr(p_lifecycle uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid;
BEGIN
 SELECT tenant_id INTO t FROM employee_lifecycle WHERE id=p_lifecycle;
 IF t IS NULL OR NOT is_tenant_config_admin(t) OR NOT user_belongs_to_tenant(t) THEN RAISE EXCEPTION 'Nur die Leitung darf erinnern.' USING ERRCODE='42501'; END IF;
 RETURN automation_private.remind_employee_hr(p_lifecycle);
END $$;
REVOKE ALL ON FUNCTION public.remind_employee_hr(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remind_employee_hr(uuid) TO authenticated;
-- The existing 15-minute job advances both contexts and claims reminders once per day.
CREATE OR REPLACE FUNCTION automation_private.dispatch_routine_packages() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid;
BEGIN
 FOR rid IN SELECT DISTINCT r.id FROM public.routine_package_runs r JOIN public.routine_package_steps s ON s.run_id=r.id WHERE s.status IN ('waiting','active','blocked') ORDER BY r.id LOOP
  BEGIN PERFORM automation_private.advance_routine_package(rid); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Routine package %: %',rid,SQLERRM; END;
 END LOOP;
 FOR rid IN SELECT e.id FROM public.employee_lifecycle e WHERE e.end_date BETWEEN (now() AT TIME ZONE 'Europe/Berlin')::date AND (now() AT TIME ZONE 'Europe/Berlin')::date+30
 OR EXISTS(SELECT 1 FROM public.routine_package_runs r JOIN public.routine_package_steps s ON s.run_id=r.id WHERE r.employee_lifecycle_id=e.id AND s.is_mandatory AND s.status<>'completed' AND s.due_day<(now() AT TIME ZONE 'Europe/Berlin')::date) LOOP
  BEGIN PERFORM automation_private.remind_employee_hr(rid); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'HR reminder %: %',rid,SQLERRM; END;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION automation_private.dispatch_routine_packages() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.selftest_employee_hr(p_tenant uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE template_id uuid; lifecycle uuid; first_run uuid; second_run uuid; result jsonb; actual_count integer; sample jsonb:='[{"title":"[SELFTEST] Pflichtnachweis","phase":"first_week","is_mandatory":true,"anchor":"start","offset_days":14,"evidence":"gdpr","kind":"subtask","release":"package_start"}]'; denied boolean:=false; target uuid; run_task uuid; type_name text:='selftest-'||substr(gen_random_uuid()::text,1,8); fixture_start date:=(now() AT TIME ZONE 'Europe/Berlin')::date-45; reminders integer; reminder_repeat integer;
BEGIN
 IF NOT is_tenant_config_admin(p_tenant) OR NOT user_belongs_to_tenant(p_tenant) THEN RAISE EXCEPTION 'Nur Leitung und Abgeordnete prüfen diesen Ablauf.' USING ERRCODE='42501'; END IF;
 BEGIN
  template_id:=save_employee_hr_template(p_tenant,'[SELFTEST] HR',type_name,'onboarding',sample);
  WHILE EXISTS(SELECT 1 FROM employee_lifecycle WHERE tenant_id=p_tenant AND user_id=auth.uid() AND start_date=fixture_start) LOOP fixture_start:=fixture_start-1; END LOOP;
  lifecycle:=save_employee_lifecycle(p_tenant,auth.uid(),type_name,fixture_start,(now() AT TIME ZONE 'Europe/Berlin')::date+10);
  first_run:=start_employee_hr(lifecycle,template_id);second_run:=start_employee_hr(lifecycle,template_id);
  SELECT count(*),min(entity_id::text)::uuid INTO actual_count,target FROM routine_package_steps WHERE run_id=first_run;
  SELECT task_id INTO run_task FROM routine_package_runs WHERE id=first_run;
  reminders:=remind_employee_hr(lifecycle);reminder_repeat:=remind_employee_hr(lifecycle);
  BEGIN UPDATE subtasks SET is_completed=true WHERE id=target; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  PERFORM complete_employee_hr_step((SELECT id FROM routine_package_steps WHERE run_id=first_run),(now() AT TIME ZONE 'Europe/Berlin')::date);
  result:=jsonb_build_object('idempotent',first_run=second_run,'single_daily_reminder',reminders>0 AND reminder_repeat=0,'single_step',actual_count=1,'evidence_guard',denied,'proof_saved',EXISTS(SELECT 1 FROM employee_hr_evidence WHERE step_id IN(SELECT id FROM routine_package_steps WHERE run_id=first_run)),'completed',EXISTS(SELECT 1 FROM tasks WHERE id=run_task AND status='completed'));
  RAISE EXCEPTION 'HR-Selbsttest-Fixures zurückrollen' USING ERRCODE='P0004';
 EXCEPTION WHEN SQLSTATE 'P0004' THEN NULL;
 END;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.selftest_employee_hr(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.selftest_employee_hr(uuid) TO authenticated;
