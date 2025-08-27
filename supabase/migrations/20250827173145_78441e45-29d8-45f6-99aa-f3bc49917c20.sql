-- Create appointment preparation templates table
CREATE TABLE public.appointment_preparation_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointment preparations table
CREATE TABLE public.appointment_preparations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL,
  template_id UUID,
  tenant_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  preparation_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointment preparation documents table for file attachments
CREATE TABLE public.appointment_preparation_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preparation_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.appointment_preparation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_preparation_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for appointment_preparation_templates
CREATE POLICY "Users can view templates in their tenant" 
ON public.appointment_preparation_templates 
FOR SELECT 
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND is_active = true);

CREATE POLICY "Tenant admins can manage templates" 
ON public.appointment_preparation_templates 
FOR ALL 
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- RLS policies for appointment_preparations
CREATE POLICY "Users can view preparations in their tenant" 
ON public.appointment_preparations 
FOR SELECT 
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create preparations" 
ON public.appointment_preparations 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND 
  tenant_id = ANY (get_user_tenant_ids(auth.uid()))
);

CREATE POLICY "Users can update preparations they created or are assigned to" 
ON public.appointment_preparations 
FOR UPDATE 
USING (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND
  (created_by = auth.uid() OR 
   EXISTS (
     SELECT 1 FROM appointments a 
     WHERE a.id = appointment_preparations.appointment_id 
     AND a.user_id = auth.uid()
   ))
);

CREATE POLICY "Users can delete their own preparations" 
ON public.appointment_preparations 
FOR DELETE 
USING (created_by = auth.uid());

-- RLS policies for appointment_preparation_documents
CREATE POLICY "Users can view documents for accessible preparations" 
ON public.appointment_preparation_documents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM appointment_preparations ap 
    WHERE ap.id = appointment_preparation_documents.preparation_id 
    AND ap.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Users can manage documents for their preparations" 
ON public.appointment_preparation_documents 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM appointment_preparations ap 
    WHERE ap.id = appointment_preparation_documents.preparation_id 
    AND (ap.created_by = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM appointments a 
           WHERE a.id = ap.appointment_id 
           AND a.user_id = auth.uid()
         ))
  )
);

-- Add foreign key constraints
ALTER TABLE public.appointment_preparation_templates
ADD CONSTRAINT fk_appointment_preparation_templates_tenant
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.appointment_preparations
ADD CONSTRAINT fk_appointment_preparations_appointment
FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;

ALTER TABLE public.appointment_preparations
ADD CONSTRAINT fk_appointment_preparations_template
FOREIGN KEY (template_id) REFERENCES public.appointment_preparation_templates(id) ON DELETE SET NULL;

ALTER TABLE public.appointment_preparations
ADD CONSTRAINT fk_appointment_preparations_tenant
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.appointment_preparation_documents
ADD CONSTRAINT fk_appointment_preparation_documents_preparation
FOREIGN KEY (preparation_id) REFERENCES public.appointment_preparations(id) ON DELETE CASCADE;

-- Create triggers for updated_at
CREATE TRIGGER update_appointment_preparation_templates_updated_at
  BEFORE UPDATE ON public.appointment_preparation_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointment_preparations_updated_at
  BEFORE UPDATE ON public.appointment_preparations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default template
INSERT INTO public.appointment_preparation_templates (
  tenant_id, 
  name, 
  description, 
  template_data, 
  is_default, 
  created_by
) 
SELECT 
  t.id,
  'Standard Terminvorbereitung',
  'Standard-Template für die Vorbereitung von Terminen und Auftritten',
  '[
    {
      "id": "basic_info",
      "title": "Grundinformationen",
      "type": "section",
      "fields": [
        {"id": "event_type", "label": "Art des Termins", "type": "select", "options": ["Bürgersprechstunde", "Ausschusssitzung", "Pressekonferenz", "Veranstaltung", "Meeting", "Sonstiges"], "required": true},
        {"id": "audience", "label": "Zielgruppe/Teilnehmer", "type": "textarea", "required": true},
        {"id": "key_topics", "label": "Hauptthemen", "type": "textarea", "required": true},
        {"id": "objectives", "label": "Ziele des Termins", "type": "textarea", "required": true}
      ]
    },
    {
      "id": "content_preparation",
      "title": "Inhaltliche Vorbereitung",
      "type": "section",
      "fields": [
        {"id": "talking_points", "label": "Gesprächspunkte", "type": "textarea", "required": false},
        {"id": "position_statements", "label": "Positionierungen", "type": "textarea", "required": false},
        {"id": "facts_figures", "label": "Fakten und Zahlen", "type": "textarea", "required": false},
        {"id": "questions_answers", "label": "Mögliche Fragen & Antworten", "type": "textarea", "required": false}
      ]
    },
    {
      "id": "organizational",
      "title": "Organisation",
      "type": "section",
      "fields": [
        {"id": "contact_person", "label": "Ansprechpartner vor Ort", "type": "text", "required": false},
        {"id": "dress_code", "label": "Dresscode", "type": "select", "options": ["Business", "Smart Casual", "Casual", "Festlich", "Sonstiges"], "required": false},
        {"id": "materials_needed", "label": "Benötigte Unterlagen", "type": "textarea", "required": false},
        {"id": "technology_setup", "label": "Technik/Equipment", "type": "textarea", "required": false}
      ]
    },
    {
      "id": "checklist",
      "title": "Checkliste",
      "type": "checklist",
      "items": [
        {"id": "research_completed", "label": "Recherche abgeschlossen", "completed": false},
        {"id": "talking_points_prepared", "label": "Gesprächspunkte vorbereitet", "completed": false},
        {"id": "materials_gathered", "label": "Unterlagen zusammengestellt", "completed": false},
        {"id": "transport_organized", "label": "Anfahrt organisiert", "completed": false},
        {"id": "follow_up_planned", "label": "Nachbereitung geplant", "completed": false}
      ]
    }
  ]'::jsonb,
  true,
  (SELECT user_id FROM profiles LIMIT 1)
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM appointment_preparation_templates apt 
  WHERE apt.tenant_id = t.id AND apt.is_default = true
);

-- Function to auto-archive preparations after appointment ends
CREATE OR REPLACE FUNCTION public.auto_archive_completed_preparations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.appointment_preparations
  SET 
    is_archived = true,
    archived_at = now(),
    updated_at = now()
  WHERE 
    is_archived = false
    AND EXISTS (
      SELECT 1 FROM appointments a 
      WHERE a.id = appointment_preparations.appointment_id 
      AND a.end_time < now() - INTERVAL '1 hour'
    );
END;
$$;