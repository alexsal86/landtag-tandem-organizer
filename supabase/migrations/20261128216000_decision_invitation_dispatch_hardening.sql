-- P1.5-Nachschärfung.
--
-- 1) invite_via_email darf nur der Ersteller setzen. Die RLS-Policy
--    "Users can update their decisions" erlaubt zwar ein Update durch den
--    Ersteller im Mandanten, aber die Absicht ist eine fachliche Entscheidung und
--    gehört hinter eine geprüfte Funktion statt hinter ein beliebiges Tabellen-
--    Update. Der RPC setzt ausschließlich dieses eine Feld.
--
-- 2) Der Selbsttest prüft die echte Reihenfolge: Teilnehmer werden mit
--    invite_via_email = false eingefügt, die Zeile bleibt zunächst unabholbar,
--    erst der Ersteller-RPC gibt sie frei.
CREATE OR REPLACE FUNCTION public.request_decision_email_invites(_decision_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.task_decisions td
  SET invite_via_email = true
  WHERE td.id = _decision_id
    AND td.created_by = auth.uid()
    AND public.is_tenant_member(td.tenant_id, auth.uid());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.request_decision_email_invites(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_decision_email_invites(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decision_invitation_dispatch_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_decision uuid;
  v_participant uuid;
  v_enqueued boolean := false;
  v_claimed_before boolean := false;
  v_flag_set boolean := false;
  v_claimed boolean := false;
  v_finished boolean := false;
  v_foreign_rejected boolean := false;
  v_status text;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  BEGIN
    INSERT INTO public.task_decisions (title, description, status, created_by, tenant_id, invite_via_email)
    VALUES ('[SELFTEST] Einladungsversand', '[SELFTEST]', 'open', v_actor, p_tenant, false)
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_actor)
    RETURNING id INTO v_participant;

    SELECT EXISTS (
      SELECT 1 FROM public.decision_invitation_dispatches d
      WHERE d.participant_id = v_participant AND d.tenant_id = p_tenant AND d.status = 'pending'
    ) INTO v_enqueued;

    -- Ohne Freigabe durch den Ersteller darf der Worker die Zeile nicht übernehmen.
    SELECT EXISTS (
      SELECT 1 FROM public.claim_decision_invitation_dispatches(50) c
      WHERE c.participant_id = v_participant
    ) INTO v_claimed_before;

    -- Nur der Ersteller darf die Absicht setzen; eine fremde ID bleibt wirkungslos.
    v_foreign_rejected := NOT public.request_decision_email_invites(gen_random_uuid());
    v_flag_set := public.request_decision_email_invites(v_decision)
      AND EXISTS (SELECT 1 FROM public.task_decisions td WHERE td.id = v_decision AND td.invite_via_email);

    SELECT EXISTS (
      SELECT 1 FROM public.claim_decision_invitation_dispatches(50) c
      WHERE c.participant_id = v_participant AND c.tenant_id = p_tenant
    ) INTO v_claimed;

    SELECT d.status INTO v_status
    FROM public.decision_invitation_dispatches d
    WHERE d.participant_id = v_participant;

    PERFORM public.finish_decision_invitation_dispatch(
      (SELECT d.id FROM public.decision_invitation_dispatches d WHERE d.participant_id = v_participant),
      true,
      NULL
    );

    SELECT EXISTS (
      SELECT 1 FROM public.decision_invitation_dispatches d
      WHERE d.participant_id = v_participant AND d.status = 'sent' AND d.attempts = 1
    ) INTO v_finished;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX026';
  EXCEPTION
    WHEN SQLSTATE 'ZX026' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_enqueued AND NOT v_claimed_before AND v_foreign_rejected AND v_flag_set
      AND v_claimed AND v_status = 'processing' AND v_finished,
    'checks', jsonb_build_object(
      'enqueued', v_enqueued,
      'blocked_before_creator_release', NOT v_claimed_before,
      'foreign_decision_rejected', v_foreign_rejected,
      'creator_release', v_flag_set,
      'claimed', v_claimed,
      'processing', v_status,
      'finished', v_finished
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_invitation_dispatch_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_invitation_dispatch_selftest(uuid) TO authenticated;
