BEGIN;

-- Reviewed spellings in the WP17 PARLIS export and mandate register.
-- The raw author fields and the cross-period mandate histories are untouched.
WITH aliases (source_key, mandate_key, only_proceeding) AS (
  VALUES
    ('gabriele rolland', 'gabi rolland', NULL),
    ('josef frey', 'josha frey', NULL),
    ('nikolai reith', 'niko reith', NULL),
    ('alena fink-trauschel', 'alena trauschel', NULL),
    ('klaus martin burger', 'klaus burger', NULL),
    ('christine neumann-martin', 'christine neumann', NULL),
    ('michael joukov-schwelling', 'michael joukov', NULL),
    ('hans-ulrich sckerl', 'uli sckerl', NULL),
    ('n stefan fulst-blei', 'stefan fulst-blei', 'V-240774')
), authors AS MATERIALIZED (
  SELECT DISTINCT p.vorgangs_id, p.datum, a.source_key, a.mandate_key,
    public.history_result_party(match[2]) AS faction
  FROM public.parlis_proceedings p
  CROSS JOIN LATERAL regexp_matches(
    p.urheber, '(?:^|,)[[:space:]]*([^,()]+?)[[:space:]]+\(([^()]+)\)(?=[[:space:]]*(?:,|u\.[[:space:]]*a\.|$))', 'gi'
  ) AS match
  JOIN aliases a ON a.source_key = public.history_list_person_key(match[1])
    AND (a.only_proceeding IS NULL OR p.vorgangs_id = a.only_proceeding)
  WHERE p.legislature = 17 AND p.datum IS NOT NULL
), mandates AS MATERIALIZED (
  SELECT m.id,
    coalesce(m.starts_on, p.starts_on) AS starts_on,
    coalesce(m.ends_on, p.ends_on, 'infinity'::date) AS ends_on,
    public.history_list_person_key(m.person_name) AS mandate_name,
    public.history_list_person_key(person.name) AS person_name,
    public.history_result_party(coalesce(nullif(btrim(m.party_label), ''), m.party)) AS faction
  FROM public.election_history_periods p
  JOIN public.election_history_mandates m ON m.period_id = p.id
  LEFT JOIN public.election_history_people person ON person.id = m.person_id
  WHERE p.number = 17
), candidates AS (
  SELECT a.vorgangs_id, m.id, a.faction AS author_faction, m.faction AS mandate_faction,
    count(*) OVER (PARTITION BY a.vorgangs_id, a.source_key, a.faction) AS matches
  FROM authors a JOIN mandates m
    ON a.datum BETWEEN m.starts_on AND m.ends_on
    AND (a.source_key IN (m.mandate_name, m.person_name) OR a.mandate_key IN (m.mandate_name, m.person_name))
)
INSERT INTO public.parlis_deputy_mandates (legislature, vorgangs_id, mandate_id)
SELECT DISTINCT 17, vorgangs_id, id
FROM candidates WHERE matches = 1 AND author_faction = mandate_faction
ON CONFLICT DO NOTHING;

REFRESH MATERIALIZED VIEW public.parlis_wp17_deputy_activity;
REFRESH MATERIALIZED VIEW public.parlis_initiative_rankings;

COMMIT;
