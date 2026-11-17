BEGIN;
-- Candidates share the existing person identity with earlier/later mandates.
-- Creating a candidate person is explicit; a name never merges existing people.
CREATE FUNCTION public.create_election_candidate_person(person_name text,identity_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE created public.election_history_people;
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen Kandidierende erfassen' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(person_name),'') IS NULL OR length(btrim(person_name))>300 OR length(coalesce(identity_note,''))>2000 THEN RAISE EXCEPTION 'Bitte einen gültigen Namen und Identifikationshinweis angeben.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(person_name)),0));
 IF EXISTS(SELECT 1 FROM public.election_history_people WHERE lower(btrim(name))=lower(btrim(person_name))) AND length(btrim(coalesce(identity_note,'')))<4 THEN
   RAISE EXCEPTION 'Eine namensgleiche Person ist bereits vorhanden. Bitte diese auswählen oder die neue Person durch einen Identifikationshinweis unterscheiden.';
 END IF;
 INSERT INTO public.election_history_people(name,biography) VALUES(btrim(person_name),nullif(btrim(identity_note),'')) RETURNING * INTO created;
 RETURN to_jsonb(created);
END $$;
CREATE FUNCTION public.search_election_person_careers(search_text text DEFAULT '',page_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen das Personenverzeichnis öffnen' USING ERRCODE='42501'; END IF;
 RETURN(WITH people AS (
  SELECT p.id,p.name,p.biography FROM public.election_history_people p
  WHERE strpos(lower(p.name||' '||coalesce(p.biography,'')),lower(btrim(coalesce(search_text,''))))>0
  ORDER BY lower(p.name),p.id LIMIT 26 OFFSET greatest(0,page_offset)
 ) SELECT coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) FROM(
  SELECT p.*,(SELECT count(*) FROM public.election_history_candidacies c WHERE c.person_id=p.id) AS candidacy_count,
   (SELECT count(DISTINCT m.period_id) FROM public.election_history_mandates m WHERE m.person_id=p.id) AS mandate_period_count
  FROM people p ORDER BY lower(p.name),p.id
 )g);
END $$;
CREATE FUNCTION public.get_election_person_career(person uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen vollständige Personenlaufbahnen öffnen' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('person',(SELECT to_jsonb(p) FROM public.election_history_people p WHERE p.id=$1),
 'candidacies',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.period_number,g.id) FROM(
  SELECT c.*,lp.number AS period_number,lp.name AS period_name,d.name AS district_name,coalesce(d.number_label,d.district_number::text) AS district_label
  FROM public.election_history_candidacies c JOIN public.election_history_periods lp ON lp.id=c.period_id
  LEFT JOIN public.election_history_districts d ON d.id=c.district_id WHERE c.person_id=$1
  ORDER BY lp.number,c.id LIMIT 201
 )g),'[]'::jsonb),
 'mandates',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.period_number,g.starts_on NULLS FIRST,g.id) FROM(
  SELECT m.*,lp.number AS period_number,lp.name AS period_name,d.name AS district_name,coalesce(d.number_label,d.district_number::text) AS district_label,
   (m.end_from_period AND lp.ends_on_is_expected) AS end_is_expected
  FROM public.election_history_mandates m JOIN public.election_history_periods lp ON lp.id=m.period_id
  LEFT JOIN public.election_history_districts d ON d.id=m.district_id WHERE m.person_id=$1
  ORDER BY lp.number,m.starts_on NULLS FIRST,m.id LIMIT 201
 )g),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.create_election_candidate_person(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_election_person_careers(text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_election_person_career(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_election_candidate_person(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_election_person_careers(text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_election_person_career(uuid) TO authenticated;
COMMIT;
