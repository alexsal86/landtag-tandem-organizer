CREATE FUNCTION public.parlis_filter_options(period integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'kinds', coalesce((
      SELECT jsonb_agg(DISTINCT p.vorgangstyp ORDER BY p.vorgangstyp)
      FROM public.parlis_proceedings p WHERE p.legislature = period AND p.vorgangstyp <> ''
    ), '[]'),
    'parties', coalesce((
      SELECT jsonb_agg(DISTINCT labels[1] ORDER BY labels[1])
      FROM public.parlis_proceedings p
      CROSS JOIN LATERAL regexp_matches(p.urheber,
        '(?:\([[:space:]]*|\mFraktion[[:space:]]+(?:(?:der|des)[[:space:]]+)?)(CDU|SPD|GRÜNE|FDP/DVP|FDP|DVP|AfD|LINKE|DIE LINKE|BÜNDNIS 90/DIE GRÜNEN)(?=[[:space:]]*(?:\)|,|$))', 'gi') AS labels
      WHERE p.legislature = period
    ), '[]')
  );
$$;

CREATE FUNCTION public.parlis_topic_suggestions(period integer, term text)
RETURNS text[] LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT ARRAY(
    SELECT topic
    FROM (
      SELECT DISTINCT btrim(tag) AS topic
      FROM public.parlis_proceedings p
      CROSS JOIN LATERAL unnest(string_to_array(p.deskriptoren, ';')) AS tag
      WHERE p.legislature = period
        AND char_length(btrim(term)) >= 2
        AND strpos(lower(btrim(tag)), lower(btrim(term))) > 0
    ) matches
    ORDER BY (strpos(lower(topic), lower(btrim(term))) = 1) DESC, lower(topic), topic
    LIMIT 20
  );
$$;

REVOKE ALL ON FUNCTION public.parlis_filter_options(integer), public.parlis_topic_suggestions(integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parlis_filter_options(integer), public.parlis_topic_suggestions(integer,text) TO authenticated;
