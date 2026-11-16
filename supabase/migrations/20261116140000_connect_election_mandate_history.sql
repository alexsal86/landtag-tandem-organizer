BEGIN;
-- A mandate connection is independent of the person register. This workflow
-- never creates a person or changes an existing person assignment.
ALTER TABLE public.election_history_mandates ADD COLUMN connection_id uuid;
CREATE INDEX election_history_mandate_connection ON public.election_history_mandates(connection_id)
 WHERE connection_id IS NOT NULL;
COMMENT ON COLUMN public.election_history_mandates.connection_id IS
 'Explicitly confirmed mandate-history group; current dates remain on each mandate.';
CREATE FUNCTION public.connect_election_history_mandates(mandate_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE chosen integer; target uuid; identities uuid[]; connections uuid[];
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN
   RAISE EXCEPTION 'Nur Super-Admins dürfen Mandate verbinden' USING ERRCODE='42501';
 END IF;
 chosen := cardinality(mandate_ids);
 IF chosen IS NULL OR chosen<2 OR chosen>200
    OR (SELECT count(DISTINCT id) FROM unnest(mandate_ids) AS selected(id))<>chosen THEN
   RAISE EXCEPTION 'Bitte mindestens zwei unterschiedliche Mandate auswählen';
 END IF;
 PERFORM id FROM public.election_history_mandates WHERE id=ANY(mandate_ids) ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM public.election_history_mandates WHERE id=ANY(mandate_ids))<>chosen THEN
   RAISE EXCEPTION 'Ein ausgewähltes Mandat existiert nicht mehr. Bitte neu laden.';
 END IF;
 SELECT array_agg(DISTINCT person_id) FILTER (WHERE person_id IS NOT NULL)
   INTO identities FROM public.election_history_mandates WHERE id=ANY(mandate_ids);
 IF cardinality(identities)>1 THEN
   RAISE EXCEPTION 'Diese Mandate gehören bereits zu verschiedenen bestätigten Verbindungen. Bestehende Verbindungen werden nicht überschrieben.';
 END IF;
 SELECT array_agg(DISTINCT connection_id) FILTER (WHERE connection_id IS NOT NULL)
   INTO connections FROM public.election_history_mandates WHERE id=ANY(mandate_ids);
 IF cardinality(connections)>1 THEN
   RAISE EXCEPTION 'Die Auswahl enthält verschiedene bestätigte Mandatsverbindungen. Bestehende Verbindungen werden nicht überschrieben.';
 END IF;
 target := coalesce(connections[1],gen_random_uuid());
 -- Stable mandate IDs, rather than copied dates, form the durable connection.
 -- Existing inheritance triggers propagate period dates; individual dates and
 -- early-exit intervals remain independent. Never write to the person register.
 UPDATE public.election_history_mandates SET connection_id=target
   WHERE id=ANY(mandate_ids) AND connection_id IS NULL;
 RETURN target;
END $$;
REVOKE ALL ON FUNCTION public.connect_election_history_mandates(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connect_election_history_mandates(uuid[]) TO authenticated;

-- Include previously connected rows even if an imported spelling is corrected.
CREATE OR REPLACE FUNCTION public.get_election_history_deputy(name_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen das Abgeordnetenregister öffnen' USING ERRCODE='42501'; END IF;
 RETURN (WITH anchors AS (
   SELECT DISTINCT m.person_id,m.connection_id FROM public.election_history_mandates m
   LEFT JOIN public.election_history_people p ON p.id=m.person_id
   WHERE lower(btrim(coalesce(m.person_name,p.name)))=name_key
 ) SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM (
   SELECT m.id, m.person_id, m.connection_id, coalesce(m.person_name,p.name) AS name, m.party,
     lp.name AS period_name, lp.number AS period_number, m.starts_on, m.ends_on,
     m.entry_type, d.name AS district_name, p.name AS linked_name
   FROM public.election_history_mandates m
   JOIN public.election_history_periods lp ON lp.id=m.period_id
   LEFT JOIN public.election_history_people p ON p.id=m.person_id
   LEFT JOIN public.election_history_districts d ON d.id=m.district_id
   WHERE lower(btrim(coalesce(m.person_name,p.name)))=name_key
      OR m.person_id IN (SELECT person_id FROM anchors)
      OR m.connection_id IN (SELECT connection_id FROM anchors)
   ORDER BY lp.number,m.starts_on NULLS FIRST,m.id LIMIT 201
 ) g);
END $$;
CREATE OR REPLACE FUNCTION public.list_election_history_deputies(search_text text DEFAULT '', page_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen das Abgeordnetenregister öffnen' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM (
   SELECT lower(btrim(coalesce(m.person_name,p.name))) AS name_key,
     min(coalesce(m.person_name,p.name)) AS name,
     array_agg(DISTINCT m.party ORDER BY m.party) AS parties,
     count(*) AS mandates, count(DISTINCT m.period_id) AS periods,
     count(*) FILTER (WHERE m.person_id IS NULL AND m.connection_id IS NULL) AS unlinked
   FROM public.election_history_mandates m LEFT JOIN public.election_history_people p ON p.id=m.person_id
   WHERE strpos(lower(coalesce(m.person_name,p.name)), lower(btrim(coalesce(search_text,'')))) > 0
   GROUP BY lower(btrim(coalesce(m.person_name,p.name)))
   ORDER BY name_key LIMIT 26 OFFSET greatest(0,page_offset)
 ) g);
END $$;
REVOKE ALL ON FUNCTION public.get_election_history_deputy(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_election_history_deputies(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_election_history_deputy(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_election_history_deputies(text,integer) TO authenticated;
COMMIT;
