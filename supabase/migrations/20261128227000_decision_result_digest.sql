-- Ergebnismeldungen für Teilnehmende in den Digest aufnehmen.
--
-- Frist- und Rückzugsmeldungen bleiben unverändert sofort: Sie sind zeit- bzw.
-- statuskritisch. Der Ersteller erhält sein Ergebnis weiterhin sofort; gebündelt wird
-- nur die Ergebnismeldung an Teilnehmende.
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
           CASE WHEN bool_or(n.priority IN ('high', 'urgent')) THEN 'high' ELSE 'medium' END AS digest_priority,
           s.decision_digest_minutes
    FROM public.notifications n
    JOIN public.notification_types t ON t.id = n.notification_type_id
    LEFT JOIN public.task_decisions td ON td.id::text = n.data->>'decision_id'
    LEFT JOIN public.tenant_notification_settings s ON s.tenant_id = n.tenant_id
    WHERE t.name IN (
        'task_decision_comment_received',
        'task_decision_comment_reply',
        'task_decision_comment_reaction_received',
        'task_decision_completed'
      )
      AND n.data->>'decision_id' IS NOT NULL
      AND NOT n.is_read
      AND coalesce(n.data->>'superseded', 'false') <> 'true'
      -- Ergebnismeldungen nur für Teilnehmende, nie für den Ersteller.
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
      ELSE left(v_group.item_count || ' neue Kommentare oder Reaktionen zu "'
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
        'notification_ids', to_jsonb(v_group.notification_ids)
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

-- Push nur für den Digest: Ergebnismeldungen an Teilnehmende werden gebündelt,
-- die Ergebnis-Meldung an den Ersteller bleibt ein eigener Push.
CREATE OR REPLACE FUNCTION public.handle_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_settings RECORD;
  v_type_name text;
  v_creator uuid;
BEGIN
  SELECT nt.name INTO v_type_name
  FROM public.notification_types nt
  WHERE nt.id = NEW.notification_type_id;

  IF v_type_name IN (
    'task_decision_comment_received',
    'task_decision_comment_reply',
    'task_decision_comment_reaction_received'
  ) THEN
    RETURN NEW;
  END IF;

  IF v_type_name = 'task_decision_completed' THEN
    SELECT td.created_by INTO v_creator
    FROM public.task_decisions td
    WHERE td.id::text = NEW.data->>'decision_id';

    IF v_creator IS DISTINCT FROM NEW.user_id THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT uns.push_enabled, uns.is_enabled
  INTO user_settings
  FROM public.user_notification_settings uns
  WHERE uns.user_id = NEW.user_id
    AND uns.notification_type_id = NEW.notification_type_id;

  IF user_settings.push_enabled = true AND user_settings.is_enabled = true THEN
    PERFORM net.http_post(
      url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'sub'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'message', NEW.message,
        'priority', NEW.priority,
        'data', NEW.data
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
