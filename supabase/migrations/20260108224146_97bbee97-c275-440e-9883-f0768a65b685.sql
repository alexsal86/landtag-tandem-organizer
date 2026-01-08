-- Fix: Allow admins to update decision email templates
-- The is_tenant_admin function checks user_tenant_memberships.role which is NULL
-- We need a policy that checks the user_roles table instead

CREATE POLICY "Admins can update decision email templates"
ON public.decision_email_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.user_tenant_memberships utm ON ur.user_id = utm.user_id
    WHERE ur.user_id = auth.uid()
    AND utm.tenant_id = decision_email_templates.tenant_id
    AND ur.role IN ('abgeordneter', 'bueroleitung')
    AND utm.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.user_tenant_memberships utm ON ur.user_id = utm.user_id
    WHERE ur.user_id = auth.uid()
    AND utm.tenant_id = decision_email_templates.tenant_id
    AND ur.role IN ('abgeordneter', 'bueroleitung')
    AND utm.is_active = true
  )
);