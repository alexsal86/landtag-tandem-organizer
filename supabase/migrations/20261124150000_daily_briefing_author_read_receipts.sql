-- Evaluate memberships behind a definer helper: staff cannot normally read
-- other people's membership rows. This helper reveals only an access decision.
CREATE OR REPLACE FUNCTION public.can_view_daily_briefing_receipt(_briefing_id uuid, _reader_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.daily_briefings b
    JOIN public.user_tenant_memberships author_membership
      ON author_membership.tenant_id = b.tenant_id AND author_membership.user_id = auth.uid()
        AND author_membership.is_active
    JOIN public.user_tenant_memberships reader_membership
      ON reader_membership.tenant_id = b.tenant_id AND reader_membership.user_id = _reader_id
        AND reader_membership.is_active AND reader_membership.role = 'abgeordneter'
    WHERE b.id = _briefing_id AND b.author_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_daily_briefing_receipt(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_view_daily_briefing_receipt(uuid,uuid) TO authenticated;

DROP POLICY IF EXISTS "Authors see deputy reads of own briefings" ON public.daily_briefing_reads;
CREATE POLICY "Authors see deputy reads of own briefings"
ON public.daily_briefing_reads FOR SELECT TO authenticated
USING (public.can_view_daily_briefing_receipt(briefing_id,user_id));
