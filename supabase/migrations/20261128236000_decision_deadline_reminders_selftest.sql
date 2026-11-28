CREATE OR REPLACE FUNCTION public.decision_deadline_reminder_selftest(p_tenant uuid)
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
  v_quiet timestamptz := timestamptz '2026-12-01 23:00:00+01';
  v_after_quiet timestamptz := timestamptz '2026-12-02 08:05:00+01';
  v_created integer;
  v_24h integer := 0;
  v_2h integer := 0;
  v_quiet_skipped boolean := false;
  v_after_quiet_sent boolean := false;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_actor AND m.is_active
  ORDER BY m.user_id LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Frist-Erinnerung nicht prüfbar.');
  END IF;

  BEGIN
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id, response_deadline)
    VALUES ('[SELFTEST] Frist-Erinnerung', '[SELFTEST]', v_actor, p_tenant, v_base + interval '20 hours')
    RETURNING id INTO v_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient);

    v_created := public.dispatch_decision_deadline_reminders(v_base);
    SELECT count(*) INTO v_24h FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision AND user_id = v_recipient AND stage = '24h';

    -- Zweiter Lauf darf nicht erneut erinnern.
    PERFORM public.dispatch_decision_deadline_reminders(v_base);
    v_24h := (SELECT count(*) FROM public.decision_deadline_reminders
      WHERE decision_id = v_decision AND user_id = v_recipient AND stage = '24h');

    UPDATE public.task_decisions
    SET response_deadline = v_base + interval '1 hour'
    WHERE id = v_decision;
    PERFORM public.dispatch_decision_deadline_reminders(v_base);
    SELECT count(*) INTO v_2h FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision AND user_id = v_recipient AND stage = '2h';

    -- Ruhezeit: 22:00–08:00 blockiert; nach 08:00 wird nachgeholt.
    INSERT INTO public.user_notification_settings AS s
      (user_id, notification_type_id, is_enabled, push_enabled, quiet_hours_start, quiet_hours_end)
    SELECT v_recipient, t.id, true, true, '22:00', '08:00'
    FROM public.notification_types t
    WHERE t.tenant_id = p_tenant AND t.name = 'task_decision_deadline_reminder'
    ON CONFLICT (user_id, notification_type_id) DO UPDATE
      SET quiet_hours_start = '22:00', quiet_hours_end = '08:00';

    INSERT INTO public.task_decisions (title, description, created_by, tenant_id, response_deadline)
    VALUES ('[SELFTEST] Ruhezeit-Erinnerung', '[SELFTEST]', v_actor, p_tenant, v_quiet + interval '20 hours')
    RETURNING id INTO v_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient);

    PERFORM public.dispatch_decision_deadline_reminders(v_quiet);
    v_quiet_skipped := NOT EXISTS (
      SELECT 1 FROM public.decision_deadline_reminders
      WHERE decision_id = v_decision AND user_id = v_recipient
    );

    PERFORM public.dispatch_decision_deadline_reminders(v_after_quiet);
    v_after_quiet_sent := EXISTS (
      SELECT 1 FROM public.decision_deadline_reminders
      WHERE decision_id = v_decision AND user_id = v_recipient AND stage = '24h'
    );

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX036';
  EXCEPTION
    WHEN SQLSTATE 'ZX036' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_24h = 1 AND v_2h = 1 AND v_quiet_skipped AND v_after_quiet_sent,
    'checks', jsonb_build_object(
      '24h_once', v_24h = 1,
      '2h_once', v_2h = 1,
      'quiet_hours_skipped', v_quiet_skipped,
      'sent_after_quiet_hours', v_after_quiet_sent
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_deadline_reminder_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_deadline_reminder_selftest(uuid) TO authenticated;
