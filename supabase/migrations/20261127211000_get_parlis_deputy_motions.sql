CREATE FUNCTION public.get_parlis_deputy_motions(period integer, deputy_key text)
RETURNS TABLE (vorgangs_id text, titel text, datum date, drucksache text, pdf_url text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.vorgangs_id, p.titel, p.datum, p.drucksache,
    CASE WHEN p.pdf_url ~* '^https://www[.]landtag-bw[.]de/' THEN p.pdf_url
         WHEN p.dokument_url ~* '^https://www[.]landtag-bw[.]de/' THEN p.dokument_url END
  FROM public.parlis_proceedings p
  WHERE p.legislature = period AND p.vorgangstyp = 'Antrag'
    AND EXISTS (
      SELECT FROM public.parlis_deputy_profiles d
      WHERE d.legislature = period AND d.vorgangs_id = p.vorgangs_id AND d.profile_key = deputy_key
    )
  ORDER BY p.datum DESC NULLS LAST, p.vorgangs_id
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.get_parlis_deputy_motions(integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_parlis_deputy_motions(integer,text) TO authenticated;
