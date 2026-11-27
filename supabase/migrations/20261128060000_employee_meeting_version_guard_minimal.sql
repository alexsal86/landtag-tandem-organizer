-- Minimale, sperrfreie Fassung: ersetzt ausschließlich Funktionen, kein DDL auf
-- public.employee_meetings.
--
-- Warum das nötig ist: die Instanz meldet für
--   save_employee_meeting(uuid,integer,jsonb,text)
-- die Marke NULL und prueft_stand = false — der Rumpf ist also unverändert der
-- alte. 20261128040000 und 20261128050000 brauchten ACCESS EXCLUSIVE auf
-- public.employee_meetings (DROP TRIGGER, ALTER TABLE). Solange die alte,
-- hängende save_employee_meeting auf derselben Tabelle arbeitet, kommt dieses DDL
-- nie an die Sperre: der SQL-Editor bricht nach seinem Zeitlimit ab und rollt die
-- komplette Transaktion zurück. Deshalb blieb die Migration wirkungslos, so oft
-- sie auch lief.
--
-- Diese Migration enthält deshalb kein DROP TRIGGER und kein ALTER TABLE:
-- CREATE OR REPLACE FUNCTION und DROP FUNCTION sperren nur das Funktionsobjekt,
-- nie die Tabelle. Sie läuft auch, während die App auf der Tabelle arbeitet.
--
-- Erwartete Ausgabe der letzten Anweisung (genau eine Zeile):
--   marke = version-guard 20261128060000 | prueft_stand = true | varianten = 1

-- 1. Triggerfunktion: Zähler auch für Bestandszeilen ohne Versionsstand.
--    `OLD.version + 1` wäre bei NULL wieder NULL, `coalesce(OLD.version,0)+1`
--    zieht solche Zeilen beim nächsten Schreibvorgang nach.
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
    NEW.version:=coalesce(OLD.version,0)+1;
  ELSIF NEW.status IN ('pending_acknowledgement','acknowledged') OR NEW.protocol_hash IS NOT NULL OR NEW.acknowledged_at IS NOT NULL OR NEW.acknowledged_by IS NOT NULL THEN
    RAISE EXCEPTION 'Gespräche müssen zuerst als Entwurf angelegt werden' USING ERRCODE='42501';
  END IF;
  NEW.employee_preparation:=NEW.employee_preparation-'private_notes';
  NEW.supervisor_preparation:=NEW.supervisor_preparation-'private_notes';
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_employee_protocol() FROM PUBLIC,anon,authenticated;

-- 2. Bestandszeilen ohne Stand nachziehen. Einfaches UPDATE (nur ROW EXCLUSIVE,
--    kein Tabellen-DDL); der eben ersetzte Trigger macht daraus 0+1 = 1.
UPDATE public.employee_meetings SET version = 0 WHERE version IS NULL;

-- 3. Die RPC neu anlegen: ausdrückliche NULL-Prüfung statt `<>`, das bei NULL
--    nie wahr wäre. Die Signatur ist auf der Instanz vorhanden und bleibt gleich.
DROP FUNCTION IF EXISTS public.save_employee_meeting(uuid,integer,jsonb,text);
CREATE FUNCTION public.save_employee_meeting(p_meeting_id uuid,p_version integer,p_patch jsonb,p_private_notes text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings; v_version integer;
BEGIN
  m:=public.require_employee_meeting_access(p_meeting_id);
  IF m.version IS NULL OR p_version IS NULL OR m.version <> p_version THEN
    RAISE EXCEPTION 'Zwischenzeitlich geändert. Bitte neu laden, bevor Sie erneut speichern.' USING ERRCODE='40001';
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

REVOKE ALL ON FUNCTION public.save_employee_meeting(uuid,integer,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_employee_meeting(uuid,integer,jsonb,text) TO authenticated;
-- Geschrieben wird ausschließlich über die Workflow-RPCs.
REVOKE UPDATE ON public.employee_meetings FROM authenticated,anon;

-- 4. Marke, damit die installierte Fassung eindeutig zuordenbar ist.
COMMENT ON FUNCTION public.save_employee_meeting(uuid,integer,jsonb,text) IS 'version-guard 20261128060000';

-- 5. Nachweis für das Ergebnisfenster.
SELECT
  p.oid::regprocedure::text AS funktion,
  obj_description(p.oid, 'pg_proc') AS marke,
  pg_get_functiondef(p.oid) LIKE '%m.version IS NULL%' AS prueft_stand,
  (SELECT count(*)::int FROM pg_proc q
    WHERE q.pronamespace = 'public'::regnamespace AND q.proname = 'save_employee_meeting') AS varianten,
  (SELECT count(*)::int FROM public.employee_meetings m WHERE m.version IS NULL) AS ohne_stand
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'save_employee_meeting';
