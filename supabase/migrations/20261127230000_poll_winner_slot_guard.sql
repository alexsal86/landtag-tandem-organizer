-- Der Selbsttest „Terminabstimmung (Gewinner-Slot übernehmen + Nachfassen)“
-- meldete im Schritt „Ersteller-, Slot- und Mandantenprüfung“: „Ein fremder
-- Slot darf nicht übernommen werden.“ Ursache war die Reihenfolge in
-- confirm_poll_winner: Bei bereits übernommener Abstimmung (der vorherige
-- Schritt hatte den Gewinner-Slot bestätigt) kam die Funktion vor der
-- Slot-Prüfung zurück und akzeptierte damit jede übergebene Slot-ID,
-- einschließlich zufälliger/fremder UUIDs.
--
-- Die Zugehörigkeit des Slots zur Abstimmung wird deshalb jetzt vor der
-- idempotenten Rückgabe geprüft. Bereits übernommene Abstimmungen liefern
-- weiterhin unverändert denselben Termin und den tatsächlich gespeicherten
-- Slot – auch wenn ein anderer, aber echter Slot der Abstimmung angefragt
-- wird. Ersteller-, Mandanten- und Mitgliedschaftsprüfungen bleiben davor.
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

  -- Der Slot muss zur Abstimmung gehören – auch dann, wenn der Termin schon
  -- übernommen wurde. Sonst würde eine fremde Slot-ID stillschweigend als
  -- bereits gespeicherte Auswahl durchgehen.
  SELECT * INTO v_slot
  FROM public.poll_time_slots
  WHERE id = _slot_id AND poll_id = _poll_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Zeitslot gehört nicht zu dieser Abstimmung';
  END IF;

  -- Bereits übernommen: unveränderten Stand inklusive echtem Slot zurückgeben.
  IF v_poll.confirmed_appointment_id IS NOT NULL THEN
    RETURN QUERY SELECT v_poll.confirmed_appointment_id, v_poll.confirmed_slot_id;
    RETURN;
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
