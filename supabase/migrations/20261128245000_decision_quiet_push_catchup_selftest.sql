CREATE OR REPLACE FUNCTION public.decision_quiet_push_catchup_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_request_type uuid;
  v_digest_type uuid;
  v_comment_type uuid;
  v_start time;
  v_end time;
  v_request_id uuid;
  v_digest_id uuid;
  v_comment_id uuid;
  v_deferred timestamptz;
  v_catchup timestamptz;
  v_catchup_after timestamptz;
  v_catchup_count integer := 0;
  v_second_count integer := 0;
  v_request_deferred boolean := false;
  v_digest_deferred boolean := false;
  v_constituent_not_deferred boolean := false;
  v_request_caught_up boolean := false;
  v_no_duplicate boolean := false;
  v_quiet_hours_used boolean := false;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_actor AND m.is_active
  ORDER BY m.user_id LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', 'Keine zweite aktive Person im Büro – Ruhezeiten-Catch-up nicht prüfbar.'
    );
  END IF;

  SELECT id INTO v_request_type
  FROM public.notification_types
  WHERE tenant_id = p_tenant AND name = 'task_decision_request' LIMIT 1;
  SELECT id INTO v_digest_type
  FROM public.notification_types
  WHERE tenant_id = p_tenant AND name = 'task_decision_digest' LIMIT 1;
  SELECT id INTO v_comment_type
  FROM public.notification_types
  WHERE tenant_id = p_tenant AND name = 'task_decision_comment_received' LIMIT 1;

  IF v_request_type IS NULL OR v_digest_type IS NULL OR v_comment_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Benötigte Entscheidungs-Meldungstypen fehlen.');
  END IF;

  -- Ruhezeit um die aktuelle Berliner Zeit legen, damit der Test unabhängig
  -- von der Uhrzeit des Laufs ist. Über Mitternacht funktioniert die Zeitrechnung
  -- ebenfalls (Start > Ende).
  v_start := (now() AT TIME ZONE 'Europe/Berlin')::time - interval '1 hour';
  v_end := (now() AT TIME ZONE 'Europe/Berlin')::time + interval '1 hour';

  BEGIN
    UPDATE public.decision_notification_preferences
    SET delivery_mode = 'immediate', updated_at = now()
    WHERE user_id = v_recipient AND tenant_id = p_tenant;
    IF NOT FOUND THEN
      INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
      VALUES (v_recipient, p_tenant, 'immediate');
    END IF;

    INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh_key, auth_key, is_active)
    VALUES (
      v_recipient,
      'https://selftest.invalid/' || v_recipient::text || '-' || clock_timestamp()::text,
      'selftest-p256dh',
      'selftest-auth',
      true
    );

    INSERT INTO public.user_notification_settings
      (user_id, notification_type_id, is_enabled, push_enabled, quiet_hours_start, quiet_hours_end)
    VALUES (v_recipient, v_request_type, true, true, v_start, v_end)
    ON CONFLICT (user_id, notification_type_id) DO UPDATE
      SET is_enabled = true, push_enabled = true,
          quiet_hours_start = excluded.quiet_hours_start,
          quiet_hours_end = excluded.quiet_hours_end;

    INSERT INTO public.notifications
      (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (
      p_tenant, v_recipient, v_request_type,
      '[SELFTEST] Ruhezeit-Anfrage', '[SELFTEST] Anfrage während der Ruhezeit',
      jsonb_build_object('decision_id', gen_random_uuid(), 'tenant_id', p_tenant),
      'medium'
    )
    RETURNING id INTO v_request_id;

    SELECT push_deferred_until INTO v_deferred
    FROM public.notifications WHERE id = v_request_id;

    v_quiet_hours_used := v_start <> v_end;
    v_request_deferred := v_deferred IS NOT NULL AND v_deferred > now();

    -- Nach Ende der Ruhezeit genau einmal nachholen.
    UPDATE public.user_notification_settings
    SET quiet_hours_start = NULL, quiet_hours_end = NULL
    WHERE user_id = v_recipient AND notification_type_id = v_request_type;

    UPDATE public.notifications
    SET push_deferred_until = now() - interval '1 minute'
    WHERE id = v_request_id;

    v_catchup_count := public.dispatch_deferred_decision_pushes(now(), false);

    SELECT push_catchup_sent_at INTO v_catchup
    FROM public.notifications WHERE id = v_request_id;

    v_request_caught_up := v_catchup IS NOT NULL;

    v_second_count := public.dispatch_deferred_decision_pushes(now(), false);

    SELECT push_catchup_sent_at INTO v_catchup_after
    FROM public.notifications WHERE id = v_request_id;

    v_no_duplicate := v_catchup_after IS NOT DISTINCT FROM v_catchup;

    -- Digest selbst wird trotz Modus "gebündelt" während der Ruhezeit gepuffert.
    UPDATE public.decision_notification_preferences
    SET delivery_mode = 'digest', updated_at = now()
    WHERE user_id = v_recipient AND tenant_id = p_tenant;

    INSERT INTO public.user_notification_settings
      (user_id, notification_type_id, is_enabled, push_enabled, quiet_hours_start, quiet_hours_end)
    VALUES (v_recipient, v_digest_type, true, true, v_start, v_end)
    ON CONFLICT (user_id, notification_type_id) DO UPDATE
      SET is_enabled = true, push_enabled = true,
          quiet_hours_start = excluded.quiet_hours_start,
          quiet_hours_end = excluded.quiet_hours_end;

    INSERT INTO public.notifications
      (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (
      p_tenant, v_recipient, v_digest_type,
      '[SELFTEST] Ruhezeit-Digest', '[SELFTEST] Digest während der Ruhezeit',
      jsonb_build_object('decision_id', gen_random_uuid(), 'digest', true),
      'medium'
    )
    RETURNING id INTO v_digest_id;

    SELECT push_deferred_until INTO v_deferred
    FROM public.notifications WHERE id = v_digest_id;
    v_digest_deferred := v_deferred IS NOT NULL AND v_deferred > now();

    -- Einzelmeldung im Modus "gebündelt" darf keinen eigenen Push-Puffer bekommen;
    -- sonst gäbe es nach der Ruhezeit eine doppelte Zustellung neben dem Digest.
    INSERT INTO public.user_notification_settings
      (user_id, notification_type_id, is_enabled, push_enabled, quiet_hours_start, quiet_hours_end)
    VALUES (v_recipient, v_comment_type, true, true, v_start, v_end)
    ON CONFLICT (user_id, notification_type_id) DO UPDATE
      SET is_enabled = true, push_enabled = true,
          quiet_hours_start = excluded.quiet_hours_start,
          quiet_hours_end = excluded.quiet_hours_end;

    INSERT INTO public.notifications
      (tenant_id, user_id, notification_type_id, title, message, data, priority)
    VALUES (
      p_tenant, v_recipient, v_comment_type,
      '[SELFTEST] Ruhezeit-Kommentar', '[SELFTEST] Kommentar während der Ruhezeit',
      jsonb_build_object('decision_id', gen_random_uuid()),
      'medium'
    )
    RETURNING id INTO v_comment_id;

    SELECT push_deferred_until INTO v_deferred
    FROM public.notifications WHERE id = v_comment_id;
    v_constituent_not_deferred := v_deferred IS NULL;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX043';
  EXCEPTION
    WHEN SQLSTATE 'ZX043' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_quiet_hours_used AND v_request_deferred
          AND v_request_caught_up AND v_no_duplicate AND v_digest_deferred
          AND v_constituent_not_deferred,
    'checks', jsonb_build_object(
      'request_deferred', v_request_deferred,
      'request_caught_up', v_request_caught_up,
      'catchup_count', v_catchup_count,
      'second_dispatch_count', v_second_count,
      'no_duplicate', v_no_duplicate,
      'digest_deferred', v_digest_deferred,
      'digest_constituent_not_deferred', v_constituent_not_deferred
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_quiet_push_catchup_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_quiet_push_catchup_selftest(uuid) TO authenticated;
