-- Create document_categories table
CREATE TABLE public.document_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color VARCHAR DEFAULT '#3b82f6',
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

-- Admin roles can manage document categories
CREATE POLICY "Admin roles can manage document categories"
ON public.document_categories
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role));

-- Authenticated users can view document categories
CREATE POLICY "Authenticated users can view document categories"
ON public.document_categories
FOR SELECT
TO authenticated
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_document_categories_updated_at
  BEFORE UPDATE ON public.document_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.document_categories (name, label, color, icon, order_index) VALUES
  ('protocol', 'Protokoll', '#10b981', 'file-text', 0),
  ('letter', 'Brief', '#3b82f6', 'mail', 1),
  ('contract', 'Vertrag', '#8b5cf6', 'file-signature', 2),
  ('report', 'Bericht', '#f59e0b', 'file-chart', 3),
  ('presentation', 'Präsentation', '#ef4444', 'presentation', 4),
  ('other', 'Sonstiges', '#6b7280', 'file', 5);