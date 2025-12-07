-- Create case_file_types table for dynamic FallAkten types
CREATE TABLE public.case_file_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT DEFAULT 'Folder',
  color TEXT DEFAULT '#3b82f6',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.case_file_types ENABLE ROW LEVEL SECURITY;

-- Everyone can view active types
CREATE POLICY "Everyone can view active case file types"
ON public.case_file_types
FOR SELECT
USING (is_active = true);

-- Admin roles can manage types
CREATE POLICY "Admin roles can manage case file types"
ON public.case_file_types
FOR ALL
USING (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role));

-- Insert initial types based on existing hardcoded values + expanded
INSERT INTO public.case_file_types (name, label, icon, color, order_index) VALUES
  ('petition', 'Petition', 'FileSignature', '#8b5cf6', 0),
  ('citizen_concern', 'Bürgeranliegen', 'Users', '#10b981', 1),
  ('legislation', 'Gesetzgebung', 'Scale', '#3b82f6', 2),
  ('small_inquiry', 'Kleine Anfrage', 'HelpCircle', '#f59e0b', 3),
  ('investigation', 'Untersuchung', 'Search', '#ef4444', 4),
  ('project', 'Projekt', 'Briefcase', '#06b6d4', 5),
  ('committee_work', 'Ausschussarbeit', 'Building2', '#6366f1', 6),
  ('constituency', 'Wahlkreis', 'MapPin', '#ec4899', 7),
  ('initiative', 'Initiative', 'Lightbulb', '#f97316', 8),
  ('general', 'Allgemein', 'Folder', '#6b7280', 9);

-- Create trigger for updated_at
CREATE TRIGGER update_case_file_types_updated_at
BEFORE UPDATE ON public.case_file_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();