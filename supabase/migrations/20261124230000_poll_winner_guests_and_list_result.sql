-- Übernommener Gewinner-Slot bringt die externen Teilnehmer als Gäste mit, und
-- die Abstimmungsliste zeigt den erzeugten Termin.

-- 1) confirm_poll_winner: Gäste aus der Abstimmung übernehmen (einmalig, weil
--    der Aufruf über confirmed_appointment_id idempotent ist).
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

  -- Externe Teilnehmende werden Gäste des Termins; der Gast-Trigger vergibt
  -- Antworttoken, der Unique-Index verhindert Dubletten.
  INSERT INTO public.appointment_guests AS guest (appointment_id, tenant_id, name, email, status)
  SELECT v_appointment_id,
         v_tenant_id,
         coalesce(nullif(btrim(pp.name), ''), lower(btrim(pp.email))),
         lower(btrim(pp.email)),
         'pending'
  FROM public.poll_participants pp
  WHERE pp.poll_id = v_poll.id
    AND pp.is_external
    AND btrim(pp.email) <> ''
  ON CONFLICT (appointment_id, (lower(email))) DO NOTHING;

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

-- 2) Abstimmungsliste: Ergebnis-Termin mitliefern, damit das Archiv ihn verlinken kann.
CREATE OR REPLACE FUNCTION public.get_user_polls_with_aggregation()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  deadline timestamptz,
  status text,
  created_at timestamptz,
  participant_count bigint,
  response_count bigint,
  time_slots_count bigint,
  creator_name text,
  confirmed_slot_id uuid,
  confirmed_appointment_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ap.id,
    ap.title,
    ap.description,
    ap.deadline,
    ap.status,
    ap.created_at,
    COALESCE(pp.participant_count, 0) AS participant_count,
    COALESCE(pr.response_count, 0) AS response_count,
    COALESCE(ts.time_slots_count, 0) AS time_slots_count,
    COALESCE(p.display_name, 'Unbekannt') AS creator_name,
    ap.confirmed_slot_id,
    ap.confirmed_appointment_id
  FROM public.appointment_polls ap
  LEFT JOIN (
    SELECT poll_id, COUNT(*) AS participant_count
    FROM public.poll_participants
    GROUP BY poll_id
  ) pp ON pp.poll_id = ap.id
  LEFT JOIN (
    SELECT poll_id, COUNT(DISTINCT participant_id) AS response_count
    FROM public.poll_responses
    GROUP BY poll_id
  ) pr ON pr.poll_id = ap.id
  LEFT JOIN (
    SELECT poll_id, COUNT(*) AS time_slots_count
    FROM public.poll_time_slots
    GROUP BY poll_id
  ) ts ON ts.poll_id = ap.id
  LEFT JOIN public.profiles p ON p.user_id = ap.user_id
  WHERE ap.user_id = auth.uid()
  ORDER BY ap.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_polls_with_aggregation() TO authenticated;
