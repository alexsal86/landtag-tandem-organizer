-- Rebuild after correcting the closed period's import or mandate links:
-- REFRESH MATERIALIZED VIEW public.parlis_initiative_rankings;
CREATE MATERIALIZED VIEW public.parlis_initiative_rankings AS
WITH initiatives AS MATERIALIZED (
  SELECT vorgangs_id, vorgangstyp, urheber, ressort
  FROM public.parlis_proceedings
  WHERE legislature = 17 AND vorgangstyp IN ('Kleine Anfrage', 'Große Anfrage', 'Antrag')
), deputies AS (
  SELECT coalesce(m.connection_id::text, 'name:' || lower(btrim(coalesce(m.person_name, person.name))) ||
    chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label), ''), m.party)))) AS profile_key,
    coalesce(m.person_name, person.name) AS deputy_name
  FROM public.election_history_mandates m
  JOIN public.election_history_periods p ON p.id = m.period_id AND p.number = 17
  LEFT JOIN public.election_history_people person ON person.id = m.person_id
), deputy_counts AS (
  SELECT d.profile_key, min(d.deputy_name) AS name,
    count(DISTINCT i.vorgangs_id)::integer AS amount
  FROM deputies d
  LEFT JOIN public.parlis_deputy_profiles link
    ON link.legislature = 17 AND link.profile_key = d.profile_key
  LEFT JOIN initiatives i ON i.vorgangs_id = link.vorgangs_id
  WHERE d.profile_key IS NOT NULL AND nullif(btrim(d.deputy_name), '') IS NOT NULL
  GROUP BY d.profile_key
), faction_attribution AS MATERIALIZED (
  -- PARLIS names factions directly and supplies the affiliation of named
  -- authors. Multiple authors of one faction still represent one initiative.
  SELECT DISTINCT i.vorgangs_id, CASE upper(labels[1])
    WHEN 'FDP' THEN 'FDP/DVP'
    WHEN 'AFD' THEN 'AfD'
    WHEN 'BÜNDNIS 90/DIE GRÜNEN' THEN 'GRÜNE'
    ELSE upper(labels[1])
  END AS faction
  FROM initiatives i
  CROSS JOIN LATERAL regexp_matches(i.urheber,
    '(?:\([[:space:]]*|\mFraktion[[:space:]]+(?:(?:der|des)[[:space:]]+)?)(CDU|SPD|GRÜNE|BÜNDNIS 90/DIE GRÜNEN|FDP/DVP|FDP|AfD)(?=[[:space:]]*(?:\)|,|$))', 'gi') AS labels
), faction_counts AS (
  SELECT faction AS name, count(*)::integer AS amount
  FROM faction_attribution GROUP BY faction
), ministry_counts AS (
  SELECT ressort AS name, count(*)::integer AS amount
  FROM initiatives
  WHERE ressort LIKE 'Ministerium %' OR ressort = 'Staatsministerium'
  GROUP BY ressort
)
SELECT 17 AS legislature, jsonb_build_object(
  'total', (SELECT count(*) FROM initiatives),
  'kinds', (SELECT jsonb_object_agg(k.vorgangstyp, k.amount) FROM (
    SELECT vorgangstyp, count(*) AS amount FROM initiatives GROUP BY vorgangstyp
  ) k),
  'deputiesMost', coalesce((SELECT jsonb_agg(jsonb_build_array(d.profile_key,d.name,d.amount) ORDER BY d.amount DESC,d.name,d.profile_key)
    FROM (SELECT * FROM deputy_counts ORDER BY amount DESC,name,profile_key LIMIT 10) d), '[]'),
  'deputiesLeast', coalesce((SELECT jsonb_agg(jsonb_build_array(d.profile_key,d.name,d.amount) ORDER BY d.amount,d.name,d.profile_key)
    FROM (SELECT * FROM deputy_counts ORDER BY amount,name,profile_key LIMIT 10) d), '[]'),
  'factions', coalesce((SELECT jsonb_agg(jsonb_build_array(name,amount) ORDER BY amount DESC,name)
    FROM faction_counts), '[]'),
  'ministries', coalesce((SELECT jsonb_agg(jsonb_build_array(name,amount) ORDER BY amount DESC,name)
    FROM ministry_counts), '[]'),
  'withoutFaction', (SELECT count(*) FROM initiatives) - (SELECT count(DISTINCT vorgangs_id) FROM faction_attribution),
  'withoutMinistry', (SELECT count(*) FROM initiatives) - coalesce((SELECT sum(amount) FROM ministry_counts), 0)
) AS rankings
WHERE EXISTS (SELECT FROM initiatives);

CREATE UNIQUE INDEX parlis_initiative_rankings_period_key ON public.parlis_initiative_rankings (legislature);
REVOKE ALL ON public.parlis_initiative_rankings FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_parlis_initiative_rankings(period integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.rankings FROM public.parlis_initiative_rankings r
  WHERE r.legislature = period
    AND EXISTS (
      SELECT FROM public.election_history_periods p WHERE p.number = period AND p.is_published
    );
$$;
REVOKE ALL ON FUNCTION public.get_parlis_initiative_rankings(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_parlis_initiative_rankings(integer) TO authenticated;
