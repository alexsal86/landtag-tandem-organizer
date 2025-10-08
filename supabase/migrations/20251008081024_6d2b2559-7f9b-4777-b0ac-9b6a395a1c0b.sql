-- Create contact_activities table for tracking all contact interactions
CREATE TABLE IF NOT EXISTS public.contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'edit', 'note', 'letter', 'appointment', 'created')),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for performance
CREATE INDEX idx_contact_activities_contact_id ON public.contact_activities(contact_id);
CREATE INDEX idx_contact_activities_tenant_id ON public.contact_activities(tenant_id);
CREATE INDEX idx_contact_activities_created_at ON public.contact_activities(created_at DESC);
CREATE INDEX idx_contact_activities_activity_type ON public.contact_activities(activity_type);

-- Enable RLS
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view activities for contacts in their tenant
CREATE POLICY "Users can view activities in their tenant"
ON public.contact_activities
FOR SELECT
USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- RLS Policies: Users can create activities in their tenant
CREATE POLICY "Users can create activities in their tenant"
ON public.contact_activities
FOR INSERT
WITH CHECK (
  tenant_id = ANY(get_user_tenant_ids(auth.uid())) 
  AND created_by = auth.uid()
);

-- RLS Policies: Users can update their own activities
CREATE POLICY "Users can update their own activities"
ON public.contact_activities
FOR UPDATE
USING (created_by = auth.uid() AND tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- RLS Policies: Users can delete their own activities
CREATE POLICY "Users can delete their own activities"
ON public.contact_activities
FOR DELETE
USING (created_by = auth.uid() AND tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- Function to log contact edit activities
CREATE OR REPLACE FUNCTION public.log_contact_edit_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changes_text TEXT := '';
  field_changes TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check if important fields changed
  IF OLD.name != NEW.name THEN
    field_changes := array_append(field_changes, 'Name');
  END IF;
  IF OLD.email != NEW.email THEN
    field_changes := array_append(field_changes, 'E-Mail');
  END IF;
  IF OLD.phone != NEW.phone THEN
    field_changes := array_append(field_changes, 'Telefon');
  END IF;
  IF OLD.organization != NEW.organization OR (OLD.organization IS NULL AND NEW.organization IS NOT NULL) OR (OLD.organization IS NOT NULL AND NEW.organization IS NULL) THEN
    field_changes := array_append(field_changes, 'Organisation');
  END IF;
  IF OLD.category != NEW.category THEN
    field_changes := array_append(field_changes, 'Kategorie');
  END IF;
  
  -- Only log if there are meaningful changes
  IF array_length(field_changes, 1) > 0 AND auth.uid() IS NOT NULL THEN
    changes_text := array_to_string(field_changes, ', ');
    
    INSERT INTO public.contact_activities (
      contact_id,
      tenant_id,
      activity_type,
      title,
      description,
      created_by,
      metadata
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      'edit',
      'Kontakt bearbeitet',
      'Geänderte Felder: ' || changes_text,
      auth.uid(),
      jsonb_build_object('changed_fields', field_changes)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for contact updates
DROP TRIGGER IF EXISTS trigger_log_contact_edit ON public.contacts;
CREATE TRIGGER trigger_log_contact_edit
  AFTER UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_contact_edit_activity();

-- Function to log contact creation
CREATE OR REPLACE FUNCTION public.log_contact_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.contact_activities (
      contact_id,
      tenant_id,
      activity_type,
      title,
      description,
      created_by,
      metadata
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      'created',
      'Kontakt erstellt',
      'Neuer Kontakt wurde angelegt',
      auth.uid(),
      jsonb_build_object('contact_type', NEW.contact_type, 'category', NEW.category)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for contact creation
DROP TRIGGER IF EXISTS trigger_log_contact_creation ON public.contacts;
CREATE TRIGGER trigger_log_contact_creation
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_contact_creation();