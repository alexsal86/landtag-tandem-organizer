BEGIN;
-- Filter before pagination; aggregate the full published history for tenure marks.
-- Keep existing connection identities and publication/RLS restrictions.
DROP FUNCTION public.list_analysis_deputies(text,integer);
CREATE FUNCTION public.list_analysis_deputies(search_text text DEFAULT '', page_offset integer DEFAULT 0, selected_period uuid DEFAULT NULL, faction_text text DEFAULT '', selected_mandate text DEFAULT '')
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
     AND (selected_period IS NULL OR period_id=selected_period)
     AND strpos(lower(faction),lower(btrim(coalesce(faction_text,''))))>0
     AND (coalesce(selected_mandate,'')='' OR mandate_type=selected_mandate)
 ) SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM (
   SELECT e.history_key AS name_key, min(e.display_name) AS name,
     array_agg(DISTINCT e.faction ORDER BY e.faction) AS parties,
     count(*) AS mandates, count(DISTINCT e.period_id) AS periods,
     count(*) FILTER (WHERE e.connection_id IS NULL) AS unlinked,
     (SELECT jsonb_build_object('party',x.faction,'district',d.name,'mandate_type',x.mandate_type,'period_number',lp.number)
      FROM entries x JOIN public.election_history_periods lp ON lp.id=x.period_id
      LEFT JOIN public.election_history_districts d ON d.id=x.district_id
      WHERE x.history_key=e.history_key AND (selected_period IS NULL OR x.period_id=selected_period)
        AND strpos(lower(x.faction),lower(btrim(coalesce(faction_text,''))))>0
        AND (coalesce(selected_mandate,'')='' OR x.mandate_type=selected_mandate)
      ORDER BY lp.number DESC,x.starts_on DESC NULLS LAST,x.id LIMIT 1) AS latest
   FROM entries e JOIN matching USING(history_key)
   GROUP BY e.history_key ORDER BY lower(min(e.display_name)),e.history_key
   LIMIT 26 OFFSET greatest(0,page_offset)
 ) g);
END $$;
REVOKE ALL ON FUNCTION public.list_analysis_deputies(text,integer,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_analysis_deputies(text,integer,uuid,text,text) TO authenticated;
COMMIT;
