-- Keep document payloads bounded, including when filters match an entire legislature.
CREATE FUNCTION public.parlis_page(
  period integer, page_offset integer DEFAULT 0, search_text text DEFAULT '',
  document_kind text DEFAULT '', faction text DEFAULT '', topic text DEFAULT '',
  date_from date DEFAULT NULL, date_to date DEFAULT NULL, deputy_key text DEFAULT NULL,
  oldest_first boolean DEFAULT false, chart_dimension text DEFAULT NULL,
  chart_selection text DEFAULT NULL, options_only boolean DEFAULT false
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH source AS NOT MATERIALIZED (
  SELECT p.vorgangs_id, p.datum, p.vorgangstyp, p.urheber, p.ressort, p.deskriptoren,
    p.titel, p.drucksache, p.pdf_url, p.dokument_url
  FROM public.parlis_proceedings p WHERE p.legislature = period
), candidates AS (
  SELECT p.vorgangs_id, p.datum, p.vorgangstyp, p.urheber, p.ressort, p.deskriptoren,
    CASE WHEN options_only OR faction <> '' THEN
      ARRAY(SELECT DISTINCT labels[1]
        FROM regexp_matches(p.urheber,
          '(?:\([[:space:]]*|\mFraktion[[:space:]]+(?:(?:der|des)[[:space:]]+)?)(CDU|SPD|GRÜNE|FDP/DVP|FDP|DVP|AfD|LINKE|DIE LINKE|BÜNDNIS 90/DIE GRÜNEN)(?=[[:space:]]*(?:\)|,|$))', 'gi') AS labels)
    END AS parties
  FROM source p
  WHERE options_only OR (
    (document_kind = '' OR p.vorgangstyp = document_kind)
    AND (date_from IS NULL OR p.datum >= date_from)
    AND (date_to IS NULL OR p.datum <= date_to)
    AND (topic = '' OR EXISTS (SELECT FROM unnest(string_to_array(p.deskriptoren, ';')) AS tag WHERE btrim(tag) = topic))
    AND (deputy_key IS NULL OR EXISTS (
      SELECT FROM public.parlis_deputy_profiles d
      WHERE d.legislature = period AND d.vorgangs_id = p.vorgangs_id AND d.profile_key = deputy_key
    ))
    AND NOT EXISTS (
      SELECT FROM regexp_split_to_table(lower(btrim(search_text)), '[[:space:]]+') AS term
      WHERE strpos(lower(concat_ws(' ', p.titel, p.drucksache, p.vorgangs_id, p.vorgangstyp, p.urheber,
        p.ressort, p.deskriptoren, p.datum::text)), term) = 0
    )
  )
), matches AS (
  SELECT c.* FROM candidates c
  WHERE options_only OR faction = '' OR
    CASE WHEN faction = '__unknown' THEN cardinality(c.parties) = 0 ELSE faction = ANY(c.parties) END
), groups AS (
  SELECT m.vorgangs_id, k.label
  FROM matches m
  CROSS JOIN LATERAL (
    SELECT DISTINCT coalesce(nullif(btrim(label), ''), 'Ohne Angabe') AS label
    FROM unnest(CASE chart_dimension
      WHEN 'datum' THEN ARRAY[to_char(m.datum, 'YYYY-MM')]
      WHEN 'vorgangstyp' THEN ARRAY[m.vorgangstyp]
      WHEN 'ressort' THEN ARRAY[m.ressort]
      WHEN 'urheber' THEN ARRAY[m.urheber]
      WHEN 'deskriptoren' THEN string_to_array(m.deskriptoren, ';')
      ELSE ARRAY[]::text[]
    END) AS label
    WHERE label IS NULL OR btrim(label) <> '' OR chart_dimension <> 'deskriptoren'
    UNION
    SELECT 'Ohne Angabe' WHERE chart_dimension = 'deskriptoren' AND m.deskriptoren ~ '^[[:space:];]*$'
  ) k
  WHERE NOT options_only AND chart_dimension IS NOT NULL
), filtered AS (
  SELECT m.vorgangs_id, m.datum FROM matches m
  WHERE chart_selection IS NULL OR EXISTS (
    SELECT FROM groups g WHERE g.vorgangs_id = m.vorgangs_id AND g.label = chart_selection
  )
), page AS (
  SELECT f.vorgangs_id, row_number() OVER (
    ORDER BY CASE WHEN oldest_first THEN f.datum END ASC NULLS LAST,
             CASE WHEN NOT oldest_first THEN f.datum END DESC NULLS LAST, f.vorgangs_id
  ) AS position
  FROM filtered f
  ORDER BY position
  LIMIT CASE WHEN options_only THEN 0 ELSE 20 END OFFSET greatest(page_offset, 0)
)
SELECT CASE WHEN options_only THEN jsonb_build_object(
  'kinds', coalesce((SELECT jsonb_agg(DISTINCT vorgangstyp ORDER BY vorgangstyp) FROM candidates WHERE vorgangstyp <> ''), '[]'),
  'parties', coalesce((SELECT jsonb_agg(DISTINCT label ORDER BY label) FROM candidates c CROSS JOIN LATERAL unnest(c.parties) label), '[]'),
  'topics', coalesce((SELECT jsonb_agg(DISTINCT btrim(tag) ORDER BY btrim(tag)) FROM candidates c
    CROSS JOIN LATERAL unnest(string_to_array(c.deskriptoren, ';')) tag WHERE btrim(tag) <> ''), '[]')
) ELSE jsonb_build_object(
  'total', CASE WHEN page_offset = 0 THEN (SELECT count(*) FROM source) END,
  'count', CASE WHEN page_offset = 0 THEN (SELECT count(*) FROM filtered) END,
  'groups', coalesce((SELECT jsonb_agg(jsonb_build_array(g.label, g.amount) ORDER BY
    CASE WHEN chart_dimension = 'datum' THEN g.label END, g.amount DESC, g.label)
    FROM (SELECT label, count(*) AS amount FROM groups WHERE page_offset = 0 GROUP BY label
      ORDER BY CASE WHEN chart_dimension = 'datum' THEN label END, count(*) DESC, label
      LIMIT CASE WHEN chart_dimension = 'datum' THEN 100 ELSE 12 END) g), '[]'),
  'rows', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'vorgangs_id', p.vorgangs_id, 'drucksache', p.drucksache, 'vorgangstyp', p.vorgangstyp,
    'datum', p.datum, 'urheber', p.urheber, 'ressort', p.ressort, 'titel', p.titel,
    'deskriptoren', p.deskriptoren,
    'url', CASE WHEN p.pdf_url ~* '^https://www\.landtag-bw\.de/' THEN p.pdf_url
                WHEN p.dokument_url ~* '^https://www\.landtag-bw\.de/' THEN p.dokument_url END,
    'deputies', coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_array(d.profile_key, d.deputy_name))
      FROM public.parlis_deputy_profiles d WHERE d.legislature = period AND d.vorgangs_id = p.vorgangs_id
        AND d.profile_key IS NOT NULL AND d.deputy_name IS NOT NULL), '[]')
  ) ORDER BY page.position) FROM page JOIN source p USING (vorgangs_id)), '[]')
) END;
$$;

REVOKE ALL ON FUNCTION public.parlis_page(integer,integer,text,text,text,text,date,date,text,boolean,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parlis_page(integer,integer,text,text,text,text,date,date,text,boolean,text,text,boolean) TO authenticated;
