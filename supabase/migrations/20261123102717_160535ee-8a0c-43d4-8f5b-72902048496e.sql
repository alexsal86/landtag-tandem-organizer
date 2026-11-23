DROP POLICY IF EXISTS read_people ON public.election_history_people;
CREATE POLICY read_people ON public.election_history_people FOR SELECT TO authenticated
USING (public.is_superadmin(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.user_id = auth.uid() AND m.is_active));
DROP POLICY IF EXISTS faction_read ON public.election_history_factions;
CREATE POLICY faction_read ON public.election_history_factions FOR SELECT TO authenticated
USING (public.is_superadmin(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_tenant_memberships m WHERE m.user_id = auth.uid() AND m.is_active));