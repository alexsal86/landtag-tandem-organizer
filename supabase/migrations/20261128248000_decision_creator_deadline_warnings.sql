-- Fristwarnungen für den Ersteller einer Entscheidung.
--
-- Teilnehmende werden weiterhin 24 h und 2 h vor Ablauf erinnert. Zusätzlich erhält
-- der Ersteller eine Warnung, sobald die Frist innerhalb von 24 Stunden endet, und
-- genau einmal, wenn sie überschritten ist. Beide Warnungen nennen die Anzahl der
-- Teilnehmenden, deren Hauptantwort noch fehlt. Sind alle Antworten da, entfällt die
-- Warnung. Die Warnung nutzt denselben Typ wie die Teilnehmer-Erinnerung, trägt aber
-- creator_warning=true, damit die Oberfläche keine Schnellantworten anbietet.

ALTER TABLE public.decision_deadline_reminders
  DROP CONSTRAINT IF EXISTS decision_deadline_reminders_stage_check;
ALTER TABLE public.decision_deadline_reminders
  ADD CONSTRAINT decision_deadline_reminders_stage_check
  CHECK (stage IN ('24h', '2h', 'creator_24h', 'creator_overdue'));

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

      -- Ersteller: eine Warnung vor Ablauf und eine nach Überschreitung, jeweils
      -- nur solange mindestens eine Hauptantwort fehlt.
      SELECT d.id,
             d.tenant_id,
             d.title,
             d.response_deadline,
             d.created_by,
             'creator',
             m.missing_count,
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
      JOIN public.user_tenant_memberships cm
        ON cm.user_id = d.created_by AND cm.tenant_id = d.tenant_id AND cm.is_active
      WHERE d.status IN ('active', 'open')
        AND d.response_deadline IS NOT NULL
        AND d.created_by IS NOT NULL
        AND m.missing_count > 0
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
      v_missing_label := CASE WHEN v_row.missing_count = 1
        THEN '1 Antwort fehlt' ELSE v_row.missing_count || ' Antworten fehlen' END;
      v_missing_sentence := CASE WHEN v_row.missing_count = 1
        THEN 'fehlt noch 1 Antwort' ELSE 'fehlen noch ' || v_row.missing_count || ' Antworten' END;

      v_title := CASE WHEN v_stage = 'creator_overdue'
        THEN 'Frist überschritten: ' || v_missing_label || ' bei "' || v_row.title || '"'
        ELSE 'Frist naht: ' || v_missing_label || ' bei "' || v_row.title || '"' END;
      v_message := CASE WHEN v_stage = 'creator_overdue'
        THEN 'Für "' || v_row.title || '" ' || v_missing_sentence || '. Die Frist ist überschritten.'
        ELSE 'Für "' || v_row.title || '" ' || v_missing_sentence || '. Die Frist endet innerhalb von 24 Stunden.' END;

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
