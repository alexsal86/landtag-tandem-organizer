-- Selbsttest des positiven Protokollpfads (Abschluss → Freigabe → Bestätigung →
-- Wiedereröffnung → Einspruch).
--
-- Freigegebene oder auditierte Gespräche sind absichtlich unlöschbar
-- (guard_employee_protocol blockiert DELETE, sobald eine Auditzeile existiert, und
-- employee_meeting_audit ist für Clients nur lesbar). Ein Selbsttest kann den positiven
-- Pfad deshalb nicht dauerhaft schreiben. Diese Funktion führt die echten Workflow-RPCs
-- in einer Untertransaktion aus, sammelt die Prüfergebnisse in Variablen und rollt alle
-- Schreibzugriffe anschließend zurück — dasselbe Muster wie selftest_employee_hr.
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
    BEGIN
      PERFORM public.acknowledge_meeting_protocol(m.id, NULL, 'veralteter-hash');
    EXCEPTION WHEN SQLSTATE '40001' THEN stale_hash := true;
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
REVOKE ALL ON FUNCTION public.selftest_employee_protocol(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.selftest_employee_protocol(uuid) TO authenticated;
COMMENT ON FUNCTION public.selftest_employee_protocol(uuid) IS
  'Prüft Abschluss, Freigabe, Bestätigung, Wiedereröffnung und Einspruch eines offenen Gesprächs mit den echten RPCs; alle Schreibzugriffe werden zurückgerollt, weil auditierte Gespräche absichtlich unlöschbar sind.';
