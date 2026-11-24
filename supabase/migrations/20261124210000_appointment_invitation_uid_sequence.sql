-- Stabile ICS-UID und fortlaufende SEQUENCE je Termin.
-- Gäste werden künftig auf (appointment_id, lower(email)) aktualisiert, statt
-- gelöscht und mit neuen Tokens neu angelegt zu werden.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS calendar_sequence INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_invitation_sequence INTEGER NOT NULL DEFAULT 0;

-- Vorhandene Termine ohne UID bekommen sie beim ersten Versand bzw. Export:
-- send-appointment-invitation und generate-calendar-invite erzeugen sie
-- deterministisch aus der Termin-ID und speichern sie anschließend nach. Ein
-- Massen-Update an dieser Stelle würde für jeden vergangenen Termin den
-- Feedback-Trigger auslösen und unbeabsichtigt Rückmeldungen anlegen.
-- Bereits gesetzte (auch alte zufällige) UIDs bleiben unverändert, damit
-- versendete Einladungen weiterhin zuordenbar sind.

CREATE OR REPLACE FUNCTION public.stamp_appointment_calendar_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.calendar_uid IS NULL OR btrim(NEW.calendar_uid) = '' THEN
      NEW.calendar_uid := NEW.id::text || '@landtagsos.app';
    END IF;
    NEW.calendar_sequence := GREATEST(COALESCE(NEW.calendar_sequence, 0), 0);
    NEW.last_invitation_sequence := COALESCE(NEW.last_invitation_sequence, 0);
    RETURN NEW;
  END IF;

  -- Die UID bleibt über die gesamte Lebensdauer des Termins stabil, damit
  -- Kalender Updates und Absagen derselben Veranstaltung zuordnen.
  IF OLD.calendar_uid IS NOT NULL AND btrim(OLD.calendar_uid) <> '' THEN
    NEW.calendar_uid := OLD.calendar_uid;
  ELSIF NEW.calendar_uid IS NULL OR btrim(NEW.calendar_uid) = '' THEN
    NEW.calendar_uid := OLD.id::text || '@landtagsos.app';
  END IF;

  -- Nur echte Zeit-/Ortsänderungen erhöhen die SEQUENCE. Ein bereits gesetzter
  -- Wert (z. B. für eine Absage) bleibt erhalten.
  IF (NEW.start_time, NEW.end_time, NEW.location) IS DISTINCT FROM (OLD.start_time, OLD.end_time, OLD.location) THEN
    NEW.calendar_sequence := COALESCE(OLD.calendar_sequence, 0) + 1;
  ELSE
    NEW.calendar_sequence := COALESCE(NEW.calendar_sequence, OLD.calendar_sequence, 0);
  END IF;

  NEW.last_invitation_sequence := COALESCE(NEW.last_invitation_sequence, OLD.last_invitation_sequence, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_appointment_calendar_invite ON public.appointments;
CREATE TRIGGER stamp_appointment_calendar_invite
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_appointment_calendar_invite();

-- E-Mail-Adressen einheitlich klein speichern, damit der Abgleich über
-- (appointment_id, lower(email)) nicht an der Schreibweise scheitert.
CREATE OR REPLACE FUNCTION public.normalize_appointment_guest_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_appointment_guest_email ON public.appointment_guests;
CREATE TRIGGER normalize_appointment_guest_email
  BEFORE INSERT OR UPDATE ON public.appointment_guests
  FOR EACH ROW EXECUTE FUNCTION public.normalize_appointment_guest_email();

UPDATE public.appointment_guests
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));

-- Bestehende Dubletten je Termin zusammenführen: der beantwortete bzw. älteste
-- Eintrag bleibt erhalten, damit RSVP-Status und Antwortlink nicht verloren gehen.
DELETE FROM public.appointment_guests AS guest
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY appointment_id, lower(btrim(email))
           ORDER BY (responded_at IS NOT NULL) DESC, created_at, id
         ) AS position
  FROM public.appointment_guests
) AS ranked
WHERE guest.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS appointment_guests_appointment_email_key
  ON public.appointment_guests (appointment_id, lower(email));

-- Gäste speichern, ohne Antwortstatus, Token oder Antwortlink zu verlieren:
-- bestehende Zeilen werden nur im Namen aktualisiert, entfernte Gäste gelöscht.
CREATE OR REPLACE FUNCTION public.upsert_appointment_guests(_appointment_id uuid, _guests jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_kept uuid[] := ARRAY[]::uuid[];
  v_entry jsonb;
  v_name text;
  v_email text;
  v_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant
  FROM public.appointments
  WHERE id = _appointment_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Termin nicht gefunden';
  END IF;

  IF NOT (v_tenant = ANY (public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Termin';
  END IF;

  IF _guests IS NULL OR jsonb_typeof(_guests) <> 'array' THEN
    RAISE EXCEPTION 'Gästeliste muss ein JSON-Array sein';
  END IF;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(_guests) LOOP
    v_email := lower(btrim(COALESCE(v_entry ->> 'email', '')));
    v_name := btrim(COALESCE(v_entry ->> 'name', ''));

    IF v_email = '' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'Ungültige E-Mail-Adresse: %', v_email;
    END IF;

    IF v_name = '' THEN
      v_name := v_email;
    END IF;

    INSERT INTO public.appointment_guests AS guest (appointment_id, tenant_id, name, email, status)
    VALUES (_appointment_id, v_tenant, v_name, v_email, 'pending')
    ON CONFLICT (appointment_id, (lower(email))) DO UPDATE
      SET name = EXCLUDED.name
    RETURNING guest.id INTO v_id;

    v_kept := v_kept || v_id;
  END LOOP;

  DELETE FROM public.appointment_guests
  WHERE appointment_id = _appointment_id
    AND NOT (id = ANY (v_kept));

  RETURN jsonb_build_object('appointment_id', _appointment_id, 'guest_ids', to_jsonb(v_kept));
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_appointment_guests(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_appointment_guests(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_appointment_guests(uuid, jsonb) TO service_role;
