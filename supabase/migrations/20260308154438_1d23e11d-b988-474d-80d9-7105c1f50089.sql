-- 1. Add RLS policies for tenant_collaborations table (had RLS enabled but no policies)
CREATE POLICY "Users can view collaborations for their tenant"
  ON public.tenant_collaborations
  FOR SELECT
  TO authenticated
  USING (
    tenant_a_id IN (SELECT tenant_id FROM public.user_tenant_memberships WHERE user_id = auth.uid() AND is_active = true)
    OR
    tenant_b_id IN (SELECT tenant_id FROM public.user_tenant_memberships WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Tenant admins can manage collaborations"
  ON public.tenant_collaborations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
      AND is_active = true
      AND role = 'abgeordneter'
      AND (tenant_id = tenant_a_id OR tenant_id = tenant_b_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
      AND is_active = true
      AND role = 'abgeordneter'
      AND (tenant_id = tenant_a_id OR tenant_id = tenant_b_id)
    )
  );

-- 2. Move pg_trgm extension from public to extensions schema
-- Note: pg_net cannot be moved as it requires the public schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;