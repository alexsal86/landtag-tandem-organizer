
-- Fix: Drop the incorrect admin policy and recreate with correct roles
DROP POLICY "Admins can manage checklist templates" ON public.vacation_checklist_templates;

CREATE POLICY "Admins can manage checklist templates"
  ON public.vacation_checklist_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = vacation_checklist_templates.tenant_id
        AND is_active = true
        AND role IN ('abgeordneter', 'bueroleitung')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = vacation_checklist_templates.tenant_id
        AND is_active = true
        AND role IN ('abgeordneter', 'bueroleitung')
    )
  );
