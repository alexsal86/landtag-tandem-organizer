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
  v_question_decision uuid;
  v_question_participant uuid;
  v_question_user uuid;
  v_question_rows integer := 0;
  v_question_notifications integer := 0;
  v_question_open_count integer;
  v_question_age text;
  v_question_title text;
  v_question_message text;
  v_question_remaining integer;
  v_question_only_decision uuid;
  v_question_only_participant uuid;
  v_question_only_rows integer := 0;
  v_question_only_missing integer;
  v_question_only_age text;
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

    -- Offene Rückfrage: Warnung nennt Anzahl, Alter und bittet um Antwort.
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id, response_deadline)
    VALUES ('[SELFTEST] Offene Rückfrage im Ersteller-Hinweis', '[SELFTEST]', v_actor, p_tenant,
            v_base + interval '20 hours')
    RETURNING id INTO v_question_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    SELECT v_question_decision, m.user_id
    FROM public.user_tenant_memberships m
    WHERE m.tenant_id = p_tenant
      AND m.user_id <> v_actor
      AND m.is_active
    ORDER BY m.user_id
    LIMIT 2;

    SELECT p.id, p.user_id INTO v_question_participant, v_question_user
    FROM public.task_decision_participants p
    WHERE p.decision_id = v_question_decision
    ORDER BY p.user_id
    LIMIT 1;

    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type, created_at)
    VALUES (v_question_decision, v_question_participant, 'question', v_base - interval '3 days');

    PERFORM public.dispatch_decision_deadline_reminders(v_base);

    SELECT count(*) INTO v_question_rows
    FROM public.decision_deadline_reminders
    WHERE decision_id = v_question_decision
      AND user_id = v_actor
      AND stage = 'creator_24h';

    SELECT count(*),
           max((n.data->>'open_question_count')::integer),
           max(n.data->>'oldest_question_age_label'),
           max(n.title),
           max(n.message)
      INTO v_question_notifications, v_question_open_count, v_question_age, v_question_title, v_question_message
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.user_id = v_actor
      AND t.name = 'task_decision_deadline_reminder'
      AND n.data->>'decision_id' = v_question_decision::text
      AND n.data->>'creator_warning' = 'true'
      AND n.data->>'reminder_stage' = 'creator_24h';

    -- Eine beantwortete Rückfrage zählt nicht mehr als offen.
    UPDATE public.task_decision_responses
    SET creator_response = 'Beantwortet'
    WHERE decision_id = v_question_decision
      AND participant_id = v_question_participant;
    SELECT (public.decision_open_question_stats(v_question_decision, v_base)->>'open_question_count')::integer
      INTO v_question_remaining;

    -- Alle haben geantwortet, aber eine Rückfrage ist unbeantwortet: Der Ersteller
    -- wird trotzdem erinnert, weil die Entscheidung ohne Antwort nicht abschließt.
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id, response_deadline)
    VALUES ('[SELFTEST] Nur offene Rückfrage ohne fehlende Antworten', '[SELFTEST]', v_actor, p_tenant,
            v_base + interval '20 hours')
    RETURNING id INTO v_question_only_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_question_only_decision, v_question_user)
    RETURNING id INTO v_question_only_participant;

    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type, created_at)
    VALUES (v_question_only_decision, v_question_only_participant, 'question', v_base - interval '36 hours');

    PERFORM public.dispatch_decision_deadline_reminders(v_base);

    SELECT count(*),
           max((n.data->>'missing_count')::integer),
           max(n.data->>'oldest_question_age_label')
      INTO v_question_only_rows, v_question_only_missing, v_question_only_age
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.tenant_id = p_tenant
      AND n.user_id = v_actor
      AND t.name = 'task_decision_deadline_reminder'
      AND n.data->>'decision_id' = v_question_only_decision::text
      AND n.data->>'creator_warning' = 'true'
      AND n.data->>'reminder_stage' = 'creator_24h';

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
      AND v_question_rows = 1
      AND v_question_notifications = 1
      AND v_question_open_count = 1
      AND v_question_age = 'seit 3 Tagen'
      AND position('1 offene Rückfrage' IN coalesce(v_question_title, '')) > 0
      AND position('seit 3 Tagen' IN coalesce(v_question_title, '')) > 0
      AND position('bitte beantworte sie' IN coalesce(v_question_message, '')) > 0
      AND v_question_remaining = 0
      AND v_question_only_rows = 1
      AND v_question_only_missing = 0
      AND v_question_only_age = 'seit 1 Tag'
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
      'open_question_reminder', v_question_rows = 1 AND v_question_notifications = 1,
      'open_question_count', v_question_open_count,
      'open_question_age', v_question_age,
      'answered_question_not_open', v_question_remaining = 0,
      'question_without_missing_answers', v_question_only_rows = 1 AND v_question_only_missing = 0,
      'question_without_missing_answers_age', v_question_only_age,
      'no_warning_when_complete', v_all_clear_rows = 0 AND v_all_clear_notifications = 0
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_creator_deadline_warning_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_creator_deadline_warning_selftest(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decision_daily_digest_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_decision uuid;
  v_later_decision uuid;
  v_question_decision uuid;
  v_question_participant uuid;
  v_morning timestamptz := timestamptz '2026-12-01 08:00:00+01';
  v_next_morning timestamptz := timestamptz '2026-12-02 08:00:00+01';
  v_sent integer := 0;
  v_notified boolean := false;
  v_repeat_deliveries integer := 0;
  v_after_disable_notified boolean := false;
  v_question_count integer;
  v_question_age text;
  v_question_included boolean := false;
  v_question_title text;
  v_question_message text;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_actor AND m.is_active
  ORDER BY m.user_id LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Tagesüberblick nicht prüfbar.');
  END IF;

  BEGIN
    UPDATE public.decision_notification_preferences
    SET delivery_mode = 'digest', daily_digest_enabled = true, updated_at = now()
    WHERE user_id = v_recipient AND tenant_id = p_tenant;
    IF NOT FOUND THEN
      INSERT INTO public.decision_notification_preferences
        (user_id, tenant_id, delivery_mode, daily_digest_enabled)
      VALUES (v_recipient, p_tenant, 'digest', true);
    END IF;

    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Tagesüberblick', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient);

    -- Eigene Entscheidung mit einer offenen Rückfrage: Der Ersteller wird im
    -- Tagesüberblick an die unbeantwortete Rückfrage samt Alter erinnert.
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Tagesüberblick Rückfrage', '[SELFTEST]', v_recipient, p_tenant)
    RETURNING id INTO v_question_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_question_decision, v_actor)
    RETURNING id INTO v_question_participant;
    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type, created_at)
    VALUES (v_question_decision, v_question_participant, 'question', v_morning - interval '2 days');

    v_sent := public.dispatch_decision_daily_digests(v_morning);
    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_daily_digest'
        AND n.data->>'daily_digest' = 'true'
        AND (n.data->>'decision_count')::integer >= 1
        AND n.data->'decision_ids' @> jsonb_build_array(v_decision::text)
    ) INTO v_notified;

    SELECT (max(n.data->>'open_question_count'))::integer,
           max(n.data->>'oldest_question_age_label'),
           max(n.title),
           max(n.message),
           coalesce(bool_or(n.data->'creator_question_decision_ids' @> jsonb_build_array(v_question_decision::text)), false)
      INTO v_question_count, v_question_age, v_question_title, v_question_message, v_question_included
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
      AND t.name = 'task_decision_daily_digest'
      AND n.data->>'daily_digest' = 'true';

    PERFORM public.dispatch_decision_daily_digests(v_morning);
    SELECT count(*) INTO v_repeat_deliveries
    FROM public.decision_daily_digest_deliveries
    WHERE user_id = v_recipient AND tenant_id = p_tenant AND digest_date = v_morning::date;

    UPDATE public.decision_notification_preferences
    SET daily_digest_enabled = false
    WHERE user_id = v_recipient AND tenant_id = p_tenant;

    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Kein Tagesüberblick', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_later_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_later_decision, v_recipient);

    PERFORM public.dispatch_decision_daily_digests(v_next_morning);
    v_after_disable_notified := EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_daily_digest'
        AND n.data->'decision_ids' @> jsonb_build_array(v_later_decision::text)
    );

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX040';
  EXCEPTION
    WHEN SQLSTATE 'ZX040' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_notified
      AND v_repeat_deliveries = 1
      AND NOT v_after_disable_notified
      AND v_question_included
      AND v_question_count = 1
      AND v_question_age = 'seit 2 Tagen'
      AND position('1 offene Rückfrage' IN coalesce(v_question_title, '')) > 0
      AND position('bitte beantworte sie' IN coalesce(v_question_message, '')) > 0,
    'checks', jsonb_build_object(
      'daily_overview_created', v_notified,
      'no_repeat_same_day', v_repeat_deliveries = 1,
      'disabled_sends_nothing', NOT v_after_disable_notified,
      'creator_question_included', v_question_included,
      'creator_question_count', v_question_count,
      'creator_question_age', v_question_age,
      'created_first_run', v_sent
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_daily_digest_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_daily_digest_selftest(uuid) TO authenticated;
