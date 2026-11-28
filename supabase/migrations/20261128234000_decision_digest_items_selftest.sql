CREATE OR REPLACE FUNCTION public.decision_digest_items_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_recipient uuid;
  v_decision uuid;
  v_participant uuid;
  v_comment uuid;
  v_digest uuid;
  v_items integer := 0;
  v_comment_item boolean := false;
  v_reaction_item boolean := false;
  v_result_item boolean := false;
  v_deep_link boolean := false;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(p.display_name, 'Ein Teammitglied') INTO v_actor_name
  FROM public.profiles p WHERE p.user_id = v_actor AND p.tenant_id = p_tenant LIMIT 1;

  SELECT m.user_id INTO v_recipient
  FROM public.user_tenant_memberships m
  WHERE m.tenant_id = p_tenant AND m.user_id <> v_actor AND m.is_active
  ORDER BY m.user_id LIMIT 1;

  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Digest-Inhalt nicht prüfbar.');
  END IF;

  BEGIN
    INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
    VALUES (v_recipient, p_tenant, 'digest')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET delivery_mode = 'digest', updated_at = now();

    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Digest-Inhalt', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient) RETURNING id INTO v_participant;

    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_decision, v_actor, '[SELFTEST] Kommentar mit Inhalt')
    RETURNING id INTO v_comment;

    INSERT INTO public.task_decision_comment_reactions (comment_id, user_id, emoji)
    VALUES (v_comment, v_actor, '👍');

    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type)
    VALUES (v_decision, v_participant, 'yes');

    DELETE FROM public.notifications n
    USING public.notification_types t
    WHERE t.id = n.notification_type_id
      AND n.user_id = v_recipient AND n.tenant_id = p_tenant
      AND t.name = 'task_decision_request'
      AND n.data->>'decision_id' = v_decision::text;

    UPDATE public.notifications
    SET created_at = now() - interval '30 minutes'
    WHERE user_id = v_recipient AND tenant_id = p_tenant
      AND data->>'decision_id' = v_decision::text;

    PERFORM public.flush_decision_notification_digests();

    SELECT n.id INTO v_digest
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    WHERE n.user_id = v_recipient AND n.tenant_id = p_tenant
      AND t.name = 'task_decision_digest'
      AND n.data->>'decision_id' = v_decision::text
    LIMIT 1;

    IF v_digest IS NOT NULL THEN
      SELECT jsonb_array_length(n.data->'digest_items') INTO v_items
      FROM public.notifications n WHERE n.id = v_digest;

      SELECT EXISTS (
        SELECT 1 FROM public.notifications n, jsonb_array_elements(n.data->'digest_items') item
        WHERE n.id = v_digest
          AND item->>'type' = 'task_decision_comment_received'
          AND item->>'actor_name' = v_actor_name
          AND item->>'comment_id' = v_comment::text
          AND item->>'excerpt' LIKE '%Kommentar mit Inhalt%'
      ) INTO v_comment_item;

      SELECT EXISTS (
        SELECT 1 FROM public.notifications n, jsonb_array_elements(n.data->'digest_items') item
        WHERE n.id = v_digest
          AND item->>'type' = 'task_decision_comment_reaction_received'
          AND item->>'emoji' = '👍'
          AND item->>'comment_id' = v_comment::text
      ) INTO v_reaction_item;

      SELECT EXISTS (
        SELECT 1 FROM public.notifications n, jsonb_array_elements(n.data->'digest_items') item
        WHERE n.id = v_digest AND item->>'type' = 'task_decision_completed'
      ) INTO v_result_item;

      SELECT n.data->>'decision_id' = v_decision::text
        AND n.data->>'has_result' = 'true'
      INTO v_deep_link
      FROM public.notifications n WHERE n.id = v_digest;
    END IF;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX034';
  EXCEPTION
    WHEN SQLSTATE 'ZX034' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_items = 3 AND v_comment_item AND v_reaction_item AND v_result_item AND v_deep_link,
    'checks', jsonb_build_object(
      'digest_items', v_items,
      'comment_with_person_and_excerpt', v_comment_item,
      'reaction_with_person_and_emoji', v_reaction_item,
      'result_included', v_result_item,
      'deep_link_decision_id', v_deep_link
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_digest_items_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_digest_items_selftest(uuid) TO authenticated;
