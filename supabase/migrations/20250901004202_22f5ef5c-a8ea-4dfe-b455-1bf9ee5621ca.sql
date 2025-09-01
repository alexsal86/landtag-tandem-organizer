-- Add RLS policies for letters table
-- Users can view letters in their tenant
CREATE POLICY "Users can view letters in their tenant"
ON public.letters FOR SELECT
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Users can create letters in their tenant  
CREATE POLICY "Users can create letters in their tenant"
ON public.letters FOR INSERT
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND created_by = auth.uid());

-- Users can update letters they created in their tenant
CREATE POLICY "Users can update letters in their tenant"
ON public.letters FOR UPDATE
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND (created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM letter_collaborators lc 
  WHERE lc.letter_id = letters.id AND lc.user_id = auth.uid()
)))
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Users can delete letters they created in their tenant
CREATE POLICY "Users can delete letters in their tenant"
ON public.letters FOR DELETE
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND created_by = auth.uid());