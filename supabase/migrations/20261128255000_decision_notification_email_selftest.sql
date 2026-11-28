CREATE OR REPLACE FUNCTION public.decision_notification_email_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_decision uuid;
  v_creator_decision uuid;
  v_type_request uuid;
  v_type_digest uuid;
  v_type_mention uuid;
  v_type_completed uuid;
  v_local time;
  v_quiet_start time;
  v_quiet_end time;
  v_request_first uuid;
  v_request_second uuid;
  v_digest_notification uuid;
  v_mention_notification uuid;
  v_creator_result_notification uuid;
  v_quiet_notification uuid;
  v_quiet_defer timestamptz;
  v_immediate boolean := false;
  v_email_off boolean := false;
  v_digest_suppressed boolean := false;
  v_digest_email boolean := false;
  v_always boolean := false;
  v_off_suppressed boolean := false;
  v_creator_result boolean := false;
  v_quiet_deferred boolean := false;
  v_quiet_claimed boolean := false;
  v_claimed integer := 0;
  v_finished boolean := false;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_actor AND m.is_active
  ORDER BY m.user_id LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – E-Mail-Kanal nicht prüfbar.');
  END IF;

  SELECT id INTO v_type_request FROM public.notification_types
  WHERE tenant_id = p_tenant AND name = 'task_decision_request' LIMIT 1;
  SELECT id INTO v_type_digest FROM public.notification_types
  WHERE tenant_id = p_tenant AND name = 'task_decision_digest' LIMIT 1;
  SELECT id INTO v_type_mention FROM public.notification_types
  WHERE tenant_id = p_tenant AND name = 'task_decision_mention' LIMIT 1;
  SELECT id INTO v_type_completed FROM public.notification_types
  WHERE tenant_id = p_tenant AND name = 'task_decision_completed' LIMIT 1;

  IF v_type_request IS NULL OR v_type_digest IS NULL OR v_type_mention IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Die Entscheidungs-Meldungstypen sind nicht vollständig angelegt.');
  END IF;

  BEGIN
    -- Ausgangslage: E-Mail für Anfragen, Erwähnungen und Digest aktiviert.
    INSERT INTO public.user_notification_settings AS s
      (user_id, notification_type_id, is_enabled, push_enabled, email_enabled,
       quiet_hours_start, quiet_hours_end)
    VALUES
      (v_recipient, v_type_request, true, false, true, NULL, NULL),
      (v_recipient, v_type_mention, true, false, true, NULL, NULL),
      (v_recipient, v_type_digest, true, false, true, NULL, NULL)
    ON CONFLICT (user_id, notification_type_id) DO UPDATE
      SET is_enabled = true,
          push_enabled = false,
          email_enabled = true,
          quiet_hours_start = NULL,
          quiet_hours_end = NULL;

    IF v_type_completed IS NOT NULL THEN
      INSERT INTO public.user_notification_settings AS s
        (user_id, notification_type_id, is_enabled, push_enabled, email_enabled,
         quiet_hours_start, quiet_hours_end)
      VALUES (v_recipient, v_type_completed, true, false, true, NULL, NULL)
      ON CONFLICT (user_id, notification_type_id) DO UPDATE
        SET is_enabled = true,
            push_enabled = false,
            email_enabled = true;
    END IF;

    INSERT INTO public.decision_notification_preferences AS p
      (user_id, tenant_id, delivery_mode, daily_digest_enabled, updated_at)
    VALUES (v_recipient, p_tenant, 'immediate', false, now())
    ON CONFLICT (user_id, tenant_id) DO UPDATE
      SET delivery_mode = 'immediate', daily_digest_enabled = false, updated_at = now();

    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] E-Mail-Kanal', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_decision;

    -- 1. Sofort-Modus mit aktivierter E-Mail: Outbox-Zeile entsteht.
    INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (p_tenant, v_recipient, v_type_request, 'Neue Entscheidung',
            'Bitte antworte auf die Entscheidung.',
            jsonb_build_object('decision_id', v_decision, 'tenant_id', p_tenant), 'medium')
    RETURNING id INTO v_request_first;

    v_immediate := EXISTS (
      SELECT 1 FROM public.decision_notification_email_dispatches d
      WHERE d.notification_id = v_request_first AND d.status = 'pending'
        AND d.user_id = v_recipient AND d.tenant_id = p_tenant
    );

    -- 2. E-Mail abgeschaltet: keine Zeile.
    UPDATE public.user_notification_settings
    SET email_enabled = false
    WHERE user_id = v_recipient AND notification_type_id = v_type_request;

    INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (p_tenant, v_recipient, v_type_request, 'Neue Entscheidung',
            'Bitte antworte auf die Entscheidung.',
            jsonb_build_object('decision_id', v_decision, 'tenant_id', p_tenant), 'medium')
    RETURNING id INTO v_request_second;

    v_email_off := NOT EXISTS (
      SELECT 1 FROM public.decision_notification_email_dispatches d
      WHERE d.notification_id = v_request_second
    );

    -- 3. Gebündelter Modus: Einzelmeldung ohne Mail, Digest-Meldung mit Mail.
    UPDATE public.user_notification_settings
    SET email_enabled = true
    WHERE user_id = v_recipient AND notification_type_id = v_type_request;
    UPDATE public.decision_notification_preferences
    SET delivery_mode = 'digest', updated_at = now()
    WHERE user_id = v_recipient AND tenant_id = p_tenant;

    INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (p_tenant, v_recipient, v_type_request, 'Neue Entscheidung',
            'Bitte antworte auf die Entscheidung.',
            jsonb_build_object('decision_id', v_decision, 'tenant_id', p_tenant), 'medium')
    RETURNING id INTO v_request_second;

    v_digest_suppressed := NOT EXISTS (
      SELECT 1 FROM public.decision_notification_email_dispatches d
      WHERE d.notification_id = v_request_second
    );

    INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (p_tenant, v_recipient, v_type_digest, 'Neue Meldungen zu einer Entscheidung',
            '2 neue Meldungen zu einer Entscheidung.',
            jsonb_build_object('decision_id', v_decision, 'tenant_id', p_tenant, 'digest', true), 'medium')
    RETURNING id INTO v_digest_notification;

    v_digest_email := EXISTS (
      SELECT 1 FROM public.decision_notification_email_dispatches d
      WHERE d.notification_id = v_digest_notification AND d.status = 'pending'
    );

    -- 4. Ergebnis des Erstellers geht auch im Digest-Modus sofort per E-Mail.
    IF v_type_completed IS NOT NULL THEN
      INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
      VALUES ('[SELFTEST] Eigenes Ergebnis', '[SELFTEST]', v_recipient, p_tenant)
      RETURNING id INTO v_creator_decision;

      INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
      VALUES (p_tenant, v_recipient, v_type_completed, 'Ergebnis verfügbar',
              'Alle Antworten sind eingegangen.',
              jsonb_build_object('decision_id', v_creator_decision, 'tenant_id', p_tenant), 'medium')
      RETURNING id INTO v_creator_result_notification;

      v_creator_result := EXISTS (
        SELECT 1 FROM public.decision_notification_email_dispatches d
        WHERE d.notification_id = v_creator_result_notification
      );
    END IF;

    -- 5. Modus "aus": Anfrage ohne Mail, Erwähnung bleibt sofort.
    UPDATE public.decision_notification_preferences
    SET delivery_mode = 'off', updated_at = now()
    WHERE user_id = v_recipient AND tenant_id = p_tenant;

    INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (p_tenant, v_recipient, v_type_request, 'Neue Entscheidung',
            'Bitte antworte auf die Entscheidung.',
            jsonb_build_object('decision_id', v_decision, 'tenant_id', p_tenant), 'medium')
    RETURNING id INTO v_request_second;

    v_off_suppressed := NOT EXISTS (
      SELECT 1 FROM public.decision_notification_email_dispatches d
      WHERE d.notification_id = v_request_second
    );

    INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (p_tenant, v_recipient, v_type_mention, 'Du wurdest erwähnt',
            'Du wurdest in einer Entscheidung erwähnt.',
            jsonb_build_object('decision_id', v_decision, 'tenant_id', p_tenant), 'high')
    RETURNING id INTO v_mention_notification;

    v_always := EXISTS (
      SELECT 1 FROM public.decision_notification_email_dispatches d
      WHERE d.notification_id = v_mention_notification
    );

    -- 6. Ruhezeiten: Mail wird zurückgestellt und in diesem Lauf nicht übernommen.
    v_local := (now() AT TIME ZONE 'Europe/Berlin')::time;
    v_quiet_start := v_local - interval '1 hour';
    v_quiet_end := v_local + interval '1 hour';

    UPDATE public.user_notification_settings
    SET quiet_hours_start = v_quiet_start, quiet_hours_end = v_quiet_end
    WHERE user_id = v_recipient AND notification_type_id = v_type_mention;

    INSERT INTO public.notifications (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (p_tenant, v_recipient, v_type_mention, 'Du wurdest erwähnt',
            'Du wurdest in einer Entscheidung erwähnt (Ruhezeit).',
            jsonb_build_object('decision_id', v_decision, 'tenant_id', p_tenant), 'high')
    RETURNING id INTO v_quiet_notification;

    SELECT d.defer_until INTO v_quiet_defer
    FROM public.decision_notification_email_dispatches d
    WHERE d.notification_id = v_quiet_notification;

    v_quiet_deferred := v_quiet_defer IS NOT NULL AND v_quiet_defer > now();

    SELECT count(*) INTO v_claimed
    FROM public.claim_decision_notification_email_dispatches(100) c
    WHERE c.notification_id = v_request_first;

    SELECT EXISTS (
      SELECT 1 FROM public.decision_notification_email_dispatches d
      WHERE d.notification_id = v_quiet_notification AND d.status = 'processing'
    ) INTO v_quiet_claimed;

    PERFORM public.finish_decision_notification_email_dispatch(
      (SELECT d.id FROM public.decision_notification_email_dispatches d
       WHERE d.notification_id = v_request_first),
      'sent',
      NULL
    );

    SELECT EXISTS (
      SELECT 1 FROM public.decision_notification_email_dispatches d
      WHERE d.notification_id = v_request_first AND d.status = 'sent' AND d.attempts = 1
    ) INTO v_finished;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX054';
  EXCEPTION
    WHEN SQLSTATE 'ZX054' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_immediate
      AND v_email_off
      AND v_digest_suppressed
      AND v_digest_email
      AND (v_type_completed IS NULL OR v_creator_result)
      AND v_always
      AND v_off_suppressed
      AND v_quiet_deferred
      AND NOT v_quiet_claimed
      AND v_claimed = 1
      AND v_finished,
    'checks', jsonb_build_object(
      'immediate_mode_enqueues', v_immediate,
      'email_off_enqueues_nothing', v_email_off,
      'digest_mode_suppresses_single', v_digest_suppressed,
      'digest_notification_enqueues', v_digest_email,
      'creator_result_immediate', v_creator_result,
      'off_mode_suppresses_single', v_off_suppressed,
      'mention_always_enqueues', v_always,
      'quiet_hours_defer', v_quiet_deferred,
      'quiet_hours_not_claimed', NOT v_quiet_claimed,
      'claimed', v_claimed,
      'marked_sent', v_finished
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_notification_email_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_notification_email_selftest(uuid) TO authenticated;
