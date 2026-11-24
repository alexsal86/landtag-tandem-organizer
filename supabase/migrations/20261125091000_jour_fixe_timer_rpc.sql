-- Robuste Ist-Zeit-Buchung für den Jour fixe.
--
-- Bisher schrieb der Browser `actual_minutes` plus die neue Dauer und beendete
-- den Timer über einen exakten Zeitstempel-Vergleich. Traf der nicht, gingen
-- Minuten verloren und der Punkt blieb dauerhaft auf "läuft". Jetzt rechnet die
-- Datenbank aus dem gespeicherten Start; der Client nennt nur noch den Punkt.

-- Altbestand aus der ersten Fassung: laufende Uhren einmalig abrechnen.
UPDATE public.meeting_agenda_items item
SET actual_minutes = item.actual_minutes + round(least(extract(epoch FROM (now() - item.timer_started_at)), 7200) / 60)::int,
    timer_started_at = NULL
WHERE item.timer_started_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_jour_fixe_agenda_timer(_meeting_id uuid, _item_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  closed integer := 0;
  started_at timestamptz;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.meetings meeting
    WHERE meeting.id = _meeting_id
      AND (
        meeting.user_id = actor
        OR public.is_meeting_participant(meeting.id)
        OR (
          meeting.tenant_id IS NOT NULL
          AND public.has_active_tenant_role(actor, meeting.tenant_id, ARRAY['abgeordneter', 'bueroleitung'])
        )
      )
  ) THEN
    RAISE EXCEPTION 'Keine Sitzungsberechtigung' USING ERRCODE = '42501';
  END IF;

  -- Alle laufenden Punkte dieser Sitzung abschließen – auch verwaiste aus
  -- abgebrochenen Sitzungen. Die Zeit kommt aus dem gespeicherten Start, nicht
  -- aus der Browser-Uhr; ein liegengebliebener Timer wird auf zwei Stunden
  -- begrenzt, damit ein vergessener Abend nicht als Sitzungszeit durchgeht.
  WITH running AS (
    SELECT item.id AS item_id, item.actual_minutes, item.timer_started_at
    FROM public.meeting_agenda_items item
    WHERE item.meeting_id = _meeting_id
      AND item.timer_started_at IS NOT NULL
      AND (_item_id IS NULL OR item.id <> _item_id)
    FOR UPDATE
  ), booked AS (
    SELECT item_id,
           actual_minutes + round(least(extract(epoch FROM (now() - timer_started_at)), 7200) / 60)::int AS minutes
    FROM running
  )
  UPDATE public.meeting_agenda_items target
  SET actual_minutes = greatest(0, booked.minutes),
      timer_started_at = NULL
  FROM booked
  WHERE target.id = booked.item_id;

  GET DIAGNOSTICS closed = ROW_COUNT;

  IF _item_id IS NOT NULL THEN
    -- Idempotent: läuft der Punkt schon, bleibt sein Startzeitpunkt erhalten.
    UPDATE public.meeting_agenda_items
    SET timer_started_at = now()
    WHERE id = _item_id
      AND meeting_id = _meeting_id
      AND timer_started_at IS NULL;

    SELECT item.timer_started_at INTO started_at
    FROM public.meeting_agenda_items item
    WHERE item.id = _item_id
      AND item.meeting_id = _meeting_id;

    IF started_at IS NULL THEN
      RAISE EXCEPTION 'Punkt % gehört nicht zu dieser Sitzung', _item_id USING ERRCODE = '22023';
    END IF;

    UPDATE public.meetings
    SET started_at = coalesce(started_at, now())
    WHERE id = _meeting_id;
  END IF;

  RETURN jsonb_build_object(
    'item_id', _item_id,
    'started_at', started_at,
    'closed_items', closed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_jour_fixe_agenda_timer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_jour_fixe_agenda_timer(uuid, uuid) TO authenticated;
