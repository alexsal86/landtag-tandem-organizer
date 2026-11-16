BEGIN;
-- Read-only, bounded cross-period directory for Wahlanalyse. Explicit publication
-- filtering also hides drafts from Super Admins in this reader; invoker RLS stays active.
CREATE FUNCTION public.list_analysis_deputies(search_text text DEFAULT '', page_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 RETURN (WITH entries AS (
   SELECT m.*, coalesce(m.person_name,p.name) AS display_name,
     coalesce(nullif(btrim(m.party_label),''),m.party) AS faction,
     coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))) AS history_key
   FROM public.election_history_mandates m
   JOIN public.election_history_periods lp ON lp.id=m.period_id AND lp.is_published
   LEFT JOIN public.election_history_people p ON p.id=m.person_id
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
CREATE FUNCTION public.get_analysis_deputy(name_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.period_number,g.starts_on NULLS FIRST,g.id), '[]'::jsonb) FROM (
   SELECT m.id,m.person_id,m.connection_id,coalesce(m.person_name,p.name) AS name,m.party,m.party_label,
     lp.name AS period_name,lp.number AS period_number,m.starts_on,m.ends_on,
     m.entry_type,m.mandate_type,m.original_mandate,m.left_early,m.notes,
     (m.end_from_period AND lp.ends_on_is_expected) AS end_is_expected,
     d.name AS district_name,coalesce(d.number_label,d.district_number::text) AS district_label,p.name AS linked_name
   FROM public.election_history_mandates m
   JOIN public.election_history_periods lp ON lp.id=m.period_id AND lp.is_published
   LEFT JOIN public.election_history_people p ON p.id=m.person_id
   LEFT JOIN public.election_history_districts d ON d.id=m.district_id
   WHERE coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party))))=name_key
   ORDER BY lp.number,m.starts_on NULLS FIRST,m.id LIMIT 201
 ) g);
END $$;
REVOKE ALL ON FUNCTION public.list_analysis_deputies(text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_analysis_deputy(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_analysis_deputies(text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_analysis_deputy(text) TO authenticated;
COMMIT;
