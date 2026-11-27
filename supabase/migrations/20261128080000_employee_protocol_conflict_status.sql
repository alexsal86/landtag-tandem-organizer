-- Auch die Bestätigung eines erneut freigegebenen Protokolls ist ein Konflikt,
-- kein wiederholbarer Transaktionskonflikt.
--
-- acknowledge_meeting_protocol wies einen abweichenden Freigabe-Hash bisher mit
-- 40001 ab. Derselbe Code ließ den Aufruf mit veraltetem Autosave-Stand auf der
-- Instanz in die Zeitüberschreitung laufen (siehe
-- 20261128070000_employee_meeting_conflict_status.sql); 40001 gehört zur Klasse
-- der wiederholbaren Transaktionskonflikte und wird von Zwischenschichten als
-- "erneut versuchen" gelesen. PT409 trägt dieselbe Abweisung als HTTP 409 und
-- kommt beim Client an.
--
-- Mit demselben Lauf wird der Selbsttest des positiven Pfads nachgezogen: er
-- prüft den veralteten Hash und muss beide Codes als Abweisung erkennen, damit
-- er auf einer noch nicht nachgezogenen Instanz nicht hart scheitert.
--
-- Die Migration ersetzt ausschließlich zwei Funktionsrümpfe (CREATE OR REPLACE,
-- gleiche Signaturen, kein Tabellen-DDL) und lässt sich beliebig oft einspielen.

CREATE OR REPLACE FUNCTION public.acknowledge_meeting_protocol(p_meeting_id uuid,p_comment text DEFAULT NULL,p_protocol_hash text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings; c text:=nullif(btrim(p_comment),'');
BEGIN
  m:=public.require_employee_meeting_access(p_meeting_id);
  IF m.employee_id<>auth.uid() THEN RAISE EXCEPTION 'Nur die betroffene Person kann bestätigen' USING ERRCODE='42501'; END IF;
  IF m.status<>'pending_acknowledgement' THEN RAISE EXCEPTION 'Keine offene Bestätigung' USING ERRCODE='22023'; END IF;
  IF p_protocol_hash IS NOT NULL AND p_protocol_hash IS DISTINCT FROM m.protocol_hash THEN RAISE EXCEPTION 'Das Protokoll wurde erneut freigegeben. Bitte vor der Bestätigung neu laden.' USING ERRCODE='PT409'; END IF;
  IF m.protocol_hash IS DISTINCT FROM public.employee_protocol_hash(m.id) THEN RAISE EXCEPTION 'Protokollinhalt stimmt nicht mit der Freigabe überein' USING ERRCODE='55000'; END IF;
  -- An objection must be resolved by reopening and requesting acknowledgement again.
  IF c IS NULL AND m.acknowledgement_comment IS NOT NULL THEN RAISE EXCEPTION 'Der Einspruch muss zuerst durch die Gesprächsleitung geklärt werden'; END IF;
  UPDATE public.employee_meetings SET status=CASE WHEN c IS NULL THEN 'acknowledged' ELSE 'pending_acknowledgement' END,
    acknowledged_at=CASE WHEN c IS NULL THEN now() END,acknowledged_by=CASE WHEN c IS NULL THEN auth.uid() END,acknowledgement_comment=c WHERE id=m.id;
  INSERT INTO public.employee_meeting_audit(meeting_id,actor,action,reason,protocol_hash) VALUES(m.id,auth.uid(),CASE WHEN c IS NULL THEN 'acknowledged' ELSE 'objection' END,c,m.protocol_hash);
  PERFORM public.create_notification(m.conducted_by,'employee_protocol_response',CASE WHEN c IS NULL THEN 'Protokoll bestätigt' ELSE 'Einspruch zum Protokoll' END,
    coalesce(c,'Das Mitarbeitergespräch wurde bestätigt.'),jsonb_build_object('meeting_id',m.id),'medium');
END $$;

CREATE OR REPLACE FUNCTION public.selftest_employee_protocol(p_meeting_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  m public.employee_meetings;
  v_result jsonb;
  v_version integer;
  v_hash text;
  v_signed boolean;
  v_task uuid;
  v_completed boolean;
  status_request text;
  status_ack text;
  status_reopen text;
  status_objection text;
  comment_objection text;
  release_audit integer;
  ack_audit integer;
  reopen_audit integer;
  objection_audit integer;
  open_items integer;
  frozen_lock boolean := false;
  stale_hash boolean := false;
  objection_blocks boolean := false;
BEGIN
  m := public.require_employee_meeting_access(p_meeting_id, true);
  IF m.employee_id <> auth.uid() THEN
    RAISE EXCEPTION 'Der Freigabepfad lässt sich nur mit dem eigenen Gespräch prüfen.' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.employee_meeting_audit WHERE meeting_id=m.id) THEN
    RAISE EXCEPTION 'Das Gespräch trägt bereits Auditzeilen; bitte ein ungeprüftes Gespräch verwenden.' USING ERRCODE='55000';
  END IF;
  IF m.status NOT IN ('scheduled','in_progress') THEN
    RAISE EXCEPTION 'Bitte ein offenes Gespräch übergeben (Status %).', m.status USING ERRCODE='22023';
  END IF;
  SELECT count(*) INTO open_items FROM public.employee_meeting_action_items
    WHERE meeting_id=m.id AND task_id IS NULL AND status<>'cancelled';
  BEGIN
    SELECT version INTO v_version FROM public.employee_meetings WHERE id=m.id;
    IF m.status='scheduled' THEN
      v_version := public.save_employee_meeting(m.id, v_version, '{"status":"in_progress"}'::jsonb);
    END IF;
    v_version := public.save_employee_meeting(m.id, v_version, '{"status":"completed"}'::jsonb);
    SELECT status='completed' AND completed_at IS NOT NULL INTO v_completed
      FROM public.employee_meetings WHERE id=m.id;

    PERFORM public.request_protocol_acknowledgement(m.id);
    SELECT status, protocol_hash INTO status_request, v_hash FROM public.employee_meetings WHERE id=m.id;
    v_signed := v_hash IS NOT NULL AND v_hash = public.employee_protocol_hash(m.id);
    SELECT count(*) INTO release_audit FROM public.employee_meeting_audit
      WHERE meeting_id=m.id AND action='requested' AND actor=auth.uid();

    -- Freigegebener Inhalt ist eingefroren.
    BEGIN
      UPDATE public.employee_meetings SET protocol_data=protocol_data||'{"selftest":"change after release"}'::jsonb
        WHERE id=m.id;
    EXCEPTION WHEN SQLSTATE '55000' THEN frozen_lock := true;
    END;

    -- Ein veralteter Freigabe-Hash darf die Bestätigung nicht durchlassen.
    -- PT409 ist der aktuelle Code, 40001 die Antwort einer noch nicht
    -- nachgezogenen Instanz.
    BEGIN
      PERFORM public.acknowledge_meeting_protocol(m.id, NULL, 'veralteter-hash');
    EXCEPTION WHEN SQLSTATE 'PT409' OR SQLSTATE '40001' THEN stale_hash := true;
    END;

    PERFORM public.acknowledge_meeting_protocol(m.id, NULL, v_hash);
    SELECT status INTO status_ack FROM public.employee_meetings WHERE id=m.id;
    SELECT count(*) INTO ack_audit FROM public.employee_meeting_audit
      WHERE meeting_id=m.id AND action='acknowledged' AND actor=auth.uid();
    SELECT task_id INTO v_task FROM public.employee_meeting_action_items
      WHERE meeting_id=m.id AND task_id IS NOT NULL LIMIT 1;

    PERFORM public.reopen_meeting_protocol(m.id, 'Selbsttest: Wiedereröffnung');
    SELECT status INTO status_reopen FROM public.employee_meetings WHERE id=m.id;
    SELECT count(*) INTO reopen_audit FROM public.employee_meeting_audit
      WHERE meeting_id=m.id AND action='reopened' AND reason='Selbsttest: Wiedereröffnung';

    SELECT version INTO v_version FROM public.employee_meetings WHERE id=m.id;
    v_version := public.save_employee_meeting(m.id, v_version, '{"status":"completed"}'::jsonb);
    PERFORM public.request_protocol_acknowledgement(m.id);
    PERFORM public.acknowledge_meeting_protocol(m.id, 'Selbsttest: Einspruch');
    SELECT status, acknowledgement_comment INTO status_objection, comment_objection
      FROM public.employee_meetings WHERE id=m.id;
    SELECT count(*) INTO objection_audit FROM public.employee_meeting_audit
      WHERE meeting_id=m.id AND action='objection' AND actor=auth.uid();

    -- Ein offener Einspruch blockiert die abstandslose Bestätigung.
    BEGIN
      PERFORM public.acknowledge_meeting_protocol(m.id, NULL);
    EXCEPTION WHEN OTHERS THEN objection_blocks := sqlerrm LIKE '%Einspruch%';
    END;

    v_result := jsonb_build_object(
      'completed_by_workflow', v_completed,
      'released', status_request='pending_acknowledgement',
      'signed_hash', v_signed,
      'release_audit', release_audit=1,
      'frozen_after_release', frozen_lock,
      'stale_hash_rejected', stale_hash,
      'acknowledged', status_ack='acknowledged',
      'acknowledge_audit', ack_audit=1,
      'action_task_created', open_items=0 OR v_task IS NOT NULL,
      'reopened', status_reopen='in_progress',
      'reopen_audit', reopen_audit=1,
      'objection_kept_open', status_objection='pending_acknowledgement'
        AND nullif(btrim(coalesce(comment_objection,'')),'') IS NOT NULL,
      'objection_audit', objection_audit=1,
      'objection_blocks_acknowledgement', objection_blocks
    );
    RAISE EXCEPTION 'Mitarbeitergespräch-Selbsttest zurückrollen' USING ERRCODE='P0004';
  EXCEPTION WHEN SQLSTATE 'P0004' THEN NULL;
  END;
  RETURN v_result;
END $$;

COMMENT ON FUNCTION public.acknowledge_meeting_protocol(uuid,text,text) IS 'protocol-conflict PT409 20261128080000';
COMMENT ON FUNCTION public.selftest_employee_protocol(uuid) IS
  'Prüft Abschluss, Freigabe, Bestätigung, Wiedereröffnung und Einspruch eines offenen Gesprächs mit den echten RPCs; alle Schreibzugriffe werden zurückgerollt, weil auditierte Gespräche absichtlich unlöschbar sind. Erkennt den abweichenden Freigabe-Hash an PT409 und 40001.';

-- Nachweis für das Ergebnisfenster des SQL-Editors.
SELECT
  p.oid::regprocedure::text AS funktion,
  obj_description(p.oid, 'pg_proc') AS marke,
  pg_get_functiondef(p.oid) LIKE '%''PT409''%' AS meldet_konflikt,
  pg_get_functiondef(p.oid) LIKE '%''40001''%' AS kennt_40001
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('acknowledge_meeting_protocol','selftest_employee_protocol')
ORDER BY p.proname;
