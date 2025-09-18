-- Create global tags table for tag management
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tags table
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view active tags
CREATE POLICY "Authenticated users can view active tags"
ON public.tags
FOR SELECT
USING (auth.role() = 'authenticated' AND is_active = true);

-- Allow admins to manage tags
CREATE POLICY "Admins can manage tags"
ON public.tags
FOR ALL
USING (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role))
WITH CHECK (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_tags_updated_at
BEFORE UPDATE ON public.tags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default tags
INSERT INTO public.tags (name, label, color, order_index) VALUES
('wichtig', 'Wichtig', '#dc2626', 0),
('dringend', 'Dringend', '#ea580c', 1),
('landtag', 'Landtag', '#2563eb', 2),
('wahlkreis', 'Wahlkreis', '#16a34a', 3),
('presse', 'Presse', '#7c3aed', 4),
('termine', 'Termine', '#0891b2', 5);

-- Fix distribution lists with null tenant_id by setting them to a proper tenant
-- First, let's check if we need to update any null tenant_ids
-- We'll use the first available tenant for any null values
UPDATE public.distribution_lists 
SET tenant_id = (
  SELECT id FROM public.tenants LIMIT 1
)
WHERE tenant_id IS NULL;