-- Versionskonflikt mit einem eigenen Statuscode melden.
--
-- Befund der Instanz: der Aufruf save_employee_meeting mit einem veralteten
-- Versionsstand lief reproduzierbar in die Zeitüberschreitung (20 000 ms),
-- sowohl über den Supabase-Client als auch über ein direktes fetch an
-- /rest/v1/rpc/save_employee_meeting — während alle anderen Abweisungen
-- desselben Schritts (42501, 22023, 55000) in Millisekunden antworteten.
-- Damit ist der Transport nicht die Ursache; der einzige Unterschied ist der
-- Fehlercode selbst. 40001 gehört zur Klasse der wiederholbaren
-- Transaktionskonflikte und wird von Zwischenschichten als "erneut versuchen"
-- gelesen — die Antwort bleibt aus, bis der Client abbricht.
--
-- Ein zerschlagener Autosave ist aber kein wiederholbarer Konflikt, sondern ein
-- Anwendungsfall: PostgREST meldet ihn mit PT409 als HTTP 409. Dieser Code
-- trägt dieselbe Bedeutung, wird nicht wiederholt und kommt beim Client an.
--
-- Die Migration ersetzt ausschließlich den Funktionsrumpf (CREATE OR REPLACE,
-- gleiche Signatur, kein Tabellen-DDL) und lässt sich beliebig oft einspielen.
-- Die Rechte aus 20261128060000 bleiben bestehen.

CREATE OR REPLACE FUNCTION public.save_employee_meeting(p_meeting_id uuid,p_version integer,p_patch jsonb,p_private_notes text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings; v_version integer;
BEGIN
  m:=public.require_employee_meeting_access(p_meeting_id);
  IF m.version IS NULL OR p_version IS NULL OR m.version <> p_version THEN
    -- PT409 = HTTP 409 Conflict. Nicht 40001: dieser Code wird als
    -- wiederholbarer Transaktionskonflikt behandelt und die Antwort bleibt aus.
    RAISE EXCEPTION 'Zwischenzeitlich geändert. Bitte neu laden, bevor Sie erneut speichern.' USING ERRCODE='PT409';
  END IF;
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
  -- Der Zähler gehört dem Trigger; bleibt er stehen, ist die Sperre wirkungslos.
  SELECT version INTO v_version FROM public.employee_meetings WHERE id=m.id;
  IF v_version IS NOT DISTINCT FROM m.version THEN
    RAISE EXCEPTION 'Der Versionszähler des Gesprächs ist nicht aktiv; Speichern abgebrochen.' USING ERRCODE='55000';
  END IF;
  RETURN v_version;
END $$;

COMMENT ON FUNCTION public.save_employee_meeting(uuid,integer,jsonb,text) IS 'version-guard 20261128070000';

-- Nachweis für das Ergebnisfenster des SQL-Editors.
SELECT
  p.oid::regprocedure::text AS funktion,
  obj_description(p.oid, 'pg_proc') AS marke,
  pg_get_functiondef(p.oid) LIKE '%ERRCODE=''PT409''%' AS meldet_konflikt,
  pg_get_functiondef(p.oid) LIKE '%''40001''%' AS noch_40001
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'save_employee_meeting';
