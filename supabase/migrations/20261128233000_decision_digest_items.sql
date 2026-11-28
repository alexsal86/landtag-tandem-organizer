-- Digest-Inhalt für die Aufklapp-Ansicht: jede gebündelte Meldung mit Person,
-- Kommentar-ID/Emoji und Zeitpunkt. Die bestehenden notification_ids bleiben für
-- Rückwärtskompatibilität erhalten.

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
               'actor_name', coalesce(
                 nullif(n.data->>'actor_name', ''),
                 cp.display_name,
                 'Ein Teammitglied'
               ),
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

-- Reaktionsmeldung trägt die reagierende Person im Datenfeld, damit der Digest sie
-- ohne mehrdeutige Zuordnung über comment_id + emoji anzeigen kann.
CREATE OR REPLACE FUNCTION public.notify_decision_comment_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid;
  v_title text;
  v_creator uuid;
  v_decision uuid;
  v_comment_author uuid;
  v_actor text;
  v_recipient uuid;
  v_reaction_minutes integer;
BEGIN
  BEGIN
    SELECT c.decision_id, c.user_id INTO v_decision, v_comment_author
    FROM public.task_decision_comments c WHERE c.id = NEW.comment_id;
    IF v_decision IS NULL THEN RETURN NEW; END IF;

    SELECT td.tenant_id, td.title, td.created_by INTO v_tenant, v_title, v_creator
    FROM public.task_decisions td WHERE td.id = v_decision;
    IF v_tenant IS NULL THEN RETURN NEW; END IF;

    SELECT s.decision_reaction_window_minutes INTO v_reaction_minutes
    FROM public.tenant_notification_settings s WHERE s.tenant_id = v_tenant;
    IF v_reaction_minutes IS NULL THEN v_reaction_minutes := 5; END IF;

    SELECT p.display_name INTO v_actor
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id AND p.tenant_id = v_tenant LIMIT 1;

    FOR v_recipient IN
      SELECT DISTINCT candidate.user_id
      FROM (
        SELECT v_comment_author AS user_id
        UNION SELECT v_creator
        UNION SELECT p.user_id FROM public.task_decision_participants p
        WHERE p.decision_id = v_decision
      ) AS candidate
      WHERE candidate.user_id IS NOT NULL AND candidate.user_id <> NEW.user_id
    LOOP
      IF NOT public.is_tenant_member(v_tenant, v_recipient) THEN CONTINUE; END IF;

      IF EXISTS (
        SELECT 1 FROM public.notifications n
        JOIN public.notification_types t ON t.id = n.notification_type_id
        WHERE n.tenant_id = v_tenant AND n.user_id = v_recipient
          AND t.tenant_id = v_tenant
          AND t.name = 'task_decision_comment_reaction_received'
          AND n.data->>'comment_id' = NEW.comment_id::text
          AND n.data->>'emoji' = NEW.emoji
          AND n.created_at > now() - make_interval(mins => v_reaction_minutes)
      ) THEN CONTINUE; END IF;

      PERFORM public.create_notification(
        v_recipient,
        'task_decision_comment_reaction_received',
        'Neue Reaktion',
        left(coalesce(v_actor, 'Ein Teammitglied') || ' hat mit ' || NEW.emoji || ' reagiert.', 240),
        jsonb_build_object(
          'decision_id', v_decision,
          'decision_title', v_title,
          'comment_id', NEW.comment_id,
          'emoji', NEW.emoji,
          'actor_id', NEW.user_id,
          'actor_name', coalesce(v_actor, 'Ein Teammitglied'),
          'tenant_id', v_tenant
        ),
        'low',
        v_tenant
      );
    END LOOP;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Entscheidungs-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_decision_comment_reaction() FROM PUBLIC, anon, authenticated;
