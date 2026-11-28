-- Aggregierte Antwortzahlen für die Ergebnis-Meldung und den Digest.
-- Die Zählung nutzt je Teilnehmerin bzw. Teilnehmer die letzte Hauptantwort
-- (parent_response_id IS NULL), damit spätere Änderungen nicht doppelt zählen.
-- Beschriftungen kommen aus den konfigurierten response_options; Standardwerte
-- dienen als Fallback für ältere Entscheidungen.

CREATE OR REPLACE FUNCTION public.decision_response_label(_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _key
    WHEN 'yes' THEN 'Ja'
    WHEN 'no' THEN 'Nein'
    WHEN 'question' THEN 'Rückfrage'
    WHEN 'comment' THEN 'Rückmeldung'
    ELSE _key
  END;
$$;

CREATE OR REPLACE FUNCTION public.decision_result_counts(_decision_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (r.participant_id) r.participant_id, r.response_type
    FROM public.task_decision_responses r
    WHERE r.decision_id = _decision_id
      AND r.parent_response_id IS NULL
    ORDER BY r.participant_id, r.updated_at DESC, r.created_at DESC, r.id DESC
  ), configured AS (
    SELECT x.ord,
           x.option->>'key' AS key,
           coalesce(nullif(x.option->>'label', ''), public.decision_response_label(x.option->>'key')) AS label
    FROM public.task_decisions d
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(d.response_options) = 'array'
           THEN d.response_options ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS x(option, ord)
    WHERE d.id = _decision_id
  ), counts AS (
    SELECT l.response_type AS key, count(*)::integer AS response_count
    FROM latest l
    GROUP BY l.response_type
  ), known AS (
    SELECT c.ord, c.key, c.label, coalesce(ct.response_count, 0) AS response_count
    FROM configured c
    LEFT JOIN counts ct ON ct.key = c.key
  ), extra AS (
    SELECT 1000 + row_number() OVER (ORDER BY ct.key) AS ord,
           ct.key,
           public.decision_response_label(ct.key) AS label,
           ct.response_count
    FROM counts ct
    WHERE NOT EXISTS (SELECT 1 FROM configured c WHERE c.key = ct.key)
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('key', key, 'label', label, 'count', response_count)
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  FROM (SELECT * FROM known UNION ALL SELECT * FROM extra) summary
  WHERE response_count > 0;
$$;
REVOKE ALL ON FUNCTION public.decision_result_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_result_counts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decision_result_summary(_decision_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(
    string_agg((item->>'count') || ' ' || (item->>'label'), ' · ' ORDER BY ord),
    'Keine Antworten'
  )
  FROM jsonb_array_elements(public.decision_result_counts(_decision_id))
    WITH ORDINALITY AS x(item, ord)
  WHERE (item->>'count')::integer > 0;
$$;
REVOKE ALL ON FUNCTION public.decision_result_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_result_summary(uuid) TO authenticated;

-- Ergänzt jede Ergebnis-Meldung vor dem Insert um Zusammenfassung und Rohzahlen.
CREATE OR REPLACE FUNCTION public.enrich_decision_result_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_type_name text;
  v_decision_id uuid;
  v_summary text;
  v_counts jsonb;
BEGIN
  SELECT nt.name INTO v_type_name
  FROM public.notification_types nt
  WHERE nt.id = NEW.notification_type_id;

  IF v_type_name <> 'task_decision_completed' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_decision_id := nullif(NEW.data->>'decision_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_decision_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_summary := public.decision_result_summary(v_decision_id);
  v_counts := public.decision_result_counts(v_decision_id);

  IF v_summary IS NOT NULL AND v_summary <> 'Keine Antworten' THEN
    NEW.data := coalesce(NEW.data, '{}'::jsonb) || jsonb_build_object(
      'result_summary', v_summary,
      'result_counts', v_counts
    );
    NEW.message := left(
      regexp_replace(NEW.message, '\.\s*$', '') || ': ' || v_summary || '.',
      240
    );
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enrich_decision_result_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enrich_decision_result_notification ON public.notifications;
CREATE TRIGGER enrich_decision_result_notification
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enrich_decision_result_notification();

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
  v_result_summary text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('decision_notification_digest_flush'));

  FOR v_group IN
    SELECT n.tenant_id,
           n.user_id,
           n.data->>'decision_id' AS decision_id,
           max(coalesce(n.data->>'decision_title', '')) AS decision_title,
           max(CASE WHEN t.name = 'task_decision_completed' THEN coalesce(
             nullif(n.data->>'result_summary', ''),
             nullif(public.decision_result_summary(td.id), 'Keine Antworten')
           ) END) AS result_summary,
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
               'result_summary', CASE WHEN t.name = 'task_decision_completed' THEN
                 coalesce(
                   nullif(n.data->>'result_summary', ''),
                   nullif(public.decision_result_summary(td.id), 'Keine Antworten')
                 )
               ELSE NULL END,
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
    v_result_summary := nullif(v_group.result_summary, '');

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
        THEN left('Das Ergebnis' || coalesce(': ' || v_result_summary, '')
          || ' ist verfügbar; dazu ' || v_group.other_count
          || ' neue Kommentare oder Reaktionen zu "'
          || coalesce(nullif(v_group.decision_title, ''), 'Entscheidung') || '".', 240)
      WHEN v_group.result_count > 0
        THEN left('Alle Antworten für "' || coalesce(nullif(v_group.decision_title, ''), 'Entscheidung')
          || '" sind eingegangen' || coalesce(': ' || v_result_summary, '') || '.', 240)
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
        'result_summary', v_result_summary,
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
