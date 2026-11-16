BEGIN;
CREATE OR REPLACE FUNCTION public.inherit_election_mandate_dates() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p public.election_history_periods; eligible_end boolean;
BEGIN
 -- A pure connection change cannot affect mandate dates or person identity.
 IF TG_OP='UPDATE' AND NEW.connection_id IS DISTINCT FROM OLD.connection_id
    AND (to_jsonb(NEW)-'connection_id') IS NOT DISTINCT FROM (to_jsonb(OLD)-'connection_id') THEN
   RETURN NEW;
 END IF;
 SELECT * INTO p FROM public.election_history_periods WHERE id=NEW.period_id FOR UPDATE;
 eligible_end := NOT NEW.left_early AND coalesce(NEW.notes,'') !~* '(ausgeschieden|niedergelegt|verstorben|gestorben|Mandatsverzicht)';
 IF TG_OP='UPDATE' THEN
   -- A changed individual date overrides inheritance. Period propagation writes
   -- the new period value with its inheritance flag intact.
   IF NEW.starts_on IS DISTINCT FROM OLD.starts_on AND NEW.starts_on IS DISTINCT FROM p.starts_on THEN
     NEW.start_from_period := false;
   END IF;
   IF NEW.ends_on IS DISTINCT FROM OLD.ends_on AND NEW.ends_on IS DISTINCT FROM p.ends_on THEN
     NEW.end_from_period := false;
   END IF;
 END IF;
 IF NEW.entry_type='election' THEN
   IF NEW.start_from_period OR (NEW.starts_on IS NULL AND p.starts_on IS NOT NULL) THEN
     NEW.starts_on := p.starts_on;
     NEW.start_from_period := true;
   END IF;
 ELSIF NEW.start_from_period THEN
   NEW.starts_on := NULL;
   NEW.start_from_period := false;
 END IF;
 IF eligible_end THEN
   IF NEW.end_from_period OR (NEW.ends_on IS NULL AND p.ends_on IS NOT NULL) THEN
     NEW.ends_on := p.ends_on;
     NEW.end_from_period := true;
   END IF;
 ELSIF NEW.end_from_period THEN
   NEW.ends_on := NULL;
   NEW.end_from_period := false;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_election_history_dates() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p public.election_history_periods;
BEGIN
 -- A pure connection change cannot affect mandate dates or person identity.
 IF TG_OP='UPDATE' AND NEW.connection_id IS DISTINCT FROM OLD.connection_id
    AND (to_jsonb(NEW)-'connection_id') IS NOT DISTINCT FROM (to_jsonb(OLD)-'connection_id') THEN
   RETURN NEW;
 END IF;
 SELECT * INTO p FROM public.election_history_periods WHERE id=NEW.period_id FOR UPDATE;
 IF NEW.starts_on < p.starts_on OR (p.ends_on IS NOT NULL AND (NEW.starts_on>p.ends_on OR NEW.ends_on>p.ends_on)) THEN
   RAISE EXCEPTION 'Mandatszeitraum liegt außerhalb der Legislaturperiode';
 END IF;
 -- Unknown starts are not invented, and therefore cannot be used to prove overlap.
 IF NEW.starts_on IS NOT NULL AND EXISTS (SELECT 1 FROM public.election_history_mandates m
   WHERE m.period_id=NEW.period_id AND m.id<>NEW.id AND m.starts_on IS NOT NULL
     AND ((NEW.person_id IS NOT NULL AND m.person_id=NEW.person_id) OR (NEW.mandate_type='direct' AND m.mandate_type='direct' AND m.district_id=NEW.district_id))
     AND daterange(m.starts_on,coalesce(m.ends_on,p.ends_on)+1,'[)') && daterange(NEW.starts_on,coalesce(NEW.ends_on,p.ends_on)+1,'[)')) THEN
   RAISE EXCEPTION 'Person oder Direktmandat hat bereits einen überlappenden Mandatsabschnitt';
 END IF;
 IF NEW.candidacy_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.election_history_candidacies c WHERE c.id=NEW.candidacy_id
   AND ((NEW.entry_type='election' AND c.outcome<>NEW.mandate_type) OR c.district_id IS DISTINCT FROM NEW.district_id)) THEN
   RAISE EXCEPTION 'Mandat und Kandidatur passen nicht zusammen';
 END IF;
 RETURN NEW;
END $$;

-- User-authorized consolidation by exact name and faction (party fallback).
-- Only connection_id changes: no persons are created, renamed or reassigned.
LOCK TABLE public.election_history_mandates IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE g record; target uuid; previous uuid[];
BEGIN
 FOR g IN
   SELECT lower(btrim(coalesce(m.person_name,p.name))) AS name_key,
     lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party))) AS faction_key
   FROM public.election_history_mandates m LEFT JOIN public.election_history_people p ON p.id=m.person_id
   GROUP BY 1,2 ORDER BY 1,2
 LOOP
   SELECT array_agg(DISTINCT m.connection_id) FILTER (WHERE m.connection_id IS NOT NULL)
     INTO previous
   FROM public.election_history_mandates m LEFT JOIN public.election_history_people p ON p.id=m.person_id
   WHERE lower(btrim(coalesce(m.person_name,p.name)))=g.name_key
     AND lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))=g.faction_key;
   SELECT id INTO target FROM unnest(previous) AS connections(id) ORDER BY id LIMIT 1;
   target := coalesce(target,gen_random_uuid());
   UPDATE public.election_history_mandates m SET connection_id=target
   WHERE m.connection_id IS DISTINCT FROM target AND (
     m.connection_id=ANY(previous)
     OR (lower(btrim(coalesce(m.person_name,(SELECT p.name FROM public.election_history_people p WHERE p.id=m.person_id))))=g.name_key
       AND lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))=g.faction_key)
   );
 END LOOP;
END $$;

-- Newly added matching mandates join the same history automatically. Renaming
-- or correcting a connected mandate preserves its already confirmed history.
CREATE FUNCTION public.assign_election_mandate_connection() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE display_name text; faction text;
BEGIN
 IF NEW.connection_id IS NOT NULL THEN RETURN NEW; END IF;
 display_name := lower(btrim(coalesce(NEW.person_name,(SELECT p.name FROM public.election_history_people p WHERE p.id=NEW.person_id))));
 faction := lower(btrim(coalesce(nullif(btrim(NEW.party_label),''),NEW.party)));
 PERFORM pg_advisory_xact_lock(hashtextextended(display_name || chr(31) || faction,0));
 SELECT m.connection_id INTO NEW.connection_id
 FROM public.election_history_mandates m LEFT JOIN public.election_history_people p ON p.id=m.person_id
 WHERE m.id<>NEW.id AND m.connection_id IS NOT NULL
   AND lower(btrim(coalesce(m.person_name,p.name)))=display_name
   AND lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))=faction
 ORDER BY m.id LIMIT 1;
 NEW.connection_id := coalesce(NEW.connection_id,gen_random_uuid());
 RETURN NEW;
END $$;
CREATE TRIGGER election_history_assign_connection BEFORE INSERT OR UPDATE OF person_name,person_id,party,party_label
 ON public.election_history_mandates FOR EACH ROW EXECUTE FUNCTION public.assign_election_mandate_connection();

CREATE OR REPLACE FUNCTION public.list_election_history_deputies(search_text text DEFAULT '', page_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen das Abgeordnetenregister öffnen' USING ERRCODE='42501'; END IF;
 RETURN (WITH entries AS (
   SELECT m.*, coalesce(m.person_name,p.name) AS display_name,
     coalesce(nullif(btrim(m.party_label),''),m.party) AS faction,
     coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))) AS history_key
   FROM public.election_history_mandates m LEFT JOIN public.election_history_people p ON p.id=m.person_id
 ), matching AS (
   SELECT DISTINCT history_key FROM entries
   WHERE strpos(lower(display_name),lower(btrim(coalesce(search_text,''))))>0
 ) SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM (
   SELECT e.history_key AS name_key, min(e.display_name) AS name,
     array_agg(DISTINCT e.faction ORDER BY e.faction) AS parties,
     count(*) AS mandates, count(DISTINCT e.period_id) AS periods,
     count(*) FILTER (WHERE e.connection_id IS NULL) AS unlinked
   FROM entries e JOIN matching USING(history_key)
   GROUP BY e.history_key ORDER BY lower(min(e.display_name)),e.history_key
   LIMIT 26 OFFSET greatest(0,page_offset)
 ) g);
END $$;
CREATE OR REPLACE FUNCTION public.get_election_history_deputy(name_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen das Abgeordnetenregister öffnen' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.period_number,g.starts_on NULLS FIRST,g.id), '[]'::jsonb) FROM (
   SELECT m.id,m.person_id,m.connection_id,coalesce(m.person_name,p.name) AS name,m.party,m.party_label,
     lp.name AS period_name,lp.number AS period_number,m.starts_on,m.ends_on,
     m.entry_type,m.mandate_type,m.original_mandate,m.left_early,m.notes,
     (m.end_from_period AND lp.ends_on_is_expected) AS end_is_expected,
     d.name AS district_name,coalesce(d.number_label,d.district_number::text) AS district_label,p.name AS linked_name
   FROM public.election_history_mandates m
   JOIN public.election_history_periods lp ON lp.id=m.period_id
   LEFT JOIN public.election_history_people p ON p.id=m.person_id
   LEFT JOIN public.election_history_districts d ON d.id=m.district_id
   WHERE coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party))))=name_key
   ORDER BY lp.number,m.starts_on NULLS FIRST,m.id LIMIT 201
 ) g);
END $$;
-- Apply the authorized exact-match rule to future imports as well.
CREATE FUNCTION public.connect_matching_election_history_mandate() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE source_name text; source_faction text; target uuid;
BEGIN
 source_name := lower(btrim(coalesce(NEW.person_name,(SELECT name FROM public.election_history_people WHERE id=NEW.person_id))));
 source_faction := lower(btrim(coalesce(nullif(btrim(NEW.party_label),''),NEW.party)));
 IF nullif(source_name,'') IS NULL OR nullif(source_faction,'') IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array(source_name,source_faction)::text,0));
 SELECT m.connection_id INTO target FROM public.election_history_mandates m
 LEFT JOIN public.election_history_people p ON p.id=m.person_id
 WHERE m.id<>NEW.id AND m.connection_id IS NOT NULL
   AND lower(btrim(coalesce(m.person_name,p.name)))=source_name
   AND lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))=source_faction
 ORDER BY m.connection_id,m.id LIMIT 1;
 NEW.connection_id := coalesce(target,gen_random_uuid());
 RETURN NEW;
END $$;
CREATE TRIGGER b_election_history_connect_matching
 BEFORE INSERT OR UPDATE OF person_name,person_id,party,party_label ON public.election_history_mandates
 FOR EACH ROW WHEN (NEW.connection_id IS NULL)
 EXECUTE FUNCTION public.connect_matching_election_history_mandate();
REVOKE ALL ON FUNCTION public.list_election_history_deputies(text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_election_history_deputy(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_election_history_deputies(text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_election_history_deputy(text) TO authenticated;
COMMIT;
