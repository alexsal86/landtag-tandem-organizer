-- Offene Rückfragen in der Ersteller-Warnung und im Tagesüberblick.
--
-- Eine Rückfrage ist offen, solange die letzte Hauptantwort der Person
-- response_type='question' ist und der Ersteller sie noch nicht beantwortet hat
-- (creator_response leer). Genau diese Bedingung blockiert auch das automatische
-- Archivieren einer Entscheidung. Die Warnung nennt zusätzlich das Alter der
-- ältesten offenen Rückfrage und bittet den Ersteller ausdrücklich um Antwort.
-- Der Tagesüberblick nimmt dafür auch selbst erstellte Entscheidungen mit offenen
-- Rückfragen auf, nicht nur Entscheidungen, in denen die Person abstimmen muss.

CREATE OR REPLACE FUNCTION public.decision_question_age_label(_since timestamptz, _at timestamptz DEFAULT now())
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _since IS NULL THEN NULL
    WHEN _at - _since >= interval '48 hours'
      THEN 'seit ' || floor(extract(epoch FROM (_at - _since)) / 86400)::integer || ' Tagen'
    WHEN _at - _since >= interval '24 hours' THEN 'seit 1 Tag'
    WHEN _at - _since >= interval '2 hours'
      THEN 'seit ' || floor(extract(epoch FROM (_at - _since)) / 3600)::integer || ' Stunden'
    WHEN _at - _since >= interval '1 hour' THEN 'seit 1 Stunde'
    ELSE 'seit wenigen Minuten'
  END;
$$;
REVOKE ALL ON FUNCTION public.decision_question_age_label(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.decision_open_question_stats(_decision_id uuid, _at timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (r.participant_id)
           r.participant_id,
           r.response_type,
           r.creator_response,
           r.created_at
    FROM public.task_decision_responses r
    WHERE r.decision_id = _decision_id
      AND r.parent_response_id IS NULL
    ORDER BY r.participant_id, r.created_at DESC, r.updated_at DESC, r.id DESC
  ), open_questions AS (
    SELECT * FROM latest
    WHERE response_type = 'question'
      AND coalesce(btrim(creator_response), '') = ''
  )
  SELECT jsonb_build_object(
    'open_question_count', count(*)::integer,
    'oldest_question_at', min(created_at),
    'oldest_question_age_hours', CASE
      WHEN count(*) = 0 THEN NULL
      ELSE greatest(0, floor(extract(epoch FROM (_at - min(created_at))) / 3600))::integer
    END,
    'oldest_question_age_label', public.decision_question_age_label(min(created_at), _at)
  )
  FROM open_questions;
$$;
REVOKE ALL ON FUNCTION public.decision_open_question_stats(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_decision_deadline_reminders(_at timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row RECORD;
  v_stage text;
  v_reminder_id uuid;
  v_notification uuid;
  v_created integer := 0;
  v_title text;
  v_message text;
  v_missing_label text;
  v_missing_sentence text;
  v_question_count integer;
  v_question_title text;
  v_question_sentence text;
  v_deadline_sentence text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('decision_deadline_reminder_dispatch'));

  FOR v_row IN
    WITH candidates AS (
      -- Teilnehmende: unverändert 24 h und 2 h vor Ablauf, nur ohne Hauptantwort.
      SELECT d.id AS decision_id,
             d.tenant_id,
             d.title,
             d.response_deadline,
             p.user_id,
             'participant'::text AS recipient_role,
             NULL::integer AS missing_count,
             NULL::jsonb AS question_stats,
             CASE WHEN d.response_deadline <= _at + interval '2 hours' THEN '2h' ELSE '24h' END AS stage
      FROM public.task_decisions d
      JOIN public.task_decision_participants p ON p.decision_id = d.id
      JOIN public.user_tenant_memberships m
        ON m.user_id = p.user_id AND m.tenant_id = d.tenant_id AND m.is_active
      WHERE d.status IN ('active', 'open')
        AND d.response_deadline IS NOT NULL
        AND d.response_deadline > _at
        AND d.response_deadline <= _at + interval '24 hours'
        AND p.user_id <> d.created_by
        AND NOT EXISTS (
          SELECT 1 FROM public.task_decision_responses r
          WHERE r.participant_id = p.id
            AND r.decision_id = d.id
            AND r.parent_response_id IS NULL
        )

      UNION ALL

      -- Ersteller: eine Warnung vor Ablauf und eine nach Überschreitung, solange
      -- Antworten fehlen oder Rückfragen unbeantwortet sind.
      SELECT d.id,
             d.tenant_id,
             d.title,
             d.response_deadline,
             d.created_by,
             'creator',
             m.missing_count,
             q.stats,
             CASE WHEN d.response_deadline <= _at THEN 'creator_overdue' ELSE 'creator_24h' END
      FROM public.task_decisions d
      JOIN LATERAL (
        SELECT count(*)::integer AS missing_count
        FROM public.task_decision_participants p
        WHERE p.decision_id = d.id
          AND p.user_id <> d.created_by
          AND NOT EXISTS (
            SELECT 1 FROM public.task_decision_responses r
            WHERE r.participant_id = p.id
              AND r.decision_id = d.id
              AND r.parent_response_id IS NULL
          )
      ) m ON true
      CROSS JOIN LATERAL (
        SELECT public.decision_open_question_stats(d.id, _at) AS stats
      ) q
      JOIN public.user_tenant_memberships cm
        ON cm.user_id = d.created_by AND cm.tenant_id = d.tenant_id AND cm.is_active
      WHERE d.status IN ('active', 'open')
        AND d.response_deadline IS NOT NULL
        AND d.created_by IS NOT NULL
        AND (
          m.missing_count > 0
          OR (q.stats->>'open_question_count')::integer > 0
        )
        AND (
          (d.response_deadline > _at AND d.response_deadline <= _at + interval '24 hours')
          OR d.response_deadline <= _at
        )
    )
    SELECT c.*
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.decision_deadline_reminders x
      WHERE x.decision_id = c.decision_id
        AND x.user_id = c.user_id
        AND x.stage = c.stage
    )
  LOOP
    v_stage := v_row.stage;

    IF public.decision_quiet_hours_active(v_row.user_id, v_row.tenant_id, 'task_decision_deadline_reminder', _at) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.decision_deadline_reminders (decision_id, user_id, tenant_id, stage, sent_at)
    VALUES (v_row.decision_id, v_row.user_id, v_row.tenant_id, v_stage, _at)
    ON CONFLICT (decision_id, user_id, stage) DO NOTHING
    RETURNING decision_id INTO v_reminder_id;
    IF v_reminder_id IS NULL THEN CONTINUE; END IF;

    IF v_row.recipient_role = 'creator' THEN
      v_missing_label := NULL;
      v_missing_sentence := NULL;
      v_question_title := NULL;
      v_question_sentence := NULL;
      v_question_count := coalesce((v_row.question_stats->>'open_question_count')::integer, 0);

      IF v_row.missing_count > 0 THEN
        v_missing_label := CASE WHEN v_row.missing_count = 1
          THEN '1 Antwort fehlt' ELSE v_row.missing_count || ' Antworten fehlen' END;
        v_missing_sentence := CASE WHEN v_row.missing_count = 1
          THEN 'fehlt noch 1 Antwort' ELSE 'fehlen noch ' || v_row.missing_count || ' Antworten' END;
      END IF;

      IF v_question_count > 0 THEN
        v_question_title := CASE WHEN v_question_count = 1
          THEN '1 offene Rückfrage (' || coalesce(v_row.question_stats->>'oldest_question_age_label', '') || ')'
          ELSE v_question_count || ' offene Rückfragen (älteste '
            || coalesce(v_row.question_stats->>'oldest_question_age_label', '') || ')' END;
        v_question_sentence := CASE WHEN v_question_count = 1
          THEN '1 offene Rückfrage ' || coalesce(v_row.question_stats->>'oldest_question_age_label', '')
            || ' – bitte beantworte sie.'
          ELSE v_question_count || ' offene Rückfragen, älteste '
            || coalesce(v_row.question_stats->>'oldest_question_age_label', '')
            || ' – bitte beantworte sie.' END;
      END IF;

      v_deadline_sentence := CASE WHEN v_stage = 'creator_overdue'
        THEN 'Die Frist ist überschritten.'
        ELSE 'Die Frist endet innerhalb von 24 Stunden.' END;

      v_title := (CASE WHEN v_stage = 'creator_overdue'
          THEN 'Frist überschritten: ' ELSE 'Frist naht: ' END)
        || coalesce(v_missing_label, '')
        || CASE WHEN v_missing_label IS NOT NULL AND v_question_title IS NOT NULL THEN ' und ' ELSE '' END
        || coalesce(v_question_title, '')
        || ' bei "' || v_row.title || '"';

      v_message := concat_ws(' ',
        CASE WHEN v_row.missing_count > 0
          THEN 'Für "' || v_row.title || '" ' || v_missing_sentence || '.' END,
        v_question_sentence,
        v_deadline_sentence
      );

      v_notification := public.create_notification(
        v_row.user_id,
        'task_decision_deadline_reminder',
        v_title,
        left(v_message, 240),
        jsonb_build_object(
          'decision_id', v_row.decision_id,
          'decision_title', v_row.title,
          'response_deadline', v_row.response_deadline,
          'reminder_stage', v_stage,
          'deadline_reminder', true,
          'creator_warning', true,
          'missing_count', v_row.missing_count,
          'open_question_count', v_question_count,
          'oldest_question_at', v_row.question_stats->'oldest_question_at',
          'oldest_question_age_hours', v_row.question_stats->'oldest_question_age_hours',
          'oldest_question_age_label', v_row.question_stats->'oldest_question_age_label',
          'recipient_role', 'creator',
          'tenant_id', v_row.tenant_id
        ),
        CASE WHEN v_stage = 'creator_overdue' THEN 'high' ELSE 'medium' END,
        v_row.tenant_id
      );
    ELSE
      v_title := CASE WHEN v_stage = '2h'
        THEN 'Frist in 2 Stunden: ' || v_row.title
        ELSE 'Frist in 24 Stunden: ' || v_row.title END;
      v_message := CASE WHEN v_stage = '2h'
        THEN 'Die Antwortfrist für "' || v_row.title || '" endet in wenigen Stunden. Bitte antworte jetzt.'
        ELSE 'Die Antwortfrist für "' || v_row.title || '" endet innerhalb von 24 Stunden.' END;

      v_notification := public.create_notification(
        v_row.user_id,
        'task_decision_deadline_reminder',
        v_title,
        left(v_message, 240),
        jsonb_build_object(
          'decision_id', v_row.decision_id,
          'decision_title', v_row.title,
          'response_deadline', v_row.response_deadline,
          'reminder_stage', v_stage,
          'deadline_reminder', true,
          'recipient_role', 'participant',
          'tenant_id', v_row.tenant_id
        ),
        CASE WHEN v_stage = '2h' THEN 'high' ELSE 'medium' END,
        v_row.tenant_id
      );
    END IF;

    IF v_notification IS NULL THEN
      DELETE FROM public.decision_deadline_reminders
      WHERE decision_id = v_row.decision_id AND user_id = v_row.user_id AND stage = v_stage;
      CONTINUE;
    END IF;

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_decision_deadline_reminders(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_decision_daily_digests(_at timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_local timestamp := _at AT TIME ZONE 'Europe/Berlin';
  v_date date := (v_local)::date;
  v_hour integer := extract(hour FROM v_local)::integer;
  v_user RECORD;
  v_count integer;
  v_ids jsonb;
  v_question_count integer;
  v_question_decision_count integer;
  v_creator_ids jsonb;
  v_oldest_question_at timestamptz;
  v_question_age_label text;
  v_question_sentence text;
  v_title text;
  v_message text;
  v_delivery_id uuid;
  v_notification uuid;
  v_created integer := 0;
BEGIN
  -- Morgendliches Fenster; bei Ruhezeiten wird es in der nächsten Stunde erneut
  -- versucht, solange das Fenster offen ist.
  IF v_hour < 6 OR v_hour >= 12 THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('decision_daily_digest_dispatch'));

  FOR v_user IN
    SELECT p.user_id, p.tenant_id
    FROM public.decision_notification_preferences p
    JOIN public.user_tenant_memberships m
      ON m.user_id = p.user_id AND m.tenant_id = p.tenant_id AND m.is_active
    WHERE p.daily_digest_enabled
      AND NOT EXISTS (
        SELECT 1 FROM public.decision_daily_digest_deliveries d
        WHERE d.user_id = p.user_id AND d.tenant_id = p.tenant_id AND d.digest_date = v_date
      )
  LOOP
    IF public.decision_quiet_hours_active(
      v_user.user_id, v_user.tenant_id, 'task_decision_daily_digest', _at
    ) THEN
      CONTINUE;
    END IF;

    WITH relevant AS (
      -- Teilnehmende: offene Entscheidungen ohne eigene Hauptantwort.
      SELECT d.id,
             d.response_deadline,
             d.created_at,
             0 AS open_questions,
             NULL::timestamptz AS oldest_question_at,
             false AS as_creator
      FROM public.task_decisions d
      JOIN public.task_decision_participants p ON p.decision_id = d.id
      WHERE d.tenant_id = v_user.tenant_id
        AND d.status IN ('active', 'open')
        AND p.user_id = v_user.user_id
        AND p.user_id <> d.created_by
        AND NOT EXISTS (
          SELECT 1 FROM public.task_decision_responses r
          WHERE r.participant_id = p.id
            AND r.decision_id = d.id
            AND r.parent_response_id IS NULL
        )

      UNION ALL

      -- Ersteller: eigene Entscheidungen mit unbeantworteten Rückfragen.
      SELECT d.id,
             d.response_deadline,
             d.created_at,
             (q.stats->>'open_question_count')::integer,
             (q.stats->>'oldest_question_at')::timestamptz,
             true
      FROM public.task_decisions d
      CROSS JOIN LATERAL (
        SELECT public.decision_open_question_stats(d.id, _at) AS stats
      ) q
      WHERE d.tenant_id = v_user.tenant_id
        AND d.status IN ('active', 'open')
        AND d.created_by = v_user.user_id
        AND (q.stats->>'open_question_count')::integer > 0
    ), deduped AS (
      SELECT DISTINCT ON (id) *
      FROM relevant
      ORDER BY id, as_creator DESC
    )
    SELECT count(*)::integer,
           jsonb_agg(id ORDER BY response_deadline NULLS LAST, created_at),
           coalesce(sum(open_questions), 0)::integer,
           count(*) FILTER (WHERE open_questions > 0)::integer,
           jsonb_agg(id ORDER BY response_deadline NULLS LAST, created_at) FILTER (WHERE as_creator),
           min(oldest_question_at)
      INTO v_count, v_ids, v_question_count, v_question_decision_count, v_creator_ids, v_oldest_question_at
    FROM deduped;

    IF v_count = 0 THEN CONTINUE; END IF;

    v_question_age_label := public.decision_question_age_label(v_oldest_question_at, _at);
    v_question_sentence := CASE
      WHEN v_question_count = 1
        THEN '1 offene Rückfrage ' || v_question_age_label || ' – bitte beantworte sie.'
      WHEN v_question_count > 1
        THEN v_question_count || ' offene Rückfragen, älteste ' || v_question_age_label
          || ' – bitte beantworte sie.'
      ELSE NULL END;

    v_title := (CASE WHEN v_count = 1 THEN '1 Entscheidung braucht dich'
                     ELSE v_count || ' Entscheidungen brauchen dich' END)
      || CASE WHEN v_question_count > 0 THEN ' – ' || (CASE WHEN v_question_count = 1
           THEN '1 offene Rückfrage' ELSE v_question_count || ' offene Rückfragen' END)
         ELSE '' END;

    v_message := left(
      (CASE
        WHEN v_question_decision_count = v_count AND v_count = 1
          THEN 'Eine von dir erstellte Entscheidung wartet auf deine Antwort.'
        WHEN v_question_decision_count = v_count
          THEN v_count || ' von dir erstellte Entscheidungen warten auf deine Antwort.'
        WHEN v_count = 1 THEN 'Eine offene Entscheidung wartet auf deine Antwort.'
        ELSE v_count || ' offene Entscheidungen warten auf deine Antwort.'
      END)
      || CASE WHEN v_question_sentence IS NOT NULL THEN ' ' || v_question_sentence ELSE '' END,
      240
    );

    INSERT INTO public.decision_daily_digest_deliveries
      (user_id, tenant_id, digest_date, sent_at, decision_count)
    VALUES (v_user.user_id, v_user.tenant_id, v_date, _at, v_count)
    ON CONFLICT (user_id, tenant_id, digest_date) DO NOTHING
    RETURNING user_id INTO v_delivery_id;
    IF v_delivery_id IS NULL THEN CONTINUE; END IF;

    v_notification := public.create_notification(
      v_user.user_id,
      'task_decision_daily_digest',
      v_title,
      v_message,
      jsonb_build_object(
        'daily_digest', true,
        'decision_count', v_count,
        'decision_ids', v_ids,
        'creator_question_decision_ids', coalesce(v_creator_ids, '[]'::jsonb),
        'open_question_count', v_question_count,
        'open_question_decision_count', v_question_decision_count,
        'oldest_question_at', v_oldest_question_at,
        'oldest_question_age_hours', CASE
          WHEN v_oldest_question_at IS NULL THEN NULL
          ELSE greatest(0, floor(extract(epoch FROM (_at - v_oldest_question_at)) / 3600))::integer
        END,
        'oldest_question_age_label', v_question_age_label,
        'tenant_id', v_user.tenant_id
      ),
      'medium',
      v_user.tenant_id
    );

    IF v_notification IS NULL THEN
      DELETE FROM public.decision_daily_digest_deliveries
      WHERE user_id = v_user.user_id AND tenant_id = v_user.tenant_id AND digest_date = v_date;
      CONTINUE;
    END IF;

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_decision_daily_digests(timestamptz) FROM PUBLIC, anon, authenticated;
