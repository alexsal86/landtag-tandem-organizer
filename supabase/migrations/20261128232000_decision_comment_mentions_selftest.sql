INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
VALUES ('task_decision_mention', 'decisions')
ON CONFLICT (notification_type_name, navigation_context) DO NOTHING;

CREATE OR REPLACE FUNCTION public.decision_mention_notification_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_name text;
  v_decision uuid;
  v_comment uuid;
  v_off_created boolean := false;
  v_no_generic boolean := false;
  v_no_digest boolean := false;
  v_digest_count integer;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT p.user_id, p.display_name INTO v_recipient, v_name
  FROM public.profiles p
  WHERE p.tenant_id = p_tenant AND p.user_id <> v_actor
    AND nullif(btrim(p.display_name), '') IS NOT NULL
  ORDER BY p.user_id LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite Person mit Anzeigename im Büro – Erwähnung nicht prüfbar.');
  END IF;

  BEGIN
    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Erwähnung', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient);

    -- "aus" darf eine direkte Erwähnung nicht verschlucken.
    INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
    VALUES (v_recipient, p_tenant, 'off')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET delivery_mode = 'off', updated_at = now();

    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_decision, v_actor, 'Hallo @' || v_name || ', bitte kurz prüfen.')
    RETURNING id INTO v_comment;

    SELECT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_mention'
        AND n.data->>'comment_id' = v_comment::text
        AND n.data->>'mention' = 'true'
    ) INTO v_off_created;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_comment_received'
        AND n.data->>'comment_id' = v_comment::text
    ) INTO v_no_generic;

    -- "gebündelt" darf die Erwähnung nicht in den Digest ziehen.
    INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
    VALUES (v_recipient, p_tenant, 'digest')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET delivery_mode = 'digest', updated_at = now();

    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_decision, v_actor, '@' || v_name || ' bitte übernehmen.')
    RETURNING id INTO v_comment;

    UPDATE public.notifications
    SET created_at = now() - interval '30 minutes'
    WHERE user_id = v_recipient AND tenant_id = p_tenant
      AND data->>'decision_id' = v_decision::text
      AND notification_type_id IN (
        SELECT t.id FROM public.notification_types t
        WHERE t.tenant_id = p_tenant AND t.name = 'task_decision_mention'
      );

    v_digest_count := public.flush_decision_notification_digests();

    SELECT NOT EXISTS (
      SELECT 1 FROM public.notifications n
      JOIN public.notification_types t ON t.id = n.notification_type_id
      WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
        AND t.name = 'task_decision_digest'
        AND n.data->>'decision_id' = v_decision::text
    ) INTO v_no_digest;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX032';
  EXCEPTION
    WHEN SQLSTATE 'ZX032' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_off_created AND v_no_generic AND v_no_digest,
    'checks', jsonb_build_object(
      'mention_created_with_off', v_off_created,
      'no_duplicate_generic_comment', v_no_generic,
      'mention_not_bundled', v_no_digest,
      'digests_flushed', v_digest_count
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_mention_notification_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_mention_notification_selftest(uuid) TO authenticated;
