-- Create letter templates table
CREATE TABLE public.letter_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  letterhead_html TEXT NOT NULL DEFAULT '',
  letterhead_css TEXT NOT NULL DEFAULT '',
  response_time_days INTEGER NOT NULL DEFAULT 21,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for letter_templates
CREATE POLICY "Users can view templates in their tenant" 
ON public.letter_templates FOR SELECT 
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND is_active = true);

CREATE POLICY "Tenant admins can manage letter templates" 
ON public.letter_templates FOR ALL 
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));