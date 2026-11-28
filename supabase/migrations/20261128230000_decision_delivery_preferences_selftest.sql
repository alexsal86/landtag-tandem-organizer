-- Digest-Selbsttest braucht die neue Frequenzeinstellung; ohne "gebündelt" wird
-- bewusst nicht mehr gebündelt.
CREATE OR REPLACE FUNCTION public.decision_digest_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_author uuid := auth.uid();
  v_recipient uuid;
  v_decision uuid;
  v_participant uuid;
  v_comment uuid;
  v_digest_count integer;
  v_digest_ok boolean := false;
  v_creator_has_no_digest boolean := true;
  v_old_read boolean := false;
  v_old_superseded boolean := false;
  v_reaction_window_ok boolean := false;
  v_reaction_rows integer;
BEGIN
  IF v_author IS NULL OR NOT public.is_tenant_member(p_tenant, v_author) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_author AND m.is_active
  ORDER BY m.user_id
  LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Digest nicht prüfbar.');
  END IF;

  BEGIN
    INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
    VALUES (v_recipient, p_tenant, 'digest')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET delivery_mode = 'digest', updated_at = now();

    INSERT INTO public.tenant_notification_settings AS s
      (tenant_id, decision_reaction_window_minutes, decision_digest_minutes, updated_by)
    VALUES (p_tenant, 60, 15, v_author)
    ON CONFLICT (tenant_id) DO UPDATE
      SET decision_reaction_window_minutes = 60,
          decision_digest_minutes = 15,
          updated_by = v_author;

    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Digest', '[SELFTEST]', v_author, p_tenant)
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient)
    RETURNING id INTO v_participant;

    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_decision, v_author, '[SELFTEST] Erster Kommentar'),
           (v_decision, v_author, '[SELFTEST] Zweiter Kommentar');

    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type)
    VALUES (v_decision, v_participant, 'yes');

    UPDATE public.notifications n
    SET created_at = now() - interval '30 minutes'
    FROM public.notification_types t
    WHERE t.id = n.notification_type_id
      AND n.user_id = v_recipient
      AND n.tenant_id = p_tenant
      AND t.name IN ('task_decision_comment_received', 'task_decision_completed')
      AND n.data->>'decision_id' = v_decision::text;

    v_digest_count := public.flush_decision_notification_digests();

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_digest'
        AND n.data->>'decision_id' = v_decision::text
        AND (n.data->>'count')::integer = 3
        AND (n.data->>'result_count')::integer = 1
        AND n.data->>'has_result' = 'true'
        AND n.data->>'digest' = 'true'
    ) INTO v_digest_ok;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_author AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_digest'
        AND n.data->>'decision_id' = v_decision::text
    ) INTO v_creator_has_no_digest;

    SELECT bool_and(n.is_read), bool_and(coalesce(n.data->>'superseded', 'false') = 'true')
      INTO v_old_read, v_old_superseded
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
      AND t.name = 'task_decision_comment_received'
      AND n.data->>'decision_id' = v_decision::text;

    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_decision, v_recipient, '[SELFTEST] Kommentar für Reaktion')
    RETURNING id INTO v_comment;

    INSERT INTO public.task_decision_comment_reactions (comment_id, user_id, emoji)
    VALUES (v_comment, v_author, '👍');

    DELETE FROM public.task_decision_comment_reactions
    WHERE comment_id = v_comment AND user_id = v_author AND emoji = '👍';

    INSERT INTO public.task_decision_comment_reactions (comment_id, user_id, emoji)
    VALUES (v_comment, v_author, '👍');

    SELECT count(*) INTO v_reaction_rows
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
      AND t.name = 'task_decision_comment_reaction_received'
      AND n.data->>'comment_id' = v_comment::text
      AND n.data->>'emoji' = '👍';

    v_reaction_window_ok := v_reaction_rows = 1;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX028';
  EXCEPTION
    WHEN SQLSTATE 'ZX028' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_digest_ok AND v_creator_has_no_digest AND v_old_read AND v_old_superseded AND v_reaction_window_ok,
    'checks', jsonb_build_object(
      'digest_created', v_digest_ok,
      'creator_has_no_digest', v_creator_has_no_digest,
      'originals_read', v_old_read,
      'originals_superseded', v_old_superseded,
      'reaction_window_from_tenant', v_reaction_window_ok,
      'digests_flushed', v_digest_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_digest_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_digest_selftest(uuid) TO authenticated;

-- Frequenz, "aus", Ruhezeiten und kritische Ausnahmen prüfen.
CREATE OR REPLACE FUNCTION public.decision_delivery_preference_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_decision uuid;
  v_before integer;
  v_after integer;
  v_digest_ok boolean := false;
  v_off_suppressed boolean := false;
  v_quiet_blocked boolean := false;
  v_quiet_open boolean := false;
  v_urgent_allowed boolean := false;
  v_urgent_created boolean := false;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_actor AND m.is_active
  ORDER BY m.user_id LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Zustellfrequenz nicht prüfbar.');
  END IF;

  BEGIN
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Zustellfrequenz', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient);

    -- gebündelt: Meldung entsteht, wird aber erst im Digest gepusht.
    INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
    VALUES (v_recipient, p_tenant, 'digest')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET delivery_mode = 'digest', updated_at = now();
    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_decision, v_actor, '[SELFTEST] Kommentar für den Digest');

    UPDATE public.notifications n
    SET created_at = now() - interval '30 minutes'
    FROM public.notification_types t
    WHERE t.id = n.notification_type_id
      AND n.user_id = v_recipient AND n.tenant_id = p_tenant
      AND t.name = 'task_decision_comment_received'
      AND n.data->>'decision_id' = v_decision::text;

    PERFORM public.flush_decision_notification_digests();

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_digest'
        AND n.data->>'decision_id' = v_decision::text
    ) INTO v_digest_ok;

    -- aus: unkritische Meldung wird nicht angelegt.
    INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
    VALUES (v_recipient, p_tenant, 'off')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET delivery_mode = 'off', updated_at = now();
    SELECT count(*) INTO v_before FROM public.notifications n
    WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant;

    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_decision, v_actor, '[SELFTEST] Kommentar bei aus');

    SELECT count(*) INTO v_after FROM public.notifications n
    WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant;
    v_off_suppressed := v_after = v_before;

    -- Ruhezeiten: 22:00–08:00 blockieren den Push, 12:00 nicht.
    INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
    VALUES (v_recipient, p_tenant, 'immediate')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET delivery_mode = 'immediate', updated_at = now();
    INSERT INTO public.user_notification_settings AS s
      (user_id, notification_type_id, is_enabled, push_enabled, quiet_hours_start, quiet_hours_end)
    SELECT v_recipient, t.id, true, true, '22:00', '08:00'
    FROM public.notification_types t
    WHERE t.tenant_id = p_tenant AND t.name = 'task_decision_request'
    ON CONFLICT (user_id, notification_type_id) DO UPDATE
      SET quiet_hours_start = '22:00', quiet_hours_end = '08:00';

    v_quiet_blocked := NOT public.decision_push_allowed(
      v_recipient, p_tenant, 'task_decision_request', timestamptz '2026-11-28 23:00:00+01');
    v_quiet_open := public.decision_push_allowed(
      v_recipient, p_tenant, 'task_decision_request', timestamptz '2026-11-28 12:00:00+01');
    v_urgent_allowed := public.decision_push_allowed(
      v_recipient, p_tenant, 'task_decision_withdrawn', timestamptz '2026-11-28 23:00:00+01');

    -- aus: Friständerung geht trotzdem sofort durch.
    INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
    VALUES (v_recipient, p_tenant, 'off')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET delivery_mode = 'off', updated_at = now();
    UPDATE public.task_decisions
    SET response_deadline = now() + interval '2 days'
    WHERE id = v_decision;

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_deadline_changed'
        AND n.data->>'decision_id' = v_decision::text
    ) INTO v_urgent_created;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX030';
  EXCEPTION
    WHEN SQLSTATE 'ZX030' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_digest_ok AND v_off_suppressed AND v_quiet_blocked AND v_quiet_open
      AND v_urgent_allowed AND v_urgent_created,
    'checks', jsonb_build_object(
      'digest_mode_bundled', v_digest_ok,
      'off_suppressed', v_off_suppressed,
      'quiet_hours_block_push', v_quiet_blocked,
      'quiet_hours_end_allows_push', v_quiet_open,
      'urgent_bypasses_quiet_hours', v_urgent_allowed,
      'urgent_created_despite_off', v_urgent_created
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_delivery_preference_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_delivery_preference_selftest(uuid) TO authenticated;
