CREATE OR REPLACE FUNCTION public.list_election_history_deputies(search_text text DEFAULT ''::text, page_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Nur Super-Admins dürfen das Abgeordnetenregister öffnen' USING ERRCODE = '42501';
  END IF;
  RETURN (WITH entries AS (
    SELECT m.*, coalesce(m.person_name,p.name) AS display_name,
      coalesce(nullif(btrim(m.party_label),''),m.party) AS faction,
      coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))) AS history_key
    FROM public.election_history_mandates m
    LEFT JOIN public.election_history_people p ON p.id=m.person_id
  ) SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM (
    SELECT e.history_key AS name_key, min(e.display_name) AS name,
      array_agg(DISTINCT e.faction ORDER BY e.faction) AS parties,
      count(*) AS mandates, count(DISTINCT e.period_id) AS periods,
      count(*) FILTER (WHERE e.connection_id IS NULL) AS unlinked
    FROM entries e
    WHERE strpos(lower(e.display_name),lower(btrim(coalesce(search_text,'')))) > 0
    GROUP BY e.history_key
    ORDER BY lower(min(e.display_name)),e.history_key
    LIMIT 26 OFFSET greatest(0,page_offset)
  ) g);
END;
$function$;

REVOKE ALL ON FUNCTION public.list_election_history_deputies(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_election_history_deputies(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_election_history_deputy(name_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Nur Super-Admins dürfen das Abgeordnetenregister öffnen' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.period_number,g.starts_on NULLS FIRST,g.id), '[]'::jsonb) FROM (
    SELECT b.birthday,b.birth_year,m.id,m.person_id,m.connection_id,coalesce(m.person_name,p.name) AS name,m.party,m.party_label,
      lp.name AS period_name,lp.number AS period_number,m.starts_on,m.ends_on,
      m.entry_type,m.mandate_type,m.original_mandate,m.left_early,m.notes,
      (m.end_from_period AND lp.ends_on_is_expected) AS end_is_expected,
      d.name AS district_name,coalesce(d.number_label,d.district_number::text) AS district_label,p.name AS linked_name
    FROM public.election_history_mandates m
    JOIN public.election_history_periods lp ON lp.id=m.period_id
    LEFT JOIN public.election_history_mandate_birthdays b ON b.mandate_id=m.id
    LEFT JOIN public.election_history_people p ON p.id=m.person_id
    LEFT JOIN public.election_history_districts d ON d.id=m.district_id
    WHERE coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party))))=name_key
    ORDER BY lp.number,m.starts_on NULLS FIRST,m.id LIMIT 201
  ) g);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_election_history_deputy(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_election_history_deputy(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_election_history_deputies(source_key text, target_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  target uuid;
  source_count integer;
  target_count integer;
  identity_count integer;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Nur Super-Admins dürfen Mandatshistorien verbinden' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(source_key),'') IS NULL OR nullif(btrim(target_key),'') IS NULL OR source_key = target_key THEN
    RAISE EXCEPTION 'Bitte zwei unterschiedliche Registergruppen auswählen.';
  END IF;

  WITH entries AS (
    SELECT m.id, coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))) AS history_key
    FROM public.election_history_mandates m
    LEFT JOIN public.election_history_people p ON p.id=m.person_id
    WHERE coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))) IN (source_key,target_key)
  ), locked AS (
    SELECT m.id FROM public.election_history_mandates m JOIN entries e ON e.id=m.id ORDER BY m.id FOR UPDATE
  )
  SELECT count(*) FILTER (WHERE e.history_key=source_key), count(*) FILTER (WHERE e.history_key=target_key)
    INTO source_count,target_count FROM entries e;
  IF source_count=0 OR target_count=0 OR source_count>200 OR target_count>200 THEN
    RAISE EXCEPTION 'Eine ausgewählte Registergruppe fehlt oder überschreitet 200 Mandate. Bitte neu laden.';
  END IF;

  SELECT count(DISTINCT m.person_id) FILTER (WHERE m.person_id IS NOT NULL) INTO identity_count
  FROM public.election_history_mandates m
  LEFT JOIN public.election_history_people p ON p.id=m.person_id
  WHERE coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))) IN (source_key,target_key);
  IF identity_count>1 THEN
    RAISE EXCEPTION 'Die Gruppen gehören zu verschiedenen bestätigten zentralen Personen und werden nicht überschrieben.';
  END IF;

  SELECT m.connection_id INTO target FROM public.election_history_mandates m
  LEFT JOIN public.election_history_people p ON p.id=m.person_id
  WHERE coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party))))=target_key
    AND m.connection_id IS NOT NULL LIMIT 1;
  target := coalesce(target,gen_random_uuid());

  UPDATE public.election_history_mandates m SET connection_id=target
  FROM public.election_history_people p
  WHERE p.id=m.person_id
    AND coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party))))=source_key;
  UPDATE public.election_history_mandates m SET connection_id=target
  WHERE m.person_id IS NULL
    AND coalesce(m.connection_id::text,'name:' || lower(btrim(m.person_name)) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party))))=source_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Die Quellgruppe wurde zwischenzeitlich verändert. Bitte neu laden.';
  END IF;
  RETURN target;
END;
$function$;

REVOKE ALL ON FUNCTION public.merge_election_history_deputies(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_election_history_deputies(text, text) TO authenticated;