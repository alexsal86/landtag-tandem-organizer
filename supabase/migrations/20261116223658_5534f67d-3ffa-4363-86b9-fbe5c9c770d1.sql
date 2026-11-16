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
  updated integer;
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
  WHERE coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,(SELECT p.name FROM public.election_history_people p WHERE p.id=m.person_id)))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party))))=source_key;
  GET DIAGNOSTICS updated=ROW_COUNT;
  IF updated<>source_count THEN
    RAISE EXCEPTION 'Die Quellgruppe wurde zwischenzeitlich verändert. Bitte neu laden.';
  END IF;
  RETURN target;
END;
$function$;

REVOKE ALL ON FUNCTION public.merge_election_history_deputies(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_election_history_deputies(text, text) TO authenticated;