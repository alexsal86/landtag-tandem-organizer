-- Create event_email_templates table
CREATE TABLE public.event_email_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('invitation', 'reminder', 'note')),
  subject     TEXT        NOT NULL DEFAULT '',
  body        TEXT        NOT NULL DEFAULT '',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_email_templates_tenant_type_key UNIQUE (tenant_id, type)
);

-- Enable RLS
ALTER TABLE public.event_email_templates ENABLE ROW LEVEL SECURITY;

-- Tenant admins can manage templates
CREATE POLICY "Tenant admins can manage event email templates"
ON public.event_email_templates
FOR ALL
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- All tenant members can read (needed for EventRSVPManager to load defaults)
CREATE POLICY "Users can view event email templates in their tenant"
ON public.event_email_templates
FOR SELECT
TO authenticated
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- updated_at trigger
CREATE TRIGGER update_event_email_templates_updated_at
BEFORE UPDATE ON public.event_email_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
