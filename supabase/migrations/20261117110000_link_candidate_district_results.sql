-- Read-only association: never rewrite candidacies, mandates or person identities.
CREATE OR REPLACE FUNCTION public.get_election_candidate_results(selected_period uuid, selected_district uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $function$
 WITH candidates AS (
  SELECT c.*, p.name AS person_name, lp.election_year,
   CASE WHEN c.party IN ('FDP/DVP','FDP') THEN 'FDP'
        WHEN upper(c.party) IN ('GRÜNE','BÜNDNIS 90/DIE GRÜNEN') THEN 'GRÜNE'
        WHEN upper(c.party)='AFD' THEN 'AfD' ELSE c.party END AS result_party
  FROM public.election_history_candidacies c
  JOIN public.election_history_periods lp ON lp.id=c.period_id AND lp.is_published
  JOIN public.election_history_districts d ON d.id=c.district_id AND d.period_id=c.period_id
  LEFT JOIN public.election_history_people p ON p.id=c.person_id
  WHERE c.period_id=$1 AND c.district_id=$2
 ), eligible AS (
  SELECT c.*, count(*) OVER (PARTITION BY result_party) AS party_candidates
  FROM candidates c
  WHERE (election_year<2026 AND ballot_type='candidate') OR (election_year>=2026 AND ballot_type='first_vote')
 ), rows AS (
  SELECT c.id AS candidacy_id,c.person_id,c.person_name,c.party,c.votes,c.vote_share,c.ballot_type,
   CASE WHEN e.id IS NULL THEN 'ballot_mismatch'
        WHEN e.party_candidates<>1 THEN 'ambiguous'
        WHEN r.year IS NULL THEN 'missing' ELSE 'linked' END AS link_status,
   CASE WHEN r.year IS NOT NULL THEN jsonb_build_object(
    'ballot',r.ballot,'votes',r.votes,'share',r.share,'preliminary',r.preliminary,
    'data_release',r.data_release,'notes',r.notes) ELSE NULL END AS district_result
  FROM candidates c
  LEFT JOIN eligible e ON e.id=c.id
  LEFT JOIN public.election_analysis_versions v ON v.historical_district_id=c.district_id
   AND v.history_link_verified AND v.year=c.election_year
  LEFT JOIN public.election_analysis_years y ON y.year=v.year AND y.period_id=c.period_id AND y.is_published
  LEFT JOIN public.election_analysis_districts r ON r.year=y.year AND r.district_number=v.district_number
   AND r.party=c.result_party AND e.party_candidates=1
   AND r.ballot=CASE WHEN c.election_year<2026 THEN 'single' ELSE 'first' END
  ORDER BY c.party,c.person_name,c.id LIMIT 201
 ) SELECT coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) FROM rows;
$function$;
REVOKE ALL ON FUNCTION public.get_election_candidate_results(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_election_candidate_results(uuid,uuid) TO authenticated;
