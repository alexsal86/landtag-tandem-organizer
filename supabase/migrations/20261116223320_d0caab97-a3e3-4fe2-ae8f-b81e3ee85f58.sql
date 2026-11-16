CREATE OR REPLACE FUNCTION public.get_election_history_period_overview()
RETURNS TABLE (
  period_id uuid,
  district_count integer,
  mandate_count integer,
  candidacy_count integer,
  open_identity_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Nur Super-Admins dürfen die zentrale Datenübersicht öffnen' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id,
      (SELECT count(*)::integer FROM public.election_history_districts d WHERE d.period_id = p.id),
      (SELECT count(*)::integer FROM public.election_history_mandates m WHERE m.period_id = p.id),
      (SELECT count(*)::integer FROM public.election_history_candidacies c WHERE c.period_id = p.id),
      (SELECT count(*)::integer FROM public.election_history_mandates m
        WHERE m.period_id = p.id AND m.person_id IS NULL AND m.connection_id IS NULL)
    FROM public.election_history_periods p;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_election_history_period_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_election_history_period_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.import_election_history_candidacies(
  period uuid,
  import_source_url text,
  entries jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  item jsonb;
  line_number integer := 0;
  imported integer := 0;
  selected_person uuid;
  selected_district uuid;
  new_name text;
  party_name text;
  ballot text;
  result text;
  source text := nullif(btrim(import_source_url), '');
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Nur Super-Admins dürfen zentrale Kandidaturen importieren' USING ERRCODE = '42501';
  END IF;
  IF period IS NULL OR NOT EXISTS (SELECT 1 FROM public.election_history_periods p WHERE p.id = period) THEN
    RAISE EXCEPTION 'Die Legislaturperiode existiert nicht.';
  END IF;
  IF entries IS NULL OR jsonb_typeof(entries) <> 'array'
      OR jsonb_array_length(entries) = 0 OR jsonb_array_length(entries) > 1000 THEN
    RAISE EXCEPTION 'Bitte zwischen 1 und 1000 Kandidaturzeilen importieren.';
  END IF;
  IF source IS NOT NULL AND source !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Bitte eine vollständige HTTPS-Quellenadresse angeben.';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(entries) LOOP
    line_number := line_number + 1;
    IF jsonb_typeof(item) <> 'object' THEN
      RAISE EXCEPTION 'Zeile % ist kein gültiger Kandidaturdatensatz.', line_number;
    END IF;

    selected_person := nullif(btrim(item->>'person_id'), '')::uuid;
    selected_district := nullif(btrim(item->>'district_id'), '')::uuid;
    new_name := nullif(btrim(item->>'new_person_name'), '');
    party_name := nullif(btrim(item->>'party'), '');
    ballot := coalesce(nullif(btrim(item->>'ballot_type'), ''), 'candidate');
    result := coalesce(nullif(btrim(item->>'outcome'), ''), 'unknown');

    IF (selected_person IS NULL) = (new_name IS NULL) THEN
      RAISE EXCEPTION 'Zeile %: Entweder eine vorhandene Person auswählen oder ausdrücklich eine neue Person benennen.', line_number;
    END IF;
    IF party_name IS NULL THEN
      RAISE EXCEPTION 'Zeile %: Die Partei fehlt.', line_number;
    END IF;
    IF ballot NOT IN ('candidate', 'first_vote') THEN
      RAISE EXCEPTION 'Zeile %: Ungültige Stimmenart.', line_number;
    END IF;
    IF result NOT IN ('direct', 'list', 'not_elected', 'unknown') THEN
      RAISE EXCEPTION 'Zeile %: Ungültiger Wahlausgang.', line_number;
    END IF;
    IF selected_district IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.election_history_districts d WHERE d.id = selected_district AND d.period_id = import_election_history_candidacies.period
    ) THEN
      RAISE EXCEPTION 'Zeile %: Der Wahlkreis gehört nicht zur ausgewählten Legislaturperiode.', line_number;
    END IF;
    IF selected_district IS NULL AND (item->>'votes' IS NOT NULL OR item->>'vote_share' IS NOT NULL
        OR item->>'district_rank' IS NOT NULL OR result = 'direct') THEN
      RAISE EXCEPTION 'Zeile %: Ein persönliches Wahlkreisergebnis braucht einen Wahlkreis.', line_number;
    END IF;

    IF selected_person IS NULL THEN
      INSERT INTO public.election_history_people(name, source_url)
      VALUES (new_name, source)
      RETURNING id INTO selected_person;
    ELSIF NOT EXISTS (SELECT 1 FROM public.election_history_people p WHERE p.id = selected_person) THEN
      RAISE EXCEPTION 'Zeile %: Die ausgewählte Person existiert nicht.', line_number;
    END IF;
    IF EXISTS (SELECT 1 FROM public.election_history_candidacies c
      WHERE c.period_id = import_election_history_candidacies.period AND c.person_id = selected_person) THEN
      RAISE EXCEPTION 'Zeile %: Für diese Person ist in der Legislaturperiode bereits eine Kandidatur erfasst.', line_number;
    END IF;

    INSERT INTO public.election_history_candidacies(
      period_id, person_id, district_id, party, votes, vote_share,
      district_rank, list_position, ballot_type, outcome, source_url
    ) VALUES (
      period, selected_person, selected_district, party_name,
      nullif(btrim(item->>'votes'), '')::bigint,
      nullif(btrim(item->>'vote_share'), '')::numeric,
      nullif(btrim(item->>'district_rank'), '')::integer,
      nullif(btrim(item->>'list_position'), '')::integer,
      ballot, result, source
    );
    imported := imported + 1;
  END LOOP;
  RETURN imported;
END;
$function$;

REVOKE ALL ON FUNCTION public.import_election_history_candidacies(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_election_history_candidacies(uuid, text, jsonb) TO authenticated;