BEGIN;

DO $correction$
DECLARE
  mandate public.election_history_mandates;
  candidate uuid;
  greens text := public.resolve_history_faction('Grüne');
  nomination_source constant text := 'https://www.wannweil.de/rathaus/wahlen/LT-Wahl/2001/wahlvorschlaege.pdf';
  result_source constant text := 'https://www.statistischebibliothek.de/mir/servlets/MCRFileNodeServlet/BWMonografie_derivate_00004041/8032_01002.pdf';
  faction_history constant text := 'Vom Mandatsbeginn 2001 bis Januar 2005 Mitglied der Grünen-Fraktion. Ab dem 25. Januar 2005 Mitglied der CDU-Fraktion bis zum Ende des Mandats.';
BEGIN
  SELECT m.* INTO STRICT mandate
  FROM public.election_history_mandates m
  JOIN public.election_history_periods p ON p.id=m.period_id
  WHERE m.id='ec4b8ecf-4bfc-56cb-a78a-28fdab47e4a8' AND p.number=13 AND p.election_year=2001
    AND m.district_id='fff77e4c-28c1-5e84-a20a-38a28bd391a9'
    AND m.entry_type='election' AND m.mandate_type='list'
  FOR UPDATE OF p;

  -- Use the reviewed mandate identity, including the candidacy created by assembly.
  PERFORM set_config('app.assembling_election_history','on',true);
  SELECT c.id INTO candidate
  FROM public.election_history_candidacies c
  WHERE c.person_id=mandate.person_id AND c.period_id=mandate.period_id
    AND c.district_id=mandate.district_id AND c.ballot_type='candidate';

  IF candidate IS NOT NULL THEN
    -- Previously assembled CDU results refer to a different nomination.
    UPDATE public.election_history_candidacies
    SET party=greens, votes=NULL, vote_share=NULL, district_rank=NULL, outcome='list',
      source_url=nomination_source, result_origin=NULL, result_preliminary=NULL,
      result_data_release=NULL, result_notes=NULL, result_snapshot=NULL
    WHERE id=candidate AND public.history_result_party(party)='CDU';

    UPDATE public.election_history_candidacies
    SET outcome='list', source_url=coalesce(source_url,nomination_source)
    WHERE id=candidate AND party=greens;
  END IF;

  UPDATE public.election_history_mandates
  SET party=greens, party_label=NULL, notes=concat_ws(E'\n',nullif(notes,''),faction_history)
  WHERE id=mandate.id;

  PERFORM set_config('app.assembling_election_history','',true);
  PERFORM public.assemble_election_history(mandate.period_id);

  SELECT candidacy_id INTO STRICT candidate
  FROM public.election_history_mandates WHERE id=mandate.id;
  IF candidate IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.election_history_candidacies
    WHERE id=candidate AND party=greens AND outcome='list'
  ) THEN
    RAISE EXCEPTION 'Die Grüne Kandidatur 2001 konnte dem Mandat nicht zugeordnet werden';
  END IF;

  UPDATE public.election_history_candidacies
  SET source_url=nomination_source, vote_share=coalesce(vote_share,8.3),
    result_notes=coalesce(result_notes,result_source)
  WHERE id=candidate;

  UPDATE public.election_history_candidate_workbook_audit
  SET candidacy_id=candidate, status='existing'
  WHERE source_id='393afd5d-4804-513a-8c41-9c42c3865950';
END
$correction$;

DELETE FROM public.election_history_factions
WHERE result_code='CDU (bis Anfang 2005: Grüne)';

-- Include documented direct-mandate succession alongside the election result.
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
  'direct_succession_notes',coalesce((
   SELECT jsonb_agg(concat_ws(' · ',coalesce(person.name,m.person_name),m.notes) ORDER BY m.starts_on,m.id)
   FROM public.election_history_mandates m
   LEFT JOIN public.election_history_people person ON person.id=m.person_id
   WHERE m.period_id=s.period_id AND m.district_id=s.district_id
     AND m.mandate_type='direct' AND m.entry_type='succession' AND m.id<>s.id
     AND nullif(btrim(m.notes),'') IS NOT NULL
  ),'[]'::jsonb),
  'turnout',(SELECT to_jsonb(t) FROM turnout t)
 ) FROM selected s LEFT JOIN public.election_history_districts d ON d.id=s.district_id;
$profile_result$;

COMMIT;
