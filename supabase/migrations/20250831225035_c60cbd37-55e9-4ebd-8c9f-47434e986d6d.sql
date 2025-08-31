-- Brief-Archivierung: Erweitere letters und documents Tabellen

-- Erweitere letters Tabelle für Archivierung
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS archived_document_id uuid;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS workflow_locked boolean DEFAULT false;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamp with time zone;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS submitted_for_review_by uuid;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS submitted_to_user uuid;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS sent_by uuid;

-- Erweitere documents Tabelle für Brief-Archivierung
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'document';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS source_letter_id uuid;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS workflow_history jsonb;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS archived_attachments jsonb DEFAULT '[]'::jsonb;

-- Letter archive settings table für Benutzer-Einstellungen
CREATE TABLE IF NOT EXISTS public.letter_archive_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  auto_archive_days integer DEFAULT 30,
  show_sent_letters boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Aktiviere RLS für die neue Tabelle
ALTER TABLE public.letter_archive_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies für letter_archive_settings
CREATE POLICY "Users can manage their own archive settings" ON public.letter_archive_settings
FOR ALL USING (user_id = auth.uid() AND tenant_id = ANY (get_user_tenant_ids(auth.uid())))
WITH CHECK (user_id = auth.uid() AND tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Storage bucket für archivierte Briefe erstellen
INSERT INTO storage.buckets (id, name, public) 
VALUES ('archived-letters', 'archived-letters', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies für archived-letters bucket
CREATE POLICY "Users can view archived letters in their tenant" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'archived-letters' AND 
  EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.file_path = name AND 
    d.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Service role can manage archived letters" 
ON storage.objects FOR ALL 
USING (bucket_id = 'archived-letters' AND auth.jwt() ->> 'role' = 'service_role');

-- Trigger für automatische Archivierung bei Status-Änderung zu 'sent'
CREATE OR REPLACE FUNCTION public.handle_letter_archiving()
RETURNS trigger AS $$
BEGIN
  -- Wenn Status auf 'sent' geändert wird
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    NEW.workflow_locked = true;
    NEW.sent_at = now();
    NEW.sent_by = auth.uid();
    
    -- Background job für PDF-Erstellung starten (vereinfacht)
    -- Hier würde normalerweise ein Edge Function Call stattfinden
  END IF;
  
  -- Workflow-Tracking aktualisieren
  IF NEW.status = 'review' AND OLD.status != 'review' THEN
    NEW.submitted_for_review_at = now();
    NEW.submitted_for_review_by = auth.uid();
  END IF;
  
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    NEW.approved_at = now();
    NEW.approved_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger erstellen
DROP TRIGGER IF EXISTS letter_archiving_trigger ON public.letters;
CREATE TRIGGER letter_archiving_trigger
  BEFORE UPDATE ON public.letters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_letter_archiving();

-- Update timestamp trigger für archive settings
CREATE TRIGGER update_letter_archive_settings_updated_at
  BEFORE UPDATE ON public.letter_archive_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();