-- Ist-Zeiten im Jour fixe und Rückmeldung der Teilnehmenden.
--
-- Geplante Dauern stehen bereits in meeting_agenda_items.duration_minutes.
-- Für die Nachbereitung wird die tatsächlich verbrauchte Zeit je Punkt
-- mitgeschrieben; ein laufender Punkt ist über timer_started_at markiert.

ALTER TABLE public.meeting_agenda_items
  ADD COLUMN IF NOT EXISTS timer_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_minutes integer NOT NULL DEFAULT 0 CHECK (actual_minutes >= 0);

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Höchstens ein laufender Punkt pro Sitzung, damit keine Zeit doppelt gezählt wird.
CREATE UNIQUE INDEX IF NOT EXISTS meeting_agenda_items_one_running_timer
  ON public.meeting_agenda_items(meeting_id)
  WHERE timer_started_at IS NOT NULL;

-- Rückmeldung: zusätzlich zur Zu-/Absage kann Urlaub gemeldet werden.
ALTER TABLE public.meeting_participants
  DROP CONSTRAINT IF EXISTS meeting_participants_status_check;
ALTER TABLE public.meeting_participants
  ADD CONSTRAINT meeting_participants_status_check
  CHECK (status IN ('pending', 'confirmed', 'declined', 'vacation'));

-- Teilnehmende melden sich selbst zurück; die Zeile bleibt Eigentum der Person,
-- damit niemand die Rückmeldung anderer überschreiben kann.
CREATE OR REPLACE FUNCTION public.respond_to_meeting_invitation(_meeting_id uuid, _status text)
RETURNS public.meeting_participants
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  response public.meeting_participants%ROWTYPE;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('pending', 'confirmed', 'declined', 'vacation') THEN
    RAISE EXCEPTION 'Unbekannte Rückmeldung: %', _status USING ERRCODE = '22023';
  END IF;

  UPDATE public.meeting_participants participant
  SET status = _status
  WHERE participant.meeting_id = _meeting_id
    AND participant.user_id = actor
  RETURNING * INTO response;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Keine Einladung zu dieser Besprechung' USING ERRCODE = '42501';
  END IF;

  RETURN response;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_meeting_invitation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_meeting_invitation(uuid, text) TO authenticated;
