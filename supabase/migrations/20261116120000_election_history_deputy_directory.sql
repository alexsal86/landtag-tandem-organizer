BEGIN;
-- Explicitly opened, paginated Super Admin directory; period/map loaders stay scoped.
CREATE FUNCTION public.list_election_history_deputies(search_text text DEFAULT '', page_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen das Abgeordnetenregister öffnen' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM (
   SELECT lower(btrim(coalesce(m.person_name,p.name))) AS name_key,
     min(coalesce(m.person_name,p.name)) AS name,
     array_agg(DISTINCT m.party ORDER BY m.party) AS parties,
     count(*) AS mandates, count(DISTINCT m.period_id) AS periods,
     count(*) FILTER (WHERE m.person_id IS NULL) AS unlinked
   FROM public.election_history_mandates m LEFT JOIN public.election_history_people p ON p.id=m.person_id
   WHERE strpos(lower(coalesce(m.person_name,p.name)), lower(btrim(coalesce(search_text,'')))) > 0
   GROUP BY lower(btrim(coalesce(m.person_name,p.name)))
   ORDER BY name_key LIMIT 26 OFFSET greatest(0,page_offset)
 ) g);
END $$;
CREATE FUNCTION public.get_election_history_deputy(name_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen das Abgeordnetenregister öffnen' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM (
   SELECT m.id, m.person_id, coalesce(m.person_name,p.name) AS name, m.party,
     lp.name AS period_name, lp.number AS period_number, m.starts_on, m.ends_on,
     m.entry_type, d.name AS district_name, p.name AS linked_name
   FROM public.election_history_mandates m
   JOIN public.election_history_periods lp ON lp.id=m.period_id
   LEFT JOIN public.election_history_people p ON p.id=m.person_id
   LEFT JOIN public.election_history_districts d ON d.id=m.district_id
   WHERE lower(btrim(coalesce(m.person_name,p.name)))=name_key
   ORDER BY lp.number,m.starts_on NULLS FIRST,m.id LIMIT 201
 ) g);
END $$;
CREATE FUNCTION public.confirm_election_history_deputy(mandate_ids uuid[], person_name text, target_person uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE target uuid; chosen integer; updated integer;
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen Personen zuordnen' USING ERRCODE='42501'; END IF;
 chosen := cardinality(mandate_ids);
 IF chosen IS NULL OR chosen=0 OR chosen>200 OR chosen>200 OR nullif(btrim(person_name),'') IS NULL THEN
   RAISE EXCEPTION 'Bitte Mandate und einen Personennamen auswählen';
 END IF;
 -- Serialize explicit confirmations for a name and recheck after acquiring locks.
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(person_name)),0));
 PERFORM id FROM public.election_history_mandates WHERE id=ANY(mandate_ids) ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM public.election_history_mandates WHERE id=ANY(mandate_ids) AND person_id IS NULL)<>chosen THEN
   RAISE EXCEPTION 'Ein ausgewähltes Mandat ist bereits zugeordnet oder wurde geändert. Bitte neu laden.';
 END IF;
 IF target_person IS NULL THEN
   INSERT INTO public.election_history_people(name) VALUES(btrim(person_name)) RETURNING id INTO target;
 ELSE
   SELECT id INTO target FROM public.election_history_people WHERE id=target_person FOR UPDATE;
   IF target IS NULL THEN RAISE EXCEPTION 'Zielperson existiert nicht mehr'; END IF;
 END IF;
 UPDATE public.election_history_mandates SET person_id=target WHERE id=ANY(mandate_ids) AND person_id IS NULL;
 GET DIAGNOSTICS updated=ROW_COUNT;
 IF updated<>chosen THEN RAISE EXCEPTION 'Die Auswahl wurde zwischenzeitlich geändert'; END IF;
 RETURN target;
END $$;
REVOKE ALL ON FUNCTION public.list_election_history_deputies(text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_election_history_deputy(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_election_history_deputy(uuid[],text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_election_history_deputies(text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_election_history_deputy(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_election_history_deputy(uuid[],text,uuid) TO authenticated;
COMMIT;
