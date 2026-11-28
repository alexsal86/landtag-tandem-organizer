CREATE OR REPLACE FUNCTION public.decision_creator_deadline_warning_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_base timestamptz := timestamptz '2026-12-01 12:00:00+01';
  v_type uuid;
  v_decision uuid;
  v_decision_all_clear uuid;
  v_participant uuid;
  v_participant_count integer := 0;
  v_answered_count integer := 0;
  v_expected integer := 0;
  v_pre_rows integer := 0;
  v_pre_rows_after integer := 0;
  v_pre_notifications integer := 0;
  v_pre_notifications_after integer := 0;
  v_pre_missing text;
  v_pre_title text;
  v_pre_message text;
  v_overdue_rows integer := 0;
  v_overdue_rows_after integer := 0;
  v_overdue_notifications integer := 0;
  v_overdue_notifications_after integer := 0;
  v_overdue_missing text;
  v_overdue_title text;
  v_overdue_message text;
  v_all_clear_rows integer := 0;
  v_all_clear_notifications integer := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_type
  FROM public.notification_types
  WHERE tenant_id = p_tenant
    AND name = 'task_decision_deadline_reminder'
    AND is_active
  LIMIT 1;

  IF v_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Der Meldungstyp für Frist-Erinnerungen ist nicht aktiv.');
  END IF;

  SELECT count(*) INTO v_participant_count
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant
    AND m.user_id <> v_actor
    AND m.is_active;

  IF v_participant_count = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', 'Keine zweite aktive Person im Büro – Ersteller-Warnung nicht prüfbar.'
    );
  END IF;

  BEGIN
    INSERT INTO public.user_notification_settings
      (user_id, notification_type_id, is_enabled, push_enabled, quiet_hours_start, quiet_hours_end)
    VALUES (v_actor, v_type, true, true, NULL, NULL)
    ON CONFLICT (user_id, notification_type_id) DO UPDATE
      SET is_enabled = true,
          push_enabled = true,
          quiet_hours_start = NULL,
          quiet_hours_end = NULL;

    -- Vor Ablauf: eine Warnung an den Ersteller mit der Zahl aller offenen Antworten.
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id, response_deadline)
    VALUES ('[SELFTEST] Ersteller-Fristwarnung', '[SELFTEST]', v_actor, p_tenant,
            v_base + interval '20 hours')
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    SELECT v_decision, m.user_id
    FROM public.user_tenant_memberships m
    WHERE m.tenant_id = p_tenant
      AND m.user_id <> v_actor
      AND m.is_active
    ORDER BY m.user_id
    LIMIT 3;
    GET DIAGNOSTICS v_participant_count = ROW_COUNT;

    PERFORM public.dispatch_decision_deadline_reminders(v_base);

    SELECT count(*) INTO v_pre_rows
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision
      AND user_id = v_actor
      AND stage = 'creator_24h';

    SELECT count(*),
           max(n.data->>'missing_count'),
           max(n.title),
           max(n.message)
      INTO v_pre_notifications, v_pre_missing, v_pre_title, v_pre_message
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.user_id = v_actor
      AND t.name = 'task_decision_deadline_reminder'
      AND n.data->>'decision_id' = v_decision::text
      AND n.data->>'creator_warning' = 'true'
      AND n.data->>'reminder_stage' = 'creator_24h';

    -- Zweiter Lauf darf weder den Eintrag noch die Meldung verdoppeln.
    PERFORM public.dispatch_decision_deadline_reminders(v_base);
    SELECT count(*) INTO v_pre_rows_after
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision AND user_id = v_actor AND stage = 'creator_24h';
    SELECT count(*) INTO v_pre_notifications_after
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.user_id = v_actor
      AND t.name = 'task_decision_deadline_reminder'
      AND n.data->>'decision_id' = v_decision::text
      AND n.data->>'creator_warning' = 'true'
      AND n.data->>'reminder_stage' = 'creator_24h';

    -- Bei mehr als einer offenen Antwort eine Antwort abgeben, damit die
    -- Überfälligkeitswarnung eine kleinere, neu berechnete Zahl nennt.
    IF v_participant_count > 1 THEN
      SELECT p.id INTO v_participant
      FROM public.task_decision_participants p
      WHERE p.decision_id = v_decision
        AND p.user_id <> v_actor
      ORDER BY p.user_id
      LIMIT 1;

      INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type)
      VALUES (v_decision, v_participant, 'yes');
      v_answered_count := 1;
    END IF;

    -- Überfällig: genau eine weitere Warnung, erneut mit der aktuellen Zahl.
    UPDATE public.task_decisions
    SET response_deadline = v_base - interval '1 hour'
    WHERE id = v_decision;

    PERFORM public.dispatch_decision_deadline_reminders(v_base);

    SELECT count(*) INTO v_overdue_rows
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision
      AND user_id = v_actor
      AND stage = 'creator_overdue';

    SELECT count(*),
           max(n.data->>'missing_count'),
           max(n.title),
           max(n.message)
      INTO v_overdue_notifications, v_overdue_missing, v_overdue_title, v_overdue_message
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.user_id = v_actor
      AND t.name = 'task_decision_deadline_reminder'
      AND n.data->>'decision_id' = v_decision::text
      AND n.data->>'creator_warning' = 'true'
      AND n.data->>'reminder_stage' = 'creator_overdue';

    PERFORM public.dispatch_decision_deadline_reminders(v_base);
    SELECT count(*) INTO v_overdue_rows_after
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision AND user_id = v_actor AND stage = 'creator_overdue';
    SELECT count(*) INTO v_overdue_notifications_after
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.user_id = v_actor
      AND t.name = 'task_decision_deadline_reminder'
      AND n.data->>'decision_id' = v_decision::text
      AND n.data->>'creator_warning' = 'true'
      AND n.data->>'reminder_stage' = 'creator_overdue';

    -- Vollständig beantwortet: keine Ersteller-Warnung.
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id, response_deadline)
    VALUES ('[SELFTEST] Ersteller-Warnung ohne offene Antworten', '[SELFTEST]', v_actor, p_tenant,
            v_base + interval '20 hours')
    RETURNING id INTO v_decision_all_clear;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    SELECT v_decision_all_clear, m.user_id
    FROM public.user_tenant_memberships m
    WHERE m.tenant_id = p_tenant
      AND m.user_id <> v_actor
      AND m.is_active
    ORDER BY m.user_id
    LIMIT 1
    RETURNING id INTO v_participant;

    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type)
    VALUES (v_decision_all_clear, v_participant, 'yes');

    PERFORM public.dispatch_decision_deadline_reminders(v_base);

    SELECT count(*) INTO v_all_clear_rows
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_decision_all_clear
      AND user_id = v_actor
      AND stage IN ('creator_24h', 'creator_overdue');

    SELECT count(*) INTO v_all_clear_notifications
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.user_id = v_actor
      AND t.name = 'task_decision_deadline_reminder'
      AND n.data->>'decision_id' = v_decision_all_clear::text
      AND n.data->>'creator_warning' = 'true';

    v_expected := v_participant_count - v_answered_count;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX048';
  EXCEPTION
    WHEN SQLSTATE 'ZX048' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_expected > 0
      AND v_pre_rows = 1
      AND v_pre_rows_after = 1
      AND v_pre_notifications = 1
      AND v_pre_notifications_after = 1
      AND v_pre_missing IS NOT NULL
      AND v_pre_missing::integer = v_participant_count
      AND position(v_pre_missing IN coalesce(v_pre_title, '')) > 0
      AND position(v_pre_missing IN coalesce(v_pre_message, '')) > 0
      AND v_overdue_rows = 1
      AND v_overdue_rows_after = 1
      AND v_overdue_notifications = 1
      AND v_overdue_notifications_after = 1
      AND v_overdue_missing IS NOT NULL
      AND v_overdue_missing::integer = v_expected
      AND position(v_overdue_missing IN coalesce(v_overdue_title, '')) > 0
      AND position(v_overdue_missing IN coalesce(v_overdue_message, '')) > 0
      AND v_all_clear_rows = 0
      AND v_all_clear_notifications = 0,
    'checks', jsonb_build_object(
      'participants', v_participant_count,
      'pre_reminder_once', v_pre_rows = 1 AND v_pre_rows_after = 1,
      'pre_notification_once', v_pre_notifications = 1 AND v_pre_notifications_after = 1,
      'pre_missing_count', v_pre_missing::integer,
      'overdue_reminder_once', v_overdue_rows = 1 AND v_overdue_rows_after = 1,
      'overdue_notification_once', v_overdue_notifications = 1 AND v_overdue_notifications_after = 1,
      'overdue_missing_count', v_overdue_missing::integer,
      'no_warning_when_complete', v_all_clear_rows = 0 AND v_all_clear_notifications = 0
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_creator_deadline_warning_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_creator_deadline_warning_selftest(uuid) TO authenticated;
