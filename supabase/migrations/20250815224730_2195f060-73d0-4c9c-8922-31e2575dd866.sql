-- Create table for meeting agenda item documents
CREATE TABLE public.meeting_agenda_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agenda_item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.meeting_agenda_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for meeting agenda documents
CREATE POLICY "Users can view meeting agenda documents for accessible meetings" 
ON public.meeting_agenda_documents 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.meeting_agenda_items mai
  JOIN public.meetings m ON m.id = mai.meeting_id
  WHERE mai.id = meeting_agenda_documents.agenda_item_id
  AND (m.user_id = auth.uid() OR auth.role() = 'authenticated')
));

CREATE POLICY "Users can create meeting agenda documents for accessible meetings" 
ON public.meeting_agenda_documents 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.meeting_agenda_items mai
    JOIN public.meetings m ON m.id = mai.meeting_id
    WHERE mai.id = meeting_agenda_documents.agenda_item_id
    AND (m.user_id = auth.uid() OR auth.role() = 'authenticated')
  )
);

CREATE POLICY "Users can delete meeting agenda documents for accessible meetings" 
ON public.meeting_agenda_documents 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.meeting_agenda_items mai
  JOIN public.meetings m ON m.id = mai.meeting_id
  WHERE mai.id = meeting_agenda_documents.agenda_item_id
  AND (m.user_id = auth.uid() OR auth.role() = 'authenticated')
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meeting_agenda_documents_updated_at
BEFORE UPDATE ON public.meeting_agenda_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();