-- Create news_email_templates table
CREATE TABLE public.news_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT 'News-Empfehlung',
  greeting TEXT NOT NULL DEFAULT 'Hallo {recipient_name},',
  introduction TEXT NOT NULL DEFAULT '{sender_name} möchte folgende News mit Ihnen teilen:',
  closing TEXT NOT NULL DEFAULT 'Viel Spaß beim Lesen!',
  signature TEXT NOT NULL DEFAULT 'Ihr Team',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.news_email_templates ENABLE ROW LEVEL SECURITY;

-- Tenant admins can manage templates
CREATE POLICY "Tenant admins can manage news email templates"
ON public.news_email_templates
FOR ALL
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- All users can read templates in their tenant
CREATE POLICY "Users can view news email templates in their tenant"
ON public.news_email_templates
FOR SELECT
TO authenticated
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- Create updated_at trigger
CREATE TRIGGER update_news_email_templates_updated_at
BEFORE UPDATE ON public.news_email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();