BEGIN;

ALTER TABLE public.election_history_mandates
 ADD COLUMN subsequent_faction text REFERENCES public.election_history_factions(name)
 ON UPDATE CASCADE ON DELETE RESTRICT;

SELECT set_config('app.assembling_election_history','on',true);
UPDATE public.election_history_mandates
SET subsequent_faction=public.resolve_history_faction('CDU')
WHERE id='ec4b8ecf-4bfc-56cb-a78a-28fdab47e4a8';
SELECT set_config('app.assembling_election_history','',true);

CREATE OR REPLACE FUNCTION public.list_analysis_deputies(search_text text DEFAULT '', page_offset integer DEFAULT 0, selected_period uuid DEFAULT NULL, faction_text text DEFAULT '', selected_mandate text DEFAULT '')
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
     AND (strpos(lower(faction),lower(btrim(coalesce(faction_text,''))))>0
       OR strpos(lower(subsequent_faction),lower(btrim(coalesce(faction_text,''))))>0)
     AND (coalesce(selected_mandate,'')='' OR mandate_type=selected_mandate)
 ) SELECT coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM (
   SELECT e.history_key AS name_key, min(e.display_name) AS name,
     ARRAY(
       SELECT DISTINCT label
       FROM entries membership
       CROSS JOIN LATERAL unnest(ARRAY[membership.faction,membership.subsequent_faction]) AS faction_label(label)
       WHERE membership.history_key=e.history_key AND label IS NOT NULL
       ORDER BY label
     ) AS parties,
     count(*) AS mandates, count(DISTINCT e.period_id) AS periods,
     count(*) FILTER (WHERE e.connection_id IS NULL) AS unlinked,
     (SELECT jsonb_build_object('party',x.faction,'district',d.name,'mandate_type',x.mandate_type,'period_number',lp.number)
      FROM entries x JOIN public.election_history_periods lp ON lp.id=x.period_id
      LEFT JOIN public.election_history_districts d ON d.id=x.district_id
      WHERE x.history_key=e.history_key AND (selected_period IS NULL OR x.period_id=selected_period)
        AND (strpos(lower(x.faction),lower(btrim(coalesce(faction_text,''))))>0
          OR strpos(lower(x.subsequent_faction),lower(btrim(coalesce(faction_text,''))))>0)
        AND (coalesce(selected_mandate,'')='' OR x.mandate_type=selected_mandate)
      ORDER BY lp.number DESC,x.starts_on DESC NULLS LAST,x.id LIMIT 1) AS latest
   FROM entries e JOIN matching USING(history_key)
   GROUP BY e.history_key ORDER BY lower(min(e.display_name)),e.history_key
   LIMIT 26 OFFSET greatest(0,page_offset)
 ) g);
END $$;

CREATE OR REPLACE FUNCTION public.list_analysis_deputy_factions(selected_period uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(f.label ORDER BY lower(f.label),f.label),'[]'::jsonb)
  FROM (
    SELECT DISTINCT label
    FROM public.election_history_mandates m
    JOIN public.election_history_periods lp ON lp.id=m.period_id AND lp.is_published
    CROSS JOIN LATERAL unnest(ARRAY[coalesce(nullif(btrim(m.party_label),''),m.party),m.subsequent_faction]) AS faction_label(label)
    WHERE (selected_period IS NULL OR m.period_id=selected_period)
      AND nullif(btrim(label),'') IS NOT NULL
    ORDER BY label LIMIT 100
  ) f;
$$;

CREATE OR REPLACE FUNCTION public.get_analysis_deputy_election_result(selected_mandate uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $profile_result$
 WITH selected AS (
  SELECT m.*,p.election_year,p.number AS period_number,
   CASE WHEN p.election_year>=2026 THEN 'first' ELSE 'single' END AS ballot
  FROM public.election_history_mandates m
  JOIN public.election_history_periods p ON p.id=m.period_id AND p.is_published
  WHERE m.id=$1
 ), recorded_candidates AS (
  SELECT c.id,p.name,c.person_id,public.history_result_party(c.party) AS party,c.votes,c.vote_share AS share,
   c.result_preliminary AS preliminary,c.result_data_release AS data_release,c.result_notes AS notes,
   c.source_url,(c.id=s.candidacy_id OR (s.candidacy_id IS NULL AND c.person_id=s.person_id)) AS is_own
  FROM selected s JOIN public.election_history_candidacies c ON c.period_id=s.period_id AND c.district_id=s.district_id
   AND c.ballot_type=CASE WHEN s.ballot='first' THEN 'first_vote' ELSE 'candidate' END
  LEFT JOIN public.election_history_people p ON p.id=c.person_id
 ), candidates AS (
  SELECT * FROM recorded_candidates
  UNION ALL
  -- An unambiguous original direct mandate supplies the elected candidate's
  -- name when the candidacy record is missing. Successors never enter this list.
  SELECT m.id,coalesce(person.name,m.person_name),m.person_id,public.history_result_party(m.party),
   NULL::bigint,NULL::numeric,NULL::boolean,NULL::text,NULL::text,m.source_url,m.id=s.id
  FROM selected s
  JOIN public.election_history_mandates m ON m.period_id=s.period_id AND m.district_id=s.district_id
   AND m.entry_type='election' AND m.mandate_type='direct'
  LEFT JOIN public.election_history_people person ON person.id=m.person_id
  WHERE nullif(btrim(coalesce(person.name,m.person_name)),'') IS NOT NULL
    AND NOT EXISTS (
     SELECT 1 FROM public.election_history_mandates other
     WHERE other.period_id=m.period_id AND other.district_id=m.district_id
       AND other.entry_type='election' AND other.mandate_type='direct' AND other.id<>m.id
    )
    AND NOT EXISTS (
     SELECT 1 FROM recorded_candidates c
     WHERE c.party=public.history_result_party(m.party)
       AND (c.id=m.candidacy_id OR c.person_id=m.person_id)
    )
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
