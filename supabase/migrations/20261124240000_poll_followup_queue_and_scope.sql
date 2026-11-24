-- Terminabstimmung: Erinnerungen laufen über eine Versandwarteschlange mit
-- Wiederholungen und eindeutigen Versandschlüsseln. Ein Erinnerungsversuch wird
-- erst verbucht, wenn der Versand abgeschlossen ist; alte offene Aufträge
-- werden unabhängig von ihrem Versuch erneut abgearbeitet. Fällige
-- Erinnerungen werden abgefragt statt einfach die ältesten Abstimmungen zu
-- nehmen. Zusätzlich prüft der Gewinner-RPC die aktive Büromitgliedschaft und
-- Frei/Gebucht filtert Abwesenheiten ausdrücklich über den Mandanten.

-- 1) Warteschlange: ein Versandauftrag je Teilnehmer, Versuch und Typ.
ALTER TABLE public.poll_notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS send_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_error text;

-- Bestehende Aufträge erhalten ihren Schlüssel nach; danach verhindert der
-- Unique-Index doppelte Aufträge für denselben Versuch. Existieren aus alten
-- Läufen echte Dubletten, bekommt nur der älteste Auftrag den Schlüssel – die
-- übrigen bleiben ohne Schlüssel, damit der Index angelegt werden kann und
-- nichts stillschweigend gelöscht wird.
UPDATE public.poll_notifications n
SET dedupe_key = n.poll_id::text || ':' || n.participant_id::text || ':' || n.notification_type || ':' || n.attempt::text
WHERE n.id IN (
  SELECT DISTINCT ON (d.poll_id, d.participant_id, d.notification_type, d.attempt) d.id
  FROM public.poll_notifications d
  WHERE d.dedupe_key IS NULL
  ORDER BY d.poll_id, d.participant_id, d.notification_type, d.attempt, d.created_at, d.id
);

CREATE UNIQUE INDEX IF NOT EXISTS poll_notifications_dedupe_key_unique
  ON public.poll_notifications (dedupe_key);

-- Offene Aufträge werden in Fälligkeitsreihenfolge abgearbeitet, unabhängig
-- davon, zu welchem Erinnerungsversuch sie gehören.
DROP INDEX IF EXISTS public.idx_poll_notifications_pending;
CREATE INDEX IF NOT EXISTS idx_poll_notifications_queue
  ON public.poll_notifications (notification_type, next_attempt_at)
  WHERE is_sent = false;

-- Ein laufender Versand wird auf der Abstimmung markiert, damit zwei parallele
-- Läufe denselben Versuch nicht gleichzeitig senden.
ALTER TABLE public.appointment_polls
  ADD COLUMN IF NOT EXISTS followup_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_claimed_attempt integer;

-- Altbestand: bereits übernommene Termine kennen ihren Slot nachtragen, damit
-- die Oberfläche immer den tatsächlich gespeicherten Slot anzeigen kann.
UPDATE public.appointment_polls p
SET confirmed_slot_id = s.id
FROM public.poll_time_slots s
WHERE p.confirmed_slot_id IS NULL
  AND p.confirmed_appointment_id IS NOT NULL
  AND s.poll_id = p.id
  AND s.start_time = (
    SELECT a.start_time FROM public.appointments a WHERE a.id = p.confirmed_appointment_id
  );

-- 2) Eindeutiger Versandschlüssel (Spiegel der TypeScript-Regel
--    poll_followup_send_key in _shared/pollFollowup.ts).
CREATE OR REPLACE FUNCTION public.poll_followup_send_key(
  _poll_id uuid,
  _participant_id uuid,
  _attempt integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT _poll_id::text || ':' || _participant_id::text || ':answer_followup:' || _attempt::text;
$$;

REVOKE ALL ON FUNCTION public.poll_followup_send_key(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

-- 3) Fällige Erinnerungen: liefert nur Abstimmungen, deren nächste Erinnerung
--    jetzt fällig ist, in Fälligkeitsreihenfolge. Die Regelwerte kommen aus
--    _shared/pollFollowup.ts, damit es nur eine Quelle für die Abstände gibt.
CREATE OR REPLACE FUNCTION public.get_due_poll_followups(
  _limit integer,
  _first_delay_hours integer,
  _repeat_hours integer,
  _max_attempts integer,
  _deadline_window_hours integer,
  _min_gap_hours integer,
  _claim_timeout_minutes integer DEFAULT 15
)
RETURNS TABLE (
  poll_id uuid,
  attempt integer,
  due_at timestamptz,
  open_participants integer,
  open_external integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH open_answers AS (
    SELECT pp.poll_id,
           count(*)::integer AS open_participants,
           count(*) FILTER (WHERE pp.is_external OR pp.user_id IS NULL)::integer AS open_external
    FROM public.poll_participants pp
    WHERE btrim(coalesce(pp.email, '')) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.poll_responses pr WHERE pr.participant_id = pp.id
      )
    GROUP BY pp.poll_id
  ),
  slot_ends AS (
    SELECT s.poll_id, max(s.end_time) AS last_slot_end
    FROM public.poll_time_slots s
    GROUP BY s.poll_id
  ),
  candidates AS (
    SELECT p.id AS candidate_poll_id,
           p.followup_count,
           p.created_at,
           p.last_followup_at,
           p.deadline,
           se.last_slot_end,
           oa.open_participants,
           oa.open_external,
           coalesce(p.last_followup_at, p.created_at)
             + make_interval(hours => CASE WHEN p.followup_count = 0 THEN _first_delay_hours ELSE _repeat_hours END)
             AS regular_due_at
    FROM public.appointment_polls p
    JOIN open_answers oa ON oa.poll_id = p.id
    LEFT JOIN slot_ends se ON se.poll_id = p.id
    WHERE p.status = 'active'
      AND p.followup_count < greatest(coalesce(_max_attempts, 1), 0)
      AND (p.followup_claimed_at IS NULL
           OR p.followup_claimed_at < now() - make_interval(mins => greatest(coalesce(_claim_timeout_minutes, 15), 1)))
      AND (p.deadline IS NULL OR p.deadline > now())
      AND (se.last_slot_end IS NULL OR se.last_slot_end > now())
  ),
  scheduled AS (
    SELECT c.candidate_poll_id,
           c.followup_count,
           c.created_at,
           c.open_participants,
           c.open_external,
           CASE
             WHEN c.deadline IS NOT NULL
               AND c.deadline - now() <= make_interval(hours => greatest(coalesce(_deadline_window_hours, 0), 0))
               AND (c.last_followup_at IS NULL
                    OR now() - c.last_followup_at >= make_interval(hours => greatest(coalesce(_min_gap_hours, 0), 0)))
               AND c.deadline - make_interval(hours => greatest(coalesce(_deadline_window_hours, 0), 0)) < c.regular_due_at
             THEN c.deadline - make_interval(hours => greatest(coalesce(_deadline_window_hours, 0), 0))
             ELSE c.regular_due_at
           END AS computed_due_at
    FROM candidates c
  )
  SELECT s.candidate_poll_id,
         (s.followup_count + 1),
         s.computed_due_at,
         s.open_participants,
         s.open_external
  FROM scheduled s
  WHERE s.computed_due_at <= now()
  ORDER BY 3 ASC, s.created_at ASC
  LIMIT greatest(coalesce(_limit, 100), 1);
$$;

REVOKE ALL ON FUNCTION public.get_due_poll_followups(integer, integer, integer, integer, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_due_poll_followups(integer, integer, integer, integer, integer, integer, integer)
  TO service_role;

-- 4) Versuch übernehmen: markiert den laufenden Versand und legt die
--    Versandaufträge an. Der Versuch selbst wird hier noch nicht verbucht.
CREATE OR REPLACE FUNCTION public.claim_poll_followup(
  _poll_id uuid,
  _expected_attempt integer,
  _claim_timeout_minutes integer DEFAULT 15
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_poll public.appointment_polls;
  v_attempt integer;
  v_participant record;
  v_notification_id uuid;
  v_internal boolean;
  v_subject text;
BEGIN
  UPDATE public.appointment_polls p
  SET followup_claimed_at = now(),
      followup_claimed_attempt = p.followup_count + 1
  WHERE p.id = _poll_id
    AND p.status = 'active'
    AND p.followup_count = greatest(coalesce(_expected_attempt, 0), 0)
    AND (p.followup_claimed_at IS NULL
         OR p.followup_claimed_at < now() - make_interval(mins => greatest(coalesce(_claim_timeout_minutes, 15), 1)))
  RETURNING * INTO v_poll;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_attempt := v_poll.followup_count + 1;
  v_subject := coalesce(nullif(btrim(v_poll.title), ''), 'Terminabstimmung');

  FOR v_participant IN
    SELECT pp.id, pp.email, pp.user_id, pp.is_external
    FROM public.poll_participants pp
    WHERE pp.poll_id = _poll_id
      AND btrim(coalesce(pp.email, '')) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.poll_responses pr WHERE pr.participant_id = pp.id
      )
  LOOP
    v_internal := v_participant.user_id IS NOT NULL AND NOT v_participant.is_external;

    INSERT INTO public.poll_notifications (
      poll_id, participant_id, notification_type, attempt, dedupe_key,
      is_sent, sent_at, send_attempts, next_attempt_at, last_error
    ) VALUES (
      _poll_id,
      v_participant.id,
      'answer_followup',
      v_attempt,
      public.poll_followup_send_key(_poll_id, v_participant.id, v_attempt),
      v_internal,
      CASE WHEN v_internal THEN now() END,
      0,
      now(),
      CASE WHEN v_internal THEN NULL ELSE 'offen' END
    )
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id INTO v_notification_id;

    -- In-App-Erinnerung nur beim ersten Anlegen dieses Versuchs, damit
    -- Wiederholungen keine doppelten Benachrichtigungen erzeugen.
    IF v_notification_id IS NOT NULL AND v_internal THEN
      PERFORM public.create_notification(
        v_participant.user_id,
        'poll_follow_up',
        'Erinnerung: Terminabstimmung',
        'Bitte geben Sie Ihre Verfügbarkeit für "' || v_subject || '" an.',
        jsonb_build_object('poll_id', _poll_id, 'attempt', v_attempt),
        'medium',
        v_poll.tenant_id
      );
    END IF;
  END LOOP;

  RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_poll_followup(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_poll_followup(uuid, integer, integer) TO service_role;

-- 5) Versuch abschließen: verbucht den Versuch nur, wenn keine offenen,
--    noch wiederholbaren Versandaufträge dieses Versuchs übrig sind. Ein
--    fehlgeschlagener Versand verbraucht damit keinen Erinnerungsversuch.
CREATE OR REPLACE FUNCTION public.finalize_poll_followup(
  _poll_id uuid,
  _attempt integer,
  _max_send_attempts integer DEFAULT 3
)
RETURNS TABLE (counted boolean, pending integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pending integer;
  v_updated integer;
BEGIN
  SELECT count(*) INTO v_pending
  FROM public.poll_notifications n
  WHERE n.poll_id = _poll_id
    AND n.notification_type = 'answer_followup'
    AND n.attempt = _attempt
    AND n.is_sent = false
    AND n.send_attempts < greatest(coalesce(_max_send_attempts, 1), 1);

  UPDATE public.appointment_polls p
  SET followup_claimed_at = NULL,
      followup_claimed_attempt = NULL,
      followup_count = CASE WHEN v_pending = 0 THEN greatest(p.followup_count, _attempt) ELSE p.followup_count END,
      last_followup_at = CASE WHEN v_pending = 0 THEN now() ELSE p.last_followup_at END,
      updated_at = now()
  WHERE p.id = _poll_id
    AND p.followup_count < _attempt;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN QUERY SELECT (v_pending = 0 AND v_updated > 0), v_pending;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_poll_followup(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_poll_followup(uuid, integer, integer) TO service_role;

-- Der alte RPC verbuchte den Versuch vor dem Versand; er wird nicht mehr
-- benutzt und darf nicht als Abkürzung weiterleben.
DROP FUNCTION IF EXISTS public.record_poll_followup(uuid, integer);

-- 6) Gewinner-Slot: ausdrückliche Prüfung der aktiven Büromitgliedschaft und
--    Rückgabe des tatsächlich gespeicherten Slots (nicht des angefragten).
DROP FUNCTION IF EXISTS public.confirm_poll_winner(uuid, uuid);

CREATE OR REPLACE FUNCTION public.confirm_poll_winner(_poll_id uuid, _slot_id uuid)
RETURNS TABLE (appointment_id uuid, slot_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_poll public.appointment_polls;
  v_slot public.poll_time_slots;
  v_tenant_id uuid;
  v_appointment_id uuid;
  v_subject text;
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

  v_tenant_id := v_poll.tenant_id;
  IF v_tenant_id IS NULL THEN
    SELECT p.tenant_id INTO v_tenant_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  END IF;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Kein Mandant für den Termin gefunden';
  END IF;

  -- Ausgeschiedene Mitarbeiter dürfen auch als Ersteller keinen Termin mehr
  -- erzeugen: die Mitgliedschaft muss aktuell aktiv sein.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = v_tenant_id
      AND m.is_active
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Nur aktive Mitglieder des Büros dürfen den Termin übernehmen';
  END IF;

  -- Bereits übernommen: unveränderten Stand inklusive echtem Slot zurückgeben.
  IF v_poll.confirmed_appointment_id IS NOT NULL THEN
    RETURN QUERY SELECT v_poll.confirmed_appointment_id, v_poll.confirmed_slot_id;
    RETURN;
  END IF;

  SELECT * INTO v_slot
  FROM public.poll_time_slots
  WHERE id = _slot_id AND poll_id = _poll_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Zeitslot gehört nicht zu dieser Abstimmung';
  END IF;

  v_subject := coalesce(nullif(btrim(v_poll.title), ''), 'Abgestimmter Termin');

  INSERT INTO public.appointments (
    user_id, tenant_id, poll_id, title, description,
    start_time, end_time, category, status, priority
  ) VALUES (
    v_poll.user_id, v_tenant_id, v_poll.id,
    v_subject,
    v_poll.description,
    v_slot.start_time, v_slot.end_time,
    'meeting', 'confirmed', 'high'
  )
  RETURNING id INTO v_appointment_id;

  -- Externe Teilnehmende werden Gäste des Termins; der Gast-Trigger vergibt
  -- Antworttoken. Der Existenztest hält Dubletten auf und vermeidet die
  -- Mehrdeutigkeit der Ausgabespalte appointment_id in ON CONFLICT.
  INSERT INTO public.appointment_guests (appointment_id, tenant_id, name, email, status)
  SELECT v_appointment_id,
         v_tenant_id,
         coalesce(nullif(btrim(pp.name), ''), lower(btrim(pp.email))),
         lower(btrim(pp.email)),
         'pending'
  FROM public.poll_participants pp
  WHERE pp.poll_id = v_poll.id
    AND pp.is_external
    AND btrim(pp.email) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.appointment_guests g
      WHERE g.appointment_id = v_appointment_id
        AND lower(g.email) = lower(btrim(pp.email))
    );

  IF EXISTS (
    SELECT 1 FROM public.appointment_guests g
    WHERE g.appointment_id = v_appointment_id
  ) THEN
    UPDATE public.appointments SET has_external_guests = true WHERE id = v_appointment_id;
  END IF;

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
    'Der abgestimmte Termin "' || v_subject || '" wurde im Kalender angelegt.',
    jsonb_build_object('poll_id', v_poll.id, 'appointment_id', v_appointment_id),
    'medium',
    v_tenant_id
  );

  RETURN QUERY SELECT v_appointment_id, v_slot.id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_poll_winner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_poll_winner(uuid, uuid) TO authenticated;

-- 7) Frei/Gebucht: Abwesenheiten ausdrücklich über die aktive Mitgliedschaft
--    im aufrufenden Mandanten filtern. leave_requests hat keinen tenant_id,
--    deshalb ist die Mitgliedschaft der abwesenden Person der Mandantenfilter.
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
    AND lr.end_date >= (_from AT TIME ZONE 'Europe/Berlin')::date
    AND EXISTS (
      SELECT 1 FROM public.user_tenant_memberships lm
      WHERE lm.user_id = lr.user_id
        AND lm.tenant_id = _tenant_id
        AND lm.is_active
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_poll_availability(uuid, text[], timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_poll_availability(uuid, text[], timestamptz, timestamptz) TO authenticated;
