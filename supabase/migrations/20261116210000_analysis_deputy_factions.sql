BEGIN;
-- Return only bounded filter metadata, never preload the person/mandate register.
CREATE FUNCTION public.list_analysis_deputy_factions(selected_period uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(f.label ORDER BY lower(f.label),f.label),'[]'::jsonb)
  FROM (
    SELECT DISTINCT coalesce(nullif(btrim(m.party_label),''),m.party) AS label
    FROM public.election_history_mandates m
    JOIN public.election_history_periods lp ON lp.id=m.period_id AND lp.is_published
    WHERE (selected_period IS NULL OR m.period_id=selected_period)
      AND nullif(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)),'') IS NOT NULL
    ORDER BY label LIMIT 100
  ) f;
$$;
REVOKE ALL ON FUNCTION public.list_analysis_deputy_factions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_analysis_deputy_factions(uuid) TO authenticated;
COMMIT;
