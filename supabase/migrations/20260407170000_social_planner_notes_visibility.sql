ALTER TABLE public.social_planner_notes
  ADD COLUMN IF NOT EXISTS visible_to_all boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Users can view notes in their tenant" ON public.social_planner_notes;
DROP POLICY IF EXISTS "Users can update notes in their tenant" ON public.social_planner_notes;
DROP POLICY IF EXISTS "Users can delete notes in their tenant" ON public.social_planner_notes;

CREATE POLICY "Users can view notes in their tenant"
  ON public.social_planner_notes FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND (visible_to_all = true OR created_by = auth.uid())
  );

CREATE POLICY "Users can update notes in their tenant"
  ON public.social_planner_notes FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can delete notes in their tenant"
  ON public.social_planner_notes FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  );
