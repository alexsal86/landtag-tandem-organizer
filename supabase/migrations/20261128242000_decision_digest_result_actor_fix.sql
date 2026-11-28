-- Ergebniseinträge im Digest haben keine Person. Kommentar- und Reaktionseinträge
-- behalten die handelnde Person. Die UI ignoriert zusätzlich alte actor_name-Werte
-- bei task_decision_completed.

CREATE OR REPLACE FUNCTION public.flush_decision_notification_digests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_group RECORD;
  v_digest uuid;
  v_created integer := 0;
  v_title text;
  v_message text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('decision_notification_digest_flush'));

  FOR v_group IN
    SELECT n.tenant_id,
           n.user_id,
           n.data->>'decision_id' AS decision_id,
           max(coalesce(n.data->>'decision_title', '')) AS decision_title,
           count(*)::integer AS item_count,
           count(*) FILTER (WHERE t.name = 'task_decision_completed')::integer AS result_count,
           count(*) FILTER (WHERE t.name <> 'task_decision_completed')::integer AS other_count,
           array_agg(n.id) AS notification_ids,
           jsonb_agg(
             jsonb_build_object(
               'type', t.name,
               'notification_id', n.id,
               'actor_name', CASE WHEN t.name = 'task_decision_completed' THEN NULL
                 ELSE coalesce(nullif(n.data->>'actor_name', ''), cp.display_name, 'Ein Teammitglied') END,
               'comment_id', n.data->>'comment_id',
               'emoji', n.data->>'emoji',
               'excerpt', left(c.content, 160),
               'created_at', n.created_at
             ) ORDER BY n.created_at
           ) AS digest_items,
           CASE WHEN bool_or(n.priority IN ('high', 'urgent')) THEN 'high' ELSE 'medium' END AS digest_priority,
           s.decision_digest_minutes
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    LEFT JOIN public.task_decisions td ON td.id::text = n.data->>'decision_id'
    LEFT JOIN public.task_decision_comments c ON c.id::text = n.data->>'comment_id'
    LEFT JOIN public.profiles cp ON cp.user_id = c.user_id AND cp.tenant_id = n.tenant_id
    LEFT JOIN public.tenant_notification_settings s ON s.tenant_id = n.tenant_id
    WHERE t.name IN (
        'task_decision_request',
        'task_decision_comment_received',
        'task_decision_comment_reply',
        'task_decision_comment_reaction_received',
        'task_decision_completed'
      )
      AND n.data->>'decision_id' IS NOT NULL
      AND NOT n.is_read
      AND coalesce(n.data->>'superseded', 'false') <> 'true'
      AND EXISTS (
        SELECT 1 FROM public.decision_notification_preferences p
        WHERE p.user_id = n.user_id
          AND p.tenant_id = n.tenant_id
          AND p.delivery_mode = 'digest'
      )
      AND (t.name <> 'task_decision_completed' OR td.created_by IS DISTINCT FROM n.user_id)
      AND n.created_at <= now() - make_interval(mins => coalesce(s.decision_digest_minutes, 15))
    GROUP BY n.tenant_id, n.user_id, n.data->>'decision_id', s.decision_digest_minutes
  LOOP
    v_title := CASE
      WHEN v_group.result_count > 0 AND v_group.other_count > 0
        THEN 'Ergebnis und ' || v_group.other_count || ' neue Meldungen zu einer Entscheidung'
      WHEN v_group.result_count > 0
        THEN 'Ergebnis zu einer Entscheidung verfügbar'
      WHEN v_group.item_count = 1
        THEN 'Neue Meldung zu einer Entscheidung'
      ELSE v_group.item_count || ' neue Meldungen zu einer Entscheidung'
    END;

    v_message := CASE
      WHEN v_group.result_count > 0 AND v_group.other_count > 0
        THEN left('Das Ergebnis ist verfügbar; dazu ' || v_group.other_count
          || ' neue Kommentare oder Reaktionen zu "'
          || coalesce(nullif(v_group.decision_title, ''), 'Entscheidung') || '".', 240)
      WHEN v_group.result_count > 0
        THEN left('Alle Antworten für "' || coalesce(nullif(v_group.decision_title, ''), 'Entscheidung')
          || '" sind eingegangen.', 240)
      ELSE left(v_group.item_count || ' neue Meldungen zu "'
        || coalesce(nullif(v_group.decision_title, ''), 'Entscheidung') || '".', 240)
    END;

    v_digest := public.create_notification(
      v_group.user_id,
      'task_decision_digest',
      v_title,
      v_message,
      jsonb_build_object(
        'decision_id', v_group.decision_id,
        'decision_title', v_group.decision_title,
        'tenant_id', v_group.tenant_id,
        'digest', true,
        'count', v_group.item_count,
        'result_count', v_group.result_count,
        'has_result', v_group.result_count > 0,
        'notification_ids', to_jsonb(v_group.notification_ids),
        'digest_items', v_group.digest_items
      ),
      v_group.digest_priority,
      v_group.tenant_id
    );

    UPDATE public.notifications
    SET is_read = true,
        read_at = now(),
        data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
          'superseded', true,
          'digest_id', v_digest
        )
    WHERE id = ANY(v_group.notification_ids);

    IF v_digest IS NOT NULL THEN
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN v_created;
END;
$$;
REVOKE ALL ON FUNCTION public.flush_decision_notification_digests() FROM PUBLIC, anon, authenticated;
