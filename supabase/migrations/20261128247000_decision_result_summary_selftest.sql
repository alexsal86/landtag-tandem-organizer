CREATE OR REPLACE FUNCTION public.decision_result_summary_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_decision uuid;
  v_participant uuid;
  v_completed_type uuid;
  v_request_type uuid;
  v_summary text;
  v_counts jsonb;
  v_message text;
  v_creator_summary text;
  v_participant_summary text;
  v_digest_id uuid;
  v_digest_summary text;
  v_digest_item_summary text;
  v_digest_message text;
  v_checks jsonb;
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
      'skipped', 'Keine zweite aktive Person im Büro – Ergebniszahlen nicht prüfbar.'
    );
  END IF;

  SELECT id INTO v_completed_type
  FROM public.notification_types
  WHERE tenant_id = p_tenant AND name = 'task_decision_completed' LIMIT 1;
  SELECT id INTO v_request_type
  FROM public.notification_types
  WHERE tenant_id = p_tenant AND name = 'task_decision_request' LIMIT 1;

  IF v_completed_type IS NULL OR v_request_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Benötigte Entscheidungs-Meldungstypen fehlen.');
  END IF;

  BEGIN
    INSERT INTO public.user_notification_settings
      (user_id, notification_type_id, is_enabled, push_enabled)
    SELECT u.user_id, v_completed_type, true, true
    FROM (VALUES (v_actor), (v_recipient)) AS u(user_id)
    ON CONFLICT (user_id, notification_type_id) DO UPDATE
      SET is_enabled = true, push_enabled = true;

    UPDATE public.decision_notification_preferences
    SET delivery_mode = 'digest', updated_at = now()
    WHERE user_id = v_recipient AND tenant_id = p_tenant;
    IF NOT FOUND THEN
      INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
      VALUES (v_recipient, p_tenant, 'digest');
    END IF;

    INSERT INTO public.task_decisions
      (title, description, created_by, tenant_id, response_options)
    VALUES (
      '[SELFTEST] Ergebniszahlen',
      '[SELFTEST]',
      v_actor,
      p_tenant,
      '[{"key":"yes","label":"Dafür"},{"key":"no","label":"Dagegen"},{"key":"question","label":"Rückfrage"}]'::jsonb
    )
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient)
    RETURNING id INTO v_participant;

    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type)
    VALUES (v_decision, v_participant, 'no');

    SELECT data->>'result_summary', data->'result_counts', message
      INTO v_creator_summary, v_counts, v_message
    FROM public.notifications n
    WHERE n.user_id = v_actor
      AND n.tenant_id = p_tenant
      AND n.notification_type_id = v_completed_type
      AND n.data->>'decision_id' = v_decision::text
    ORDER BY n.created_at DESC
    LIMIT 1;

    SELECT data->>'result_summary' INTO v_participant_summary
    FROM public.notifications n
    WHERE n.user_id = v_recipient
      AND n.tenant_id = p_tenant
      AND n.notification_type_id = v_completed_type
      AND n.data->>'decision_id' = v_decision::text
    ORDER BY n.created_at DESC
    LIMIT 1;

    v_summary := public.decision_result_summary(v_decision);

    -- Die Anfrage darf den Digest nicht mit einer zweiten Zeile verfälschen.
    DELETE FROM public.notifications n
    WHERE n.user_id = v_recipient
      AND n.tenant_id = p_tenant
      AND n.notification_type_id = v_request_type
      AND n.data->>'decision_id' = v_decision::text;

    UPDATE public.tenant_notification_settings
    SET decision_digest_minutes = 1, updated_at = now()
    WHERE tenant_id = p_tenant;
    IF NOT FOUND THEN
      INSERT INTO public.tenant_notification_settings (tenant_id, decision_digest_minutes)
      VALUES (p_tenant, 1);
    END IF;

    UPDATE public.notifications
    SET created_at = now() - interval '30 minutes'
    WHERE user_id = v_recipient
      AND tenant_id = p_tenant
      AND data->>'decision_id' = v_decision::text;

    PERFORM public.flush_decision_notification_digests();

    SELECT n.id, n.data->>'result_summary', n.message
      INTO v_digest_id, v_digest_summary, v_digest_message
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.user_id = v_recipient
      AND n.tenant_id = p_tenant
      AND t.name = 'task_decision_digest'
      AND n.data->>'decision_id' = v_decision::text
    ORDER BY n.created_at DESC
    LIMIT 1;

    SELECT item->>'result_summary'
      INTO v_digest_item_summary
    FROM public.notifications n,
         jsonb_array_elements(n.data->'digest_items') item
    WHERE n.id = v_digest_id
      AND item->>'type' = 'task_decision_completed'
    LIMIT 1;

    v_checks := jsonb_build_object(
      'summary', v_summary,
      'creator_summary', v_creator_summary,
      'participant_summary', v_participant_summary,
      'message_has_summary', coalesce(v_message, '') LIKE '%1 Dagegen%',
      'counts_label', v_counts->0->>'label',
      'digest_summary', v_digest_summary,
      'digest_item_summary', v_digest_item_summary,
      'digest_message_has_summary', coalesce(v_digest_message, '') LIKE '%1 Dagegen%'
    );

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX044';
  EXCEPTION
    WHEN SQLSTATE 'ZX044' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_summary = '1 Dagegen'
          AND v_creator_summary = '1 Dagegen'
          AND v_participant_summary = '1 Dagegen'
          AND v_digest_summary = '1 Dagegen'
          AND v_digest_item_summary = '1 Dagegen'
          AND coalesce(v_message, '') LIKE '%1 Dagegen%'
          AND coalesce(v_digest_message, '') LIKE '%1 Dagegen%'
          AND v_counts->0->>'key' = 'no'
          AND v_counts->0->>'count' = '1',
    'checks', v_checks
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_result_summary_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_result_summary_selftest(uuid) TO authenticated;
