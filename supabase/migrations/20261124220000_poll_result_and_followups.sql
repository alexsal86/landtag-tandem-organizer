-- Terminabstimmung mit Ergebnis: Gewinner-Slot wird ein Termin, offene Antworten
-- werden automatisch nachgefasst (Versand über die Edge Function send-poll-followups).

-- 1) Ergebnis der Abstimmung und Nachfass-Zustand
ALTER TABLE public.appointment_polls
  ADD COLUMN IF NOT EXISTS confirmed_slot_id uuid REFERENCES public.poll_time_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS followup_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_followup_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_appointment_polls_followup_due
  ON public.appointment_polls (last_followup_at, created_at)
  WHERE status = 'active';

-- Indizes für Frei/Gebucht und Nachfassen: bisher gab es auf den Poll-Tabellen
-- keinen Index, appointments deckte nur (tenant_id, start_time) ab.
CREATE INDEX IF NOT EXISTS idx_appointments_user_start
  ON public.appointments (user_id, start_time);

CREATE INDEX IF NOT EXISTS idx_poll_participants_poll_email
  ON public.poll_participants (poll_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_poll_responses_participant
  ON public.poll_responses (participant_id);

-- 2) Nachfass-Protokoll je Teilnehmer und Versuch
ALTER TABLE public.poll_notifications
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_poll_notifications_pending
  ON public.poll_notifications (notification_type, is_sent)
  WHERE is_sent = false;

-- Eigener Benachrichtigungstyp je Mandant (bestehender Composite-Constraint).
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id, 'poll_follow_up', 'Terminabstimmung – Erinnerung',
       'Automatische Erinnerung an offene Antworten', 'appointments', true
FROM public.tenants t
WHERE true
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Neue Mandanten erhalten den Erinnerungstyp sofort, damit In-App-Erinnerungen
-- nicht stillschweigend entfallen (create_notification ohne Typ => NULL).
CREATE OR REPLACE FUNCTION public.seed_poll_notification_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id, 'poll_follow_up', 'Terminabstimmung – Erinnerung',
          'Automatische Erinnerung an offene Antworten', 'appointments', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_poll_notification_types ON public.tenants;
CREATE TRIGGER seed_poll_notification_types
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_poll_notification_types();

REVOKE ALL ON FUNCTION public.seed_poll_notification_types() FROM PUBLIC, anon, authenticated;

-- 3) Interne Teilnehmer über die E-Mail-Adresse mit ihrem Konto verknüpfen,
--    damit Erinnerungen als Benachrichtigung ankommen.
CREATE OR REPLACE FUNCTION public.link_poll_participant_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Externe Teilnehmende bleiben ohne Konto, damit sie weiterhin per E-Mail erinnert werden.
  IF NEW.user_id IS NOT NULL OR NEW.is_external THEN
    RETURN NEW;
  END IF;

  SELECT ap.tenant_id INTO v_tenant_id
  FROM public.appointment_polls ap
  WHERE ap.id = NEW.poll_id;

  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.id INTO NEW.user_id
  FROM auth.users u
  JOIN public.user_tenant_memberships m
    ON m.user_id = u.id AND m.tenant_id = v_tenant_id AND m.is_active
  WHERE lower(u.email) = lower(NEW.email)
  LIMIT 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_poll_participant_user ON public.poll_participants;
CREATE TRIGGER link_poll_participant_user
  BEFORE INSERT OR UPDATE OF email, user_id ON public.poll_participants
  FOR EACH ROW EXECUTE FUNCTION public.link_poll_participant_user();

REVOKE ALL ON FUNCTION public.link_poll_participant_user() FROM PUBLIC, anon, authenticated;

UPDATE public.poll_participants p
SET user_id = matched.user_id
FROM (
  SELECT pp.id, min(u.id) AS user_id
  FROM public.poll_participants pp
  JOIN public.appointment_polls ap ON ap.id = pp.poll_id
  JOIN public.user_tenant_memberships m
    ON m.tenant_id = ap.tenant_id AND m.is_active
  JOIN auth.users u
    ON u.id = m.user_id AND lower(u.email) = lower(pp.email)
  WHERE pp.user_id IS NULL
  GROUP BY pp.id
) matched
WHERE p.id = matched.id;

-- 4) Frei/Gebucht der eingeladenen Teilnehmer für einen Zeitraum.
--    Liefert ausschließlich belegte Zeiten (keine Termin-Details) und nur für
--    Mitglieder des aufrufenden Mandanten.
CREATE OR REPLACE FUNCTION public.get_poll_availability(
  _tenant_id uuid,
  _emails text[],
  _from timestamptz DEFAULT now(),
  _to timestamptz DEFAULT (now() + interval '14 days')
)
RETURNS TABLE (email text, busy_start timestamptz, busy_end timestamptz, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_emails text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Nicht authentifiziert';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.user_id = auth.uid() AND m.tenant_id = _tenant_id AND m.is_active
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Kein Zugriff auf diesen Mandanten';
  END IF;

  IF _to <= _from THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ungültiger Zeitraum';
  END IF;

  IF _to - _from > interval '90 days' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Zeitraum ist zu groß';
  END IF;

  v_emails := ARRAY(
    SELECT DISTINCT lower(btrim(e))
    FROM unnest(coalesce(_emails, ARRAY[]::text[])) AS e
    WHERE btrim(e) <> ''
  );

  IF coalesce(array_length(v_emails, 1), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT DISTINCT u.id AS user_id, lower(u.email) AS email
    FROM auth.users u
    JOIN public.user_tenant_memberships m
      ON m.user_id = u.id AND m.tenant_id = _tenant_id AND m.is_active
    WHERE lower(u.email) = ANY (v_emails)
  )
  -- Jeder auflösbare Teilnehmer erscheint mindestens einmal (auch ohne Belegung),
  -- damit die UI bekannte, freie Kalender von unbekannten unterscheiden kann.
  SELECT m.email, NULL::timestamptz, NULL::timestamptz, 'keine_belegung'::text
  FROM members m

  UNION ALL

  SELECT m.email, a.start_time, a.end_time, 'termin'::text
  FROM members m
  JOIN public.appointments a
    ON a.user_id = m.user_id AND a.tenant_id = _tenant_id
  WHERE a.start_time < _to AND a.end_time > _from
    AND coalesce(lower(a.status), '') NOT IN ('cancelled', 'canceled', 'abgesagt')

  UNION ALL

  SELECT m.email, e.start_time, e.end_time, 'externer_kalender'::text
  FROM members m
  JOIN public.external_calendars c
    ON c.user_id = m.user_id AND c.tenant_id = _tenant_id
  JOIN public.external_events e ON e.external_calendar_id = c.id
  WHERE e.start_time < _to AND e.end_time > _from

  UNION ALL

  SELECT m.email,
         (lr.start_date::timestamp AT TIME ZONE 'Europe/Berlin'),
         ((lr.end_date + 1)::timestamp AT TIME ZONE 'Europe/Berlin'),
         'abwesenheit'::text
  FROM members m
  JOIN public.leave_requests lr ON lr.user_id = m.user_id
  WHERE lower(lr.status::text) NOT IN ('rejected', 'cancelled')
    AND lr.start_date <= (_to AT TIME ZONE 'Europe/Berlin')::date
    AND lr.end_date >= (_from AT TIME ZONE 'Europe/Berlin')::date;
END;
$$;

REVOKE ALL ON FUNCTION public.get_poll_availability(uuid, text[], timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_poll_availability(uuid, text[], timestamptz, timestamptz) TO authenticated;

-- 5) Ein-Klick-Übernahme des Gewinner-Slots in einen Termin.
--    Idempotent: ein bereits übernommener Slot wird unverändert zurückgegeben.
CREATE OR REPLACE FUNCTION public.confirm_poll_winner(_poll_id uuid, _slot_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_poll public.appointment_polls;
  v_slot public.poll_time_slots;
  v_tenant_id uuid;
  v_appointment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Nicht authentifiziert';
  END IF;

  SELECT * INTO v_poll
  FROM public.appointment_polls
  WHERE id = _poll_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Terminabstimmung nicht gefunden';
  END IF;

  IF v_poll.user_id <> auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Nur die erstellende Person darf den Termin übernehmen';
  END IF;

  IF v_poll.confirmed_appointment_id IS NOT NULL THEN
    RETURN v_poll.confirmed_appointment_id;
  END IF;

  SELECT * INTO v_slot
  FROM public.poll_time_slots
  WHERE id = _slot_id AND poll_id = _poll_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Zeitslot gehört nicht zu dieser Abstimmung';
  END IF;

  v_tenant_id := v_poll.tenant_id;
  IF v_tenant_id IS NULL THEN
    SELECT p.tenant_id INTO v_tenant_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  END IF;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Kein Mandant für den Termin gefunden';
  END IF;

  INSERT INTO public.appointments (
    user_id, tenant_id, poll_id, title, description,
    start_time, end_time, category, status, priority
  ) VALUES (
    v_poll.user_id, v_tenant_id, v_poll.id,
    coalesce(nullif(btrim(v_poll.title), ''), 'Abgestimmter Termin'),
    v_poll.description,
    v_slot.start_time, v_slot.end_time,
    'meeting', 'confirmed', 'high'
  )
  RETURNING id INTO v_appointment_id;

  UPDATE public.appointment_polls
  SET status = 'completed',
      confirmed_slot_id = v_slot.id,
      confirmed_appointment_id = v_appointment_id,
      updated_at = now()
  WHERE id = v_poll.id;

  PERFORM public.create_notification(
    v_poll.user_id,
    'appointment_reminder',
    'Termin aus Abstimmung übernommen',
    'Der abgestimmte Termin "' || v_poll.title || '" wurde im Kalender angelegt.',
    jsonb_build_object('poll_id', v_poll.id, 'appointment_id', v_appointment_id),
    'medium',
    v_tenant_id
  );

  RETURN v_appointment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_poll_winner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_poll_winner(uuid, uuid) TO authenticated;

-- Eine Abstimmung darf höchstens einen Termin besitzen. Der Index wird nur
-- angelegt, wenn keine Altlast-Duplikate existieren; sonst bleibt die Sperre
-- aus und der Hinweis nennt die Zahl der betroffenen Abstimmungen (nichts wird
-- automatisch gelöscht).
DO $$
DECLARE
  v_duplicate_polls integer;
BEGIN
  SELECT count(*) INTO v_duplicate_polls
  FROM (
    SELECT a.poll_id
    FROM public.appointments a
    WHERE a.poll_id IS NOT NULL
    GROUP BY a.poll_id
    HAVING count(*) > 1
  ) duplicates;

  IF v_duplicate_polls > 0 THEN
    RAISE NOTICE 'Terminabstimmung: % Abstimmungen haben mehrere Termine; appointments_poll_id_unique wird nicht angelegt, bitte zuerst bereinigen.', v_duplicate_polls;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS appointments_poll_id_unique
      ON public.appointments (poll_id)
      WHERE poll_id IS NOT NULL;
  END IF;
END $$;

-- 6) Zustands-Claim für das Nachfassen: nur ein Lauf darf einen Versuch
--    verbuchen. Offene Teilnehmende erhalten dabei ihre Benachrichtigung; für
--    externe Teilnehmende entsteht ein offener Versandauftrag in
--    poll_notifications (Versand durch send-poll-followups).
CREATE OR REPLACE FUNCTION public.record_poll_followup(_poll_id uuid, _expected_attempt integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_poll public.appointment_polls;
  v_participant record;
BEGIN
  UPDATE public.appointment_polls p
  SET followup_count = p.followup_count + 1,
      last_followup_at = now(),
      updated_at = now()
  WHERE p.id = _poll_id
    AND p.status = 'active'
    AND p.followup_count = greatest(coalesce(_expected_attempt, 0), 0)
  RETURNING * INTO v_poll;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  FOR v_participant IN
    SELECT pp.id, pp.email, pp.user_id, pp.is_external
    FROM public.poll_participants pp
    WHERE pp.poll_id = _poll_id
      AND NOT EXISTS (
        SELECT 1 FROM public.poll_responses pr WHERE pr.participant_id = pp.id
      )
  LOOP
    INSERT INTO public.poll_notifications (
      poll_id, participant_id, notification_type, attempt, is_sent, sent_at
    ) VALUES (
      _poll_id, v_participant.id, 'answer_followup', v_poll.followup_count,
      v_participant.user_id IS NOT NULL AND NOT v_participant.is_external,
      CASE WHEN v_participant.user_id IS NOT NULL AND NOT v_participant.is_external THEN now() ELSE NULL END
    );

    IF v_participant.user_id IS NOT NULL AND NOT v_participant.is_external THEN
      PERFORM public.create_notification(
        v_participant.user_id,
        'poll_follow_up',
        'Erinnerung: Terminabstimmung',
        'Bitte geben Sie Ihre Verfügbarkeit für "' || v_poll.title || '" an.',
        jsonb_build_object('poll_id', _poll_id, 'attempt', v_poll.followup_count),
        'medium',
        v_poll.tenant_id
      );
    END IF;
  END LOOP;

  RETURN v_poll.followup_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_poll_followup(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_poll_followup(uuid, integer) TO service_role;

-- 7) Regelmäßiger Anlauf für die Erinnerungen (Versand in der Edge Function).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-answer-followups') THEN
      PERFORM cron.unschedule('poll-answer-followups');
    END IF;
    PERFORM cron.schedule(
      'poll-answer-followups',
      '*/30 * * * *',
      $job$
      SELECT net.http_post(
        url := 'https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-poll-followups',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce((
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1
          ), '')
        ),
        body := '{}'::jsonb
      );
      $job$
    );
  END IF;
END $$;
