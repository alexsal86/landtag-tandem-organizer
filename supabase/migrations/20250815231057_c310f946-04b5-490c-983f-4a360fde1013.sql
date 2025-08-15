-- Create table for meeting agenda specific documents
CREATE TABLE public.meeting_agenda_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  agenda_item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_agenda_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for meeting agenda documents
CREATE POLICY "Authenticated users can view all meeting agenda documents"
ON public.meeting_agenda_documents
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create all meeting agenda documents"
ON public.meeting_agenda_documents
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all meeting agenda documents"
ON public.meeting_agenda_documents
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all meeting agenda documents"
ON public.meeting_agenda_documents
FOR DELETE
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meeting_agenda_documents_updated_at
BEFORE UPDATE ON public.meeting_agenda_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();