
-- Create letter_template_settings table
CREATE TABLE public.letter_template_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  variable_defaults JSONB DEFAULT '{}',
  din5008_defaults JSONB DEFAULT '{}',
  salutation_templates JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.letter_template_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies using tenant_id pattern
CREATE POLICY "Users can view their tenant settings"
  ON public.letter_template_settings FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their tenant settings"
  ON public.letter_template_settings FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their tenant settings"
  ON public.letter_template_settings FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_letter_template_settings_updated_at
  BEFORE UPDATE ON public.letter_template_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
