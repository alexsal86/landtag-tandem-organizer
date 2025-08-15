-- Extend meeting_agenda_documents to handle both regular and additional files
ALTER TABLE public.meeting_agenda_documents 
ADD COLUMN document_type text NOT NULL DEFAULT 'additional';

-- Update existing records to be 'additional' type
UPDATE public.meeting_agenda_documents 
SET document_type = 'additional';

-- Add constraint to ensure valid document types
ALTER TABLE public.meeting_agenda_documents 
ADD CONSTRAINT meeting_agenda_documents_type_check 
CHECK (document_type IN ('regular', 'additional'));