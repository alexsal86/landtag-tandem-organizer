BEGIN;
-- Read-only extension: reuse existing facts, publication policies and explicit versions.
CREATE FUNCTION public.get_analysis_turnout_comparison(before_year integer,after_year integer,before_ballot text,after_ballot text,selected_party text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF before_year IS NULL OR after_year IS NULL OR before_year=after_year THEN RAISE EXCEPTION 'Zwei unterschiedliche Wahljahre auswählen'; END IF;
 IF selected_party IS NULL OR selected_party NOT IN('GRÜNE','CDU','SPD','FDP','AfD') THEN RAISE EXCEPTION 'Ungültige Partei'; END IF;
 IF before_ballot IS NULL OR after_ballot IS NULL OR before_ballot NOT IN('single','first','second') OR after_ballot NOT IN('single','first','second') THEN RAISE EXCEPTION 'Ungültige Stimmenart'; END IF;
 IF (before_year<2026 AND before_ballot<>'single') OR (after_year<2026 AND after_ballot<>'single') OR (before_year>=2026 AND before_ballot='single') OR (after_year>=2026 AND after_ballot='single') THEN RAISE EXCEPTION 'Stimmenart passt nicht zum Wahljahr'; END IF;
 RETURN jsonb_build_object(
  'results',coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM public.election_analysis_districts d WHERE d.party=selected_party AND d.district_number BETWEEN 1 AND 70 AND ((d.year=before_year AND d.ballot=before_ballot) OR(d.year=after_year AND d.ballot=after_ballot))),'[]'::jsonb),
  'turnout',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.election_analysis_turnout t WHERE t.district_number BETWEEN 1 AND 70 AND ((t.year=before_year AND t.ballot=before_ballot) OR(t.year=after_year AND t.ballot=after_ballot))),'[]'::jsonb),
  'state','[]'::jsonb,
  'versions',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM public.election_analysis_versions v WHERE v.year IN(before_year,after_year) AND v.district_number BETWEEN 1 AND 70),'[]'::jsonb)
 );
END $$;
REVOKE ALL ON FUNCTION public.get_analysis_turnout_comparison(integer,integer,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_analysis_turnout_comparison(integer,integer,text,text,text) TO authenticated;
COMMIT;
