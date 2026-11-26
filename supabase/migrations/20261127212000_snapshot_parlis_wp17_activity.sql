-- Rebuild after correcting WP17 documents or merging historical profiles:
-- REFRESH MATERIALIZED VIEW public.parlis_wp17_deputy_activity;
CREATE MATERIALIZED VIEW public.parlis_wp17_deputy_activity AS
SELECT d.profile_key, p.vorgangstyp AS document_kind,
  count(DISTINCT p.vorgangs_id)::integer AS document_count
FROM public.parlis_deputy_profiles d
JOIN public.parlis_proceedings p USING (legislature, vorgangs_id)
WHERE d.legislature = 17 AND d.profile_key IS NOT NULL
GROUP BY d.profile_key, p.vorgangstyp;

CREATE UNIQUE INDEX parlis_wp17_deputy_activity_key
  ON public.parlis_wp17_deputy_activity (profile_key, document_kind);

REVOKE ALL ON public.parlis_wp17_deputy_activity FROM PUBLIC, anon, authenticated;

-- The snapshot is readable only through the bounded profile lookup and only
-- while the period is published. Clients cannot read the snapshot directly.
CREATE FUNCTION public.get_parlis_wp17_deputy_activity(deputy_key text)
RETURNS TABLE (document_kind text, document_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT a.document_kind, a.document_count
  FROM public.parlis_wp17_deputy_activity a
  WHERE a.profile_key = deputy_key
    AND EXISTS (
      SELECT FROM public.election_history_periods p
      WHERE p.number = 17 AND p.is_published
    )
  ORDER BY a.document_count DESC, a.document_kind;
$$;

REVOKE ALL ON FUNCTION public.get_parlis_wp17_deputy_activity(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_parlis_wp17_deputy_activity(text) TO authenticated;
