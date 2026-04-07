
-- Fix RLS policies on social_planner_notes: profiles.id != auth.uid(), must use profiles.user_id
DROP POLICY IF EXISTS "Users can view notes in their tenant" ON public.social_planner_notes;
DROP POLICY IF EXISTS "Users can insert notes in their tenant" ON public.social_planner_notes;
DROP POLICY IF EXISTS "Users can update notes in their tenant" ON public.social_planner_notes;
DROP POLICY IF EXISTS "Users can delete notes in their tenant" ON public.social_planner_notes;

CREATE POLICY "Users can view notes in their tenant"
  ON public.social_planner_notes FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert notes in their tenant"
  ON public.social_planner_notes FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update notes in their tenant"
  ON public.social_planner_notes FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete notes in their tenant"
  ON public.social_planner_notes FOR DELETE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
