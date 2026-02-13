
-- Create letter_occasions table
CREATE TABLE public.letter_occasions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_template_id UUID REFERENCES public.letter_templates(id) ON DELETE SET NULL,
  template_match_patterns TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, key)
);

-- Enable RLS
ALTER TABLE public.letter_occasions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view letter occasions for their tenant"
ON public.letter_occasions FOR SELECT
TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert letter occasions for their tenant"
ON public.letter_occasions FOR INSERT
TO authenticated
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update letter occasions for their tenant"
ON public.letter_occasions FOR UPDATE
TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete letter occasions for their tenant"
ON public.letter_occasions FOR DELETE
TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_letter_occasions_updated_at
BEFORE UPDATE ON public.letter_occasions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
