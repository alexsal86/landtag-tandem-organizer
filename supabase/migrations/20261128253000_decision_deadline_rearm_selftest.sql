CREATE OR REPLACE FUNCTION public.decision_deadline_rearm_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_decision uuid;
  v_base timestamptz := timestamptz '2026-12-01 12:00:00+01';
  v_before integer := 0;
  v_after_extension integer := 0;
  v_early_after_extension integer := 0;
  v_participant_after_extension integer := 0;
  v_creator_after_extension integer := 0;
  v_participant_after_shortening integer := 0;
  v_two_hour_after_shortening integer := 0;
  v_creator_after_shortening integer := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_actor AND m.is_active
  ORDER BY m.user_id LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Fristverlängerung nicht prüfbar.');
  END IF;

  BEGIN
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id, response_deadline)
    VALUES ('[SELFTEST] Fristverlängerung', '[SELFTEST]', v_actor, p_tenant, v_base + interval '20 hours')
    RETURNING id INTO v_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient);

    -- Erste Stufen: Teilnehmer-24-h und Ersteller-Warnung.
    PERFORM public.dispatch_decision_deadline_reminders(v_base);
    SELECT count(*) INTO v_before
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision;

    -- Frist um zwei Tage verlängern: alte Stufen müssen verschwinden.
    UPDATE public.task_decisions
    SET response_deadline = v_base + interval '72 hours'
    WHERE id = v_decision;

    SELECT count(*) INTO v_after_extension
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision;

    -- Neue Frist ist noch weit: der nächste Lauf erinnert nicht vorzeitig.
    PERFORM public.dispatch_decision_deadline_reminders(v_base);
    SELECT count(*) INTO v_early_after_extension
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision;

    -- 23 Stunden vor der neuen Frist greifen Teilnehmer- und Ersteller-Stufe erneut.
    PERFORM public.dispatch_decision_deadline_reminders(v_base + interval '49 hours');
    SELECT count(*) INTO v_participant_after_extension
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision AND user_id = v_recipient AND stage = '24h';
    SELECT count(*) INTO v_creator_after_extension
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision AND user_id = v_actor AND stage = 'creator_24h';

    -- Frist vorziehen: versendete Stufen bleiben, nur die 2-h-Stufe kommt hinzu.
    UPDATE public.task_decisions
    SET response_deadline = v_base + interval '50 hours'
    WHERE id = v_decision;

    PERFORM public.dispatch_decision_deadline_reminders(v_base + interval '49 hours');
    SELECT count(*) INTO v_participant_after_shortening
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision AND user_id = v_recipient AND stage = '24h';
    SELECT count(*) INTO v_two_hour_after_shortening
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision AND user_id = v_recipient AND stage = '2h';
    SELECT count(*) INTO v_creator_after_shortening
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision AND user_id = v_actor AND stage = 'creator_24h';

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX052';
  EXCEPTION
    WHEN SQLSTATE 'ZX052' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_before = 2
      AND v_after_extension = 0
      AND v_early_after_extension = 0
      AND v_participant_after_extension = 1
      AND v_creator_after_extension = 1
      AND v_participant_after_shortening = 1
      AND v_two_hour_after_shortening = 1
      AND v_creator_after_shortening = 1,
    'checks', jsonb_build_object(
      'initial_stages', v_before,
      'reset_on_extension', v_after_extension = 0,
      'no_early_reminder_for_new_deadline', v_early_after_extension = 0,
      'participant_reminder_rearmed', v_participant_after_extension = 1,
      'creator_warning_rearmed', v_creator_after_extension = 1,
      'no_duplicate_after_shortening', v_participant_after_shortening = 1,
      'two_hour_stage_after_shortening', v_two_hour_after_shortening = 1,
      'creator_no_duplicate_after_shortening', v_creator_after_shortening = 1
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_deadline_rearm_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_deadline_rearm_selftest(uuid) TO authenticated;
