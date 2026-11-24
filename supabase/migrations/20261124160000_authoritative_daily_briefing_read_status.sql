-- Read status must not be inferred from an RLS-filtered receipt list.
-- Include same-user receipts only for actual deputies, independently of view switches.
CREATE OR REPLACE FUNCTION public.get_authored_daily_briefing_read_status(p_tenant uuid)
RETURNS TABLE(id uuid, briefing_date date, read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = p_tenant AND m.user_id = auth.uid() AND m.is_active
  ) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT b.id, b.briefing_date, (
    SELECT min(r.read_at) FROM public.daily_briefing_reads r
    WHERE r.briefing_id = b.id AND EXISTS (
      SELECT 1 FROM public.user_tenant_memberships reader
      WHERE reader.tenant_id = b.tenant_id AND reader.user_id = r.user_id
        AND reader.is_active AND reader.role = 'abgeordneter'
    )
  )
  FROM public.daily_briefings b
  WHERE b.tenant_id = p_tenant AND b.author_id = auth.uid()
    AND b.briefing_date BETWEEN today - 6 AND today
  ORDER BY b.briefing_date DESC, b.created_at DESC, b.id
  LIMIT 20;
END $$;
REVOKE ALL ON FUNCTION public.get_authored_daily_briefing_read_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_authored_daily_briefing_read_status(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
