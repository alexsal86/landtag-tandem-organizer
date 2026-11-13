-- Phase 1. Reviewed all employee-meeting migrations: 20260210211103 adds employee
-- UPDATE/INSERT rights; no earlier trigger locks completed protocol content.
ALTER TABLE public.employee_meetings
  ADD COLUMN IF NOT EXISTS acknowledgement_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS protocol_hash text,
  ADD COLUMN IF NOT EXISTS acknowledgement_comment text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
ALTER TABLE public.employee_meetings DROP CONSTRAINT IF EXISTS employee_meetings_status_check;
ALTER TABLE public.employee_meetings ADD CONSTRAINT employee_meetings_status_check CHECK
  (status IN ('scheduled','in_progress','completed','pending_acknowledgement','acknowledged','cancelled','cancelled_by_employee','rescheduled'));

CREATE TABLE IF NOT EXISTS public.employee_meeting_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.employee_meetings(id),
  actor uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  reason text,
  protocol_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_meeting_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_meeting_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.employee_meeting_audit TO authenticated;
DROP POLICY IF EXISTS employee_audit_read ON public.employee_meeting_audit;
CREATE POLICY employee_audit_read ON public.employee_meeting_audit FOR SELECT TO authenticated USING
  (EXISTS (SELECT 1 FROM public.employee_meetings m WHERE m.id=meeting_id));

-- Private notes never travel in a shared JSON column, including through direct SELECT.
CREATE TABLE IF NOT EXISTS public.employee_meeting_private_notes (
  meeting_id uuid NOT NULL REFERENCES public.employee_meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  PRIMARY KEY(meeting_id,user_id)
);
ALTER TABLE public.employee_meeting_private_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_meeting_private_notes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.employee_meeting_private_notes TO authenticated;
DROP POLICY IF EXISTS employee_private_notes_read ON public.employee_meeting_private_notes;
CREATE POLICY employee_private_notes_read ON public.employee_meeting_private_notes FOR SELECT TO authenticated USING
  (user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.employee_meetings m WHERE m.id=meeting_id));
INSERT INTO public.employee_meeting_private_notes(meeting_id,user_id,notes)
SELECT id,employee_id,employee_preparation->>'private_notes' FROM public.employee_meetings
WHERE employee_preparation->>'private_notes' IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.employee_meeting_private_notes(meeting_id,user_id,notes)
SELECT id,conducted_by,supervisor_preparation->>'private_notes' FROM public.employee_meetings
WHERE supervisor_preparation->>'private_notes' IS NOT NULL ON CONFLICT DO NOTHING;
UPDATE public.employee_meetings SET employee_preparation=employee_preparation-'private_notes',supervisor_preparation=supervisor_preparation-'private_notes'
WHERE employee_preparation ? 'private_notes' OR supervisor_preparation ? 'private_notes';

-- jsonb's recursive key ordering provides canonical database serialization.
-- Exclude mutable execution state and task links: only agreed content is signed.
CREATE OR REPLACE FUNCTION public.employee_protocol_hash(p_meeting_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,extensions AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object('protocol',coalesce(m.protocol_data,'{}'::jsonb),
    'actions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'description',a.description,'owner',a.owner,
    'assigned_to',a.assigned_to,'due_date',a.due_date) ORDER BY a.id) FROM public.employee_meeting_action_items a WHERE a.meeting_id=m.id),'[]'::jsonb))::text,'UTF8')),'hex')
  FROM public.employee_meetings m WHERE m.id=p_meeting_id;
$$;
REVOKE ALL ON FUNCTION public.employee_protocol_hash(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.guard_employee_protocol()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status IN ('pending_acknowledgement','acknowledged') OR EXISTS(SELECT 1 FROM public.employee_meeting_audit WHERE meeting_id=OLD.id) THEN
      RAISE EXCEPTION 'Freigegebene oder auditierte Gespräche können nicht gelöscht werden' USING ERRCODE='55000';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status IN ('pending_acknowledgement','acknowledged') AND
      (to_jsonb(NEW)-ARRAY['status','acknowledgement_requested_at','acknowledged_at','acknowledged_by','protocol_hash','acknowledgement_comment','version','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['status','acknowledgement_requested_at','acknowledged_at','acknowledged_by','protocol_hash','acknowledgement_comment','version','updated_at']) THEN
      RAISE EXCEPTION 'Das freigegebene Protokoll ist gesperrt. Bitte mit Begründung wieder öffnen.' USING ERRCODE='55000';
    END IF;
    -- A caller-controlled session setting is deliberately NOT an escape hatch.
    IF current_user IN ('authenticated','anon') AND (
      NEW.status IS DISTINCT FROM OLD.status AND (NEW.status IN ('pending_acknowledgement','acknowledged') OR OLD.status IN ('pending_acknowledgement','acknowledged'))
      OR ROW(NEW.acknowledgement_requested_at,NEW.acknowledged_at,NEW.acknowledged_by,NEW.protocol_hash,NEW.acknowledgement_comment)
        IS DISTINCT FROM ROW(OLD.acknowledgement_requested_at,OLD.acknowledged_at,OLD.acknowledged_by,OLD.protocol_hash,OLD.acknowledgement_comment)) THEN
      RAISE EXCEPTION 'Freigabe ausschließlich über den Protokoll-Workflow' USING ERRCODE='42501';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Gesprächszuordnung ist unveränderlich'; END IF;
    NEW.version:=OLD.version+1;
  ELSIF NEW.status IN ('pending_acknowledgement','acknowledged') OR NEW.protocol_hash IS NOT NULL OR NEW.acknowledged_at IS NOT NULL OR NEW.acknowledged_by IS NOT NULL THEN
    RAISE EXCEPTION 'Gespräche müssen zuerst als Entwurf angelegt werden' USING ERRCODE='42501';
  END IF;
  NEW.employee_preparation:=NEW.employee_preparation-'private_notes';
  NEW.supervisor_preparation:=NEW.supervisor_preparation-'private_notes';
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_employee_protocol ON public.employee_meetings;
CREATE TRIGGER guard_employee_protocol BEFORE INSERT OR UPDATE OR DELETE ON public.employee_meetings FOR EACH ROW EXECUTE FUNCTION public.guard_employee_protocol();

CREATE OR REPLACE FUNCTION public.guard_employee_action_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings; mid uuid;
BEGIN
  IF TG_OP='INSERT' THEN mid:=NEW.meeting_id; ELSE mid:=OLD.meeting_id; END IF;
  SELECT * INTO m FROM public.employee_meetings WHERE id=mid FOR UPDATE;
  IF TG_OP='UPDATE' AND ROW(NEW.meeting_id,NEW.tenant_id) IS DISTINCT FROM ROW(OLD.meeting_id,OLD.tenant_id) THEN RAISE EXCEPTION 'Maßnahmenzuordnung ist unveränderlich'; END IF;
  IF TG_OP<>'DELETE' AND NEW.tenant_id<>m.tenant_id THEN RAISE EXCEPTION 'Falsches Büro' USING ERRCODE='42501'; END IF;
  IF m.status IN ('pending_acknowledgement','acknowledged') THEN
    IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Freigegebene Maßnahmen sind gesperrt' USING ERRCODE='55000'; END IF;
    IF ROW(NEW.description,NEW.owner,NEW.assigned_to,NEW.due_date) IS DISTINCT FROM ROW(OLD.description,OLD.owner,OLD.assigned_to,OLD.due_date) THEN
      RAISE EXCEPTION 'Freigegebene Maßnahmen sind gesperrt' USING ERRCODE='55000';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_employee_action_content ON public.employee_meeting_action_items;
CREATE TRIGGER guard_employee_action_content BEFORE INSERT OR UPDATE OR DELETE ON public.employee_meeting_action_items FOR EACH ROW EXECUTE FUNCTION public.guard_employee_action_content();

CREATE OR REPLACE FUNCTION public.require_employee_meeting_access(p_meeting_id uuid,p_supervisor boolean DEFAULT false)
RETURNS public.employee_meetings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings;
BEGIN
  SELECT * INTO m FROM public.employee_meetings WHERE id=p_meeting_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_tenant_member(m.tenant_id,auth.uid()) THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE='42501'; END IF;
  IF NOT (m.conducted_by=auth.uid() OR public.is_tenant_admin(auth.uid(),m.tenant_id) OR (NOT p_supervisor AND m.employee_id=auth.uid())) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE='42501';
  END IF;
  RETURN m;
END $$;
REVOKE ALL ON FUNCTION public.require_employee_meeting_access(uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.request_protocol_acknowledgement(p_meeting_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings;
BEGIN
  m:=public.require_employee_meeting_access(p_meeting_id,true);
  IF m.status='pending_acknowledgement' THEN RETURN; END IF;
  IF m.status<>'completed' THEN RAISE EXCEPTION 'Bitte das Gespräch zuerst abschließen' USING ERRCODE='22023'; END IF;
  UPDATE public.employee_meetings SET status='pending_acknowledgement',acknowledgement_requested_at=now(),acknowledged_at=NULL,acknowledged_by=NULL,
    acknowledgement_comment=NULL,protocol_hash=public.employee_protocol_hash(m.id) WHERE id=m.id;
  INSERT INTO public.employee_meeting_audit(meeting_id,actor,action,protocol_hash) SELECT m.id,auth.uid(),'requested',protocol_hash FROM public.employee_meetings WHERE id=m.id;
  PERFORM public.create_notification(m.employee_id,'employee_protocol_requested','Protokoll bitte bestätigen',
    'Bitte prüfen Sie das Mitarbeitergespräch innerhalb von 7 Tagen. Ein Einspruch ist möglich.',jsonb_build_object('meeting_id',m.id),'medium');
END $$;

CREATE OR REPLACE FUNCTION public.acknowledge_meeting_protocol(p_meeting_id uuid,p_comment text DEFAULT NULL,p_protocol_hash text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings; c text:=nullif(btrim(p_comment),'');
BEGIN
  m:=public.require_employee_meeting_access(p_meeting_id);
  IF m.employee_id<>auth.uid() THEN RAISE EXCEPTION 'Nur die betroffene Person kann bestätigen' USING ERRCODE='42501'; END IF;
  IF m.status<>'pending_acknowledgement' THEN RAISE EXCEPTION 'Keine offene Bestätigung' USING ERRCODE='22023'; END IF;
  IF p_protocol_hash IS NOT NULL AND p_protocol_hash IS DISTINCT FROM m.protocol_hash THEN RAISE EXCEPTION 'Das Protokoll wurde erneut freigegeben. Bitte vor der Bestätigung neu laden.' USING ERRCODE='40001'; END IF;
  IF m.protocol_hash IS DISTINCT FROM public.employee_protocol_hash(m.id) THEN RAISE EXCEPTION 'Protokollinhalt stimmt nicht mit der Freigabe überein' USING ERRCODE='55000'; END IF;
  -- An objection must be resolved by reopening and requesting acknowledgement again.
  IF c IS NULL AND m.acknowledgement_comment IS NOT NULL THEN RAISE EXCEPTION 'Der Einspruch muss zuerst durch die Gesprächsleitung geklärt werden'; END IF;
  UPDATE public.employee_meetings SET status=CASE WHEN c IS NULL THEN 'acknowledged' ELSE 'pending_acknowledgement' END,
    acknowledged_at=CASE WHEN c IS NULL THEN now() END,acknowledged_by=CASE WHEN c IS NULL THEN auth.uid() END,acknowledgement_comment=c WHERE id=m.id;
  INSERT INTO public.employee_meeting_audit(meeting_id,actor,action,reason,protocol_hash) VALUES(m.id,auth.uid(),CASE WHEN c IS NULL THEN 'acknowledged' ELSE 'objection' END,c,m.protocol_hash);
  PERFORM public.create_notification(m.conducted_by,'employee_protocol_response',CASE WHEN c IS NULL THEN 'Protokoll bestätigt' ELSE 'Einspruch zum Protokoll' END,
    coalesce(c,'Das Mitarbeitergespräch wurde bestätigt.'),jsonb_build_object('meeting_id',m.id),'medium');
END $$;

CREATE OR REPLACE FUNCTION public.reopen_meeting_protocol(p_meeting_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings;
BEGIN
  m:=public.require_employee_meeting_access(p_meeting_id,true);
  IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Bitte einen Grund angeben' USING ERRCODE='22023'; END IF;
  IF m.status NOT IN ('completed','pending_acknowledgement','acknowledged') THEN RAISE EXCEPTION 'Gespräch ist nicht abgeschlossen'; END IF;
  INSERT INTO public.employee_meeting_audit(meeting_id,actor,action,reason,protocol_hash) VALUES(m.id,auth.uid(),'reopened',btrim(p_reason),m.protocol_hash);
  UPDATE public.employee_meetings SET status='in_progress',acknowledged_at=NULL,acknowledged_by=NULL,protocol_hash=NULL,
    acknowledgement_requested_at=NULL,acknowledgement_comment=NULL WHERE id=m.id;
  PERFORM public.create_notification(m.employee_id,'employee_protocol_response','Protokoll wieder geöffnet',btrim(p_reason),jsonb_build_object('meeting_id',m.id),'medium');
END $$;

-- One version-checked RPC for autosave, sharing, cancellation and completion.
CREATE OR REPLACE FUNCTION public.save_employee_meeting(p_meeting_id uuid,p_version integer,p_patch jsonb,p_private_notes text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings;
BEGIN
  m:=public.require_employee_meeting_access(p_meeting_id);
  IF m.version<>p_version THEN RAISE EXCEPTION 'Zwischenzeitlich geändert. Bitte neu laden, bevor Sie erneut speichern.' USING ERRCODE='40001'; END IF;
  IF m.status NOT IN ('scheduled','in_progress') THEN RAISE EXCEPTION 'Protokoll ist gesperrt. Bitte zuerst wieder öffnen.' USING ERRCODE='55000'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('protocol_data','employee_preparation','supervisor_preparation','shared_during_meeting','status','cancellation_reason','reschedule_request_reason')) THEN RAISE EXCEPTION 'Ungültige Felder'; END IF;
  IF (p_patch ? 'employee_preparation' AND auth.uid()<>m.employee_id) OR (p_patch ? 'supervisor_preparation' AND auth.uid()<>m.conducted_by) THEN RAISE EXCEPTION 'Nur die eigene Vorbereitung ist bearbeitbar' USING ERRCODE='42501'; END IF;
  IF p_patch ? 'status' AND NOT (m.conducted_by=auth.uid() OR public.is_tenant_admin(auth.uid(),m.tenant_id))
     AND NOT (m.employee_id=auth.uid() AND m.status='scheduled' AND p_patch->>'status'='cancelled_by_employee') THEN RAISE EXCEPTION 'Keine Berechtigung zum Statuswechsel' USING ERRCODE='42501'; END IF;
  IF p_patch ? 'status' AND NOT ((m.status='scheduled' AND p_patch->>'status' IN ('in_progress','cancelled','cancelled_by_employee')) OR
    (m.status='in_progress' AND p_patch->>'status'='completed')) THEN RAISE EXCEPTION 'Ungültiger Statuswechsel' USING ERRCODE='22023'; END IF;
  UPDATE public.employee_meetings SET protocol_data=CASE WHEN p_patch ? 'protocol_data' THEN p_patch->'protocol_data' ELSE protocol_data END,
    employee_preparation=CASE WHEN p_patch ? 'employee_preparation' THEN p_patch->'employee_preparation' ELSE employee_preparation END,
    supervisor_preparation=CASE WHEN p_patch ? 'supervisor_preparation' THEN p_patch->'supervisor_preparation' ELSE supervisor_preparation END,
    shared_during_meeting=coalesce((p_patch->>'shared_during_meeting')::boolean,shared_during_meeting),status=coalesce(p_patch->>'status',status),
    cancellation_reason=coalesce(p_patch->>'cancellation_reason',cancellation_reason),reschedule_request_reason=coalesce(p_patch->>'reschedule_request_reason',reschedule_request_reason),
    completed_at=CASE WHEN p_patch->>'status'='completed' THEN now() ELSE completed_at END WHERE id=m.id;
  IF p_private_notes IS NOT NULL THEN
    INSERT INTO public.employee_meeting_private_notes VALUES(m.id,auth.uid(),p_private_notes) ON CONFLICT(meeting_id,user_id) DO UPDATE SET notes=excluded.notes;
  END IF;
  IF p_patch->>'status'='completed' THEN
    UPDATE public.employee_settings SET last_meeting_date=m.meeting_date WHERE user_id=m.employee_id;
  END IF;
  IF p_patch->>'status'='in_progress' THEN
    PERFORM public.create_notification(m.employee_id,'employee_meeting','Gespräch gestartet','Ihr Mitarbeitergespräch wurde gestartet.',jsonb_build_object('meeting_id',m.id),'medium');
  ELSIF p_patch->>'status'='completed' THEN
    PERFORM public.create_notification(m.employee_id,'employee_meeting','Gespräch abgeschlossen','Das Protokoll kann jetzt zur Bestätigung freigegeben werden.',jsonb_build_object('meeting_id',m.id),'medium');
  ELSIF p_patch->>'status' IN ('cancelled','cancelled_by_employee') THEN
    PERFORM public.create_notification(CASE WHEN auth.uid()=m.employee_id THEN m.conducted_by ELSE m.employee_id END,'employee_meeting','Gespräch abgesagt',p_patch->>'cancellation_reason',jsonb_build_object('meeting_id',m.id),'medium');
  ELSIF p_patch ? 'reschedule_request_reason' THEN
    PERFORM public.create_notification(m.conducted_by,'employee_meeting','Umterminierung angefragt',p_patch->>'reschedule_request_reason',jsonb_build_object('meeting_id',m.id),'medium');
  END IF;
  RETURN m.version+1;
END $$;

CREATE OR REPLACE FUNCTION public.mutate_employee_meeting_action(p_meeting_id uuid,p_action text,p_item_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings; a public.employee_meeting_action_items; v_id uuid;
BEGIN
  m:=public.require_employee_meeting_access(p_meeting_id);
  IF auth.uid() NOT IN (m.employee_id,m.conducted_by) AND NOT public.is_tenant_admin(auth.uid(),m.tenant_id) THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF p_action='add' THEN
    IF length(btrim(regexp_replace(coalesce(p_data->>'description',''),'<[^>]*>','','g')))<3 THEN RAISE EXCEPTION 'Maßnahme zu kurz'; END IF;
    INSERT INTO public.employee_meeting_action_items(meeting_id,tenant_id,description,owner,assigned_to,due_date)
      VALUES(m.id,m.tenant_id,p_data->>'description',p_data->>'owner',CASE WHEN p_data->>'owner'='supervisor' THEN m.conducted_by ELSE m.employee_id END,nullif(p_data->>'due_date','')::timestamptz) RETURNING id INTO v_id;
  ELSE
    SELECT * INTO a FROM public.employee_meeting_action_items WHERE id=p_item_id AND meeting_id=m.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Maßnahme nicht gefunden'; END IF;
    IF p_action='delete' THEN
      IF auth.uid()<>m.conducted_by AND NOT public.is_tenant_admin(auth.uid(),m.tenant_id) THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
      IF a.task_id IS NOT NULL THEN RAISE EXCEPTION 'Verknüpfte Maßnahmen behalten ihre Historie'; END IF;
      DELETE FROM public.employee_meeting_action_items WHERE id=a.id;
    ELSIF p_action='status' THEN
      IF coalesce(p_data->>'status','') NOT IN ('open','in_progress','completed') THEN RAISE EXCEPTION 'Ungültiger Maßnahmenstatus'; END IF;
      UPDATE public.employee_meeting_action_items SET status=p_data->>'status',completed_at=CASE WHEN p_data->>'status'='completed' THEN now() END WHERE id=a.id;
    ELSE RAISE EXCEPTION 'Ungültige Aktion'; END IF;
    v_id:=a.id;
  END IF;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.request_protocol_acknowledgement(uuid),public.acknowledge_meeting_protocol(uuid,text,text),public.reopen_meeting_protocol(uuid,text),public.save_employee_meeting(uuid,integer,jsonb,text),public.mutate_employee_meeting_action(uuid,text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_protocol_acknowledgement(uuid),public.acknowledge_meeting_protocol(uuid,text,text),public.reopen_meeting_protocol(uuid,text),public.save_employee_meeting(uuid,integer,jsonb,text),public.mutate_employee_meeting_action(uuid,text,uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_employee_protocol(),public.guard_employee_action_content() FROM PUBLIC,anon,authenticated;
-- Notification names are unique per tenant since the tenant-isolation migration.
INSERT INTO public.notification_types(tenant_id,name,label,description,is_active)
SELECT t.id, n.name, n.label, n.description, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('employee_meeting','Mitarbeitergespräch','Aktualisierung zu Ihrem Mitarbeitergespräch'),
  ('employee_protocol_requested','Protokoll zur Bestätigung','Mitarbeitergespräch freigegeben'),
  ('employee_protocol_response','Protokoll-Rückmeldung','Bestätigung oder Einspruch zum Mitarbeitergespräch')
) AS n(name,label,description)
WHERE true
ON CONFLICT(tenant_id,name) DO NOTHING;

REVOKE UPDATE ON public.employee_meetings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.employee_meeting_action_items FROM authenticated;
