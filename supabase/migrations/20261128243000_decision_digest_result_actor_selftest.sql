CREATE OR REPLACE FUNCTION public.decision_digest_result_actor_selftest(p_tenant uuid)
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
  v_result_without_person boolean := false;
  v_comment_with_person boolean := false;
  v_reaction_with_person boolean := false;
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
    RETURN jsonb_build_object('ok', true, 'skipped', 'Keine zweite aktive Person im Büro – Digest-Personen nicht prüfbar.');
  END IF;

  BEGIN
    INSERT INTO public.decision_notification_preferences (user_id, tenant_id, delivery_mode)
    VALUES (v_recipient, p_tenant, 'digest')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET delivery_mode = 'digest', updated_at = now();

    INSERT INTO public.task_decisions (title, description, created_by, tenant_id)
    VALUES ('[SELFTEST] Digest-Personen', '[SELFTEST]', v_actor, p_tenant)
    RETURNING id INTO v_decision;
    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_recipient) RETURNING id INTO v_participant;

    INSERT INTO public.task_decision_comments (decision_id, user_id, content)
    VALUES (v_decision, v_actor, '[SELFTEST] Kommentar mit Person')
    RETURNING id INTO v_comment;

    INSERT INTO public.task_decision_comment_reactions (comment_id, user_id, emoji)
    VALUES (v_comment, v_actor, '👍');

    INSERT INTO public.task_decision_responses (decision_id, participant_id, response_type)
    VALUES (v_decision, v_participant, 'yes');

    -- Anfrage nicht mitbündeln, damit genau die drei Zielmeldungen geprüft werden.
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
      SELECT EXISTS (
        SELECT 1 FROM public.notifications n, jsonb_array_elements(n.data->'digest_items') item
        WHERE n.id = v_digest
          AND item->>'type' = 'task_decision_completed'
          AND item->>'actor_name' IS NULL
      ) INTO v_result_without_person;

      SELECT EXISTS (
        SELECT 1 FROM public.notifications n, jsonb_array_elements(n.data->'digest_items') item
        WHERE n.id = v_digest
          AND item->>'type' = 'task_decision_comment_received'
          AND item->>'actor_name' = v_actor_name
      ) INTO v_comment_with_person;

      SELECT EXISTS (
        SELECT 1 FROM public.notifications n, jsonb_array_elements(n.data->'digest_items') item
        WHERE n.id = v_digest
          AND item->>'type' = 'task_decision_comment_reaction_received'
          AND item->>'actor_name' = v_actor_name
      ) INTO v_reaction_with_person;
    END IF;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX042';
  EXCEPTION
    WHEN SQLSTATE 'ZX042' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_result_without_person AND v_comment_with_person AND v_reaction_with_person,
    'checks', jsonb_build_object(
      'result_without_person', v_result_without_person,
      'comment_keeps_person', v_comment_with_person,
      'reaction_keeps_person', v_reaction_with_person
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.decision_digest_result_actor_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_digest_result_actor_selftest(uuid) TO authenticated;
