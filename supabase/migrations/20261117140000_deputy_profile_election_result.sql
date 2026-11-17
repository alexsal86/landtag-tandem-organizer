-- Only the selected published mandate/district; no mutations or name matching.
CREATE OR REPLACE FUNCTION public.get_analysis_deputy_election_result(selected_mandate uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $profile_result$
 WITH selected AS (
  SELECT m.*,p.election_year,p.number AS period_number,
   CASE WHEN p.election_year>=2026 THEN 'first' ELSE 'single' END AS ballot
  FROM public.election_history_mandates m
  JOIN public.election_history_periods p ON p.id=m.period_id AND p.is_published
  WHERE m.id=$1
 ), candidates AS (
  SELECT c.id,p.name,c.person_id,public.history_result_party(c.party) AS party,c.votes,c.vote_share AS share,
   c.result_preliminary AS preliminary,c.result_data_release AS data_release,c.result_notes AS notes,
   c.source_url,(c.id=s.candidacy_id OR (s.candidacy_id IS NULL AND c.person_id=s.person_id)) AS is_own
  FROM selected s JOIN public.election_history_candidacies c ON c.period_id=s.period_id AND c.district_id=s.district_id
   AND c.ballot_type=CASE WHEN s.ballot='first' THEN 'first_vote' ELSE 'candidate' END
  LEFT JOIN public.election_history_people p ON p.id=c.person_id
 ), version AS (
  SELECT v.* FROM selected s JOIN public.election_analysis_years y ON y.year=s.election_year
   AND y.period_id=s.period_id AND y.period_number=s.period_number AND y.is_published
  JOIN public.election_analysis_versions v ON v.year=y.year AND v.historical_district_id=s.district_id AND v.history_link_verified
 ), results AS (
  SELECT r.party,r.votes,r.share,r.preliminary,r.data_release,r.notes
  FROM selected s JOIN version v ON true
  JOIN public.election_analysis_districts r ON r.year=v.year AND r.district_number=v.district_number AND r.ballot=s.ballot
  WHERE coalesce(r.notes,'') NOT ILIKE '%Zuschnitt 2011%'
 ), turnout AS (
  SELECT t.valid_votes,t.data_release,t.preliminary FROM selected s JOIN version v ON true
  JOIN public.election_analysis_turnout t ON t.year=v.year AND t.district_number=v.district_number AND t.ballot=s.ballot
 ) SELECT jsonb_build_object(
  'mandate_id',s.id,'period_number',s.period_number,'ballot',s.ballot,'entry_type',s.entry_type,
  'mandate_type',s.mandate_type,'district_name',d.name,
  'candidates',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.party,c.id) FROM candidates c),'[]'::jsonb),
  'results',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.party) FROM results r),'[]'::jsonb),
  'turnout',(SELECT to_jsonb(t) FROM turnout t)
 ) FROM selected s LEFT JOIN public.election_history_districts d ON d.id=s.district_id;
$profile_result$;
REVOKE ALL ON FUNCTION public.get_analysis_deputy_election_result(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_analysis_deputy_election_result(uuid) TO authenticated;
