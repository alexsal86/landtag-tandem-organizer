CREATE OR REPLACE FUNCTION public.create_appointment_poll_with_details(
  p_title text,
  p_description text DEFAULT NULL,
  p_deadline timestamptz DEFAULT NULL,
  p_time_slots jsonb DEFAULT '[]'::jsonb,
  p_participants jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_poll_id uuid;
  v_slot jsonb;
  v_participant jsonb;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_email text;
  v_name text;
  v_is_external boolean;
  v_order_index integer;
  v_token text;
  v_sqlstate text;
  v_constraint text;
  v_detail text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Nicht authentifiziert',
      DETAIL = 'Für das Erstellen einer Terminabstimmung ist eine aktive Anmeldung erforderlich.';
  END IF;

  IF nullif(trim(p_title), '') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Ungültiger Titel',
      DETAIL = 'Das Feld "Titel" darf nicht leer sein.';
  END IF;

  IF jsonb_typeof(p_time_slots) IS DISTINCT FROM 'array' OR jsonb_array_length(p_time_slots) = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Ungültige Zeitslots',
      DETAIL = 'Es muss mindestens ein Zeitslot übergeben werden.';
  END IF;

  IF jsonb_typeof(p_participants) IS DISTINCT FROM 'array' OR jsonb_array_length(p_participants) = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Ungültige Teilnehmer',
      DETAIL = 'Es muss mindestens ein Teilnehmer übergeben werden.';
  END IF;

  SELECT p.tenant_id
    INTO v_tenant_id
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  INSERT INTO public.appointment_polls (user_id, tenant_id, title, description, deadline, status)
  VALUES (v_user_id, v_tenant_id, trim(p_title), p_description, p_deadline, 'active')
  RETURNING id INTO v_poll_id;

  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_time_slots)
  LOOP
    v_start_time := (v_slot ->> 'start_time')::timestamptz;
    v_end_time := (v_slot ->> 'end_time')::timestamptz;
    v_order_index := COALESCE((v_slot ->> 'order_index')::integer, 0);

    IF v_start_time IS NULL OR v_end_time IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Ungültiger Zeitslot',
        DETAIL = format('Zeitslot enthält ungültige Zeiten: %s', v_slot::text);
    END IF;

    IF v_end_time <= v_start_time THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Ungültiger Zeitslot',
        DETAIL = format('Endzeit muss nach der Startzeit liegen: %s', v_slot::text);
    END IF;

    INSERT INTO public.poll_time_slots (poll_id, start_time, end_time, order_index)
    VALUES (v_poll_id, v_start_time, v_end_time, v_order_index);
  END LOOP;

  FOR v_participant IN SELECT value FROM jsonb_array_elements(p_participants)
  LOOP
    v_email := lower(trim(v_participant ->> 'email'));
    v_name := nullif(trim(v_participant ->> 'name'), '');
    v_is_external := COALESCE((v_participant ->> 'is_external')::boolean, false);

    IF v_email IS NULL OR v_email = '' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Ungültiger Teilnehmer',
        DETAIL = format('Teilnehmer enthält keine gültige E-Mail-Adresse: %s', v_participant::text);
    END IF;

    IF v_is_external THEN
      v_token := public.generate_participant_token();
    ELSE
      v_token := NULL;
    END IF;

    INSERT INTO public.poll_participants (poll_id, email, name, is_external, token)
    VALUES (v_poll_id, v_email, COALESCE(v_name, v_email), v_is_external, v_token);
  END LOOP;

  RETURN v_poll_id;

EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_sqlstate = RETURNED_SQLSTATE,
      v_constraint = CONSTRAINT_NAME,
      v_detail = PG_EXCEPTION_DETAIL;

    RAISE EXCEPTION USING
      ERRCODE = v_sqlstate,
      MESSAGE = format('Erstellen der Terminabstimmung fehlgeschlagen: %s', SQLERRM),
      DETAIL = concat_ws(' | ', nullif(v_detail, ''), nullif(format('Constraint: %s', v_constraint), 'Constraint: '));
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_appointment_poll_with_details(text, text, timestamptz, jsonb, jsonb) TO authenticated;
