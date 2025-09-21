-- Create tables for parliament protocol analysis
CREATE TABLE public.parliament_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  protocol_date DATE NOT NULL,
  session_number TEXT NOT NULL,
  legislature_period TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  processing_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'processing', 'completed', 'error')),
  processing_error_message TEXT,
  raw_text TEXT,
  structured_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on parliament_protocols
ALTER TABLE public.parliament_protocols ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant-based access
CREATE POLICY "Users can manage protocols in their tenant"
ON public.parliament_protocols 
FOR ALL
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())))
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE TABLE public.protocol_agenda_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id UUID NOT NULL REFERENCES public.parliament_protocols(id) ON DELETE CASCADE,
  agenda_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  page_number INTEGER,
  start_time TIME,
  end_time TIME,
  item_type TEXT DEFAULT 'regular' CHECK (item_type IN ('regular', 'question', 'motion', 'government_statement')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on protocol_agenda_items
ALTER TABLE public.protocol_agenda_items ENABLE ROW LEVEL SECURITY;

-- Create policy for agenda items
CREATE POLICY "Users can manage agenda items via protocol access"
ON public.protocol_agenda_items 
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.parliament_protocols pp 
  WHERE pp.id = protocol_agenda_items.protocol_id 
  AND pp.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.parliament_protocols pp 
  WHERE pp.id = protocol_agenda_items.protocol_id 
  AND pp.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

CREATE TABLE public.protocol_speeches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id UUID NOT NULL REFERENCES public.parliament_protocols(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES public.protocol_agenda_items(id) ON DELETE SET NULL,
  speaker_name TEXT NOT NULL,
  speaker_party TEXT,
  speaker_role TEXT,
  speech_content TEXT NOT NULL,
  start_time TIME,
  end_time TIME,
  page_number INTEGER,
  speech_type TEXT DEFAULT 'main' CHECK (speech_type IN ('main', 'interjection', 'applause', 'interruption')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on protocol_speeches
ALTER TABLE public.protocol_speeches ENABLE ROW LEVEL SECURITY;

-- Create policy for speeches
CREATE POLICY "Users can manage speeches via protocol access"
ON public.protocol_speeches 
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.parliament_protocols pp 
  WHERE pp.id = protocol_speeches.protocol_id 
  AND pp.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.parliament_protocols pp 
  WHERE pp.id = protocol_speeches.protocol_id 
  AND pp.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

CREATE TABLE public.protocol_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id UUID NOT NULL REFERENCES public.parliament_protocols(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('start', 'end', 'break_start', 'break_end')),
  timestamp TIME NOT NULL,
  page_number INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on protocol_sessions
ALTER TABLE public.protocol_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for sessions
CREATE POLICY "Users can manage sessions via protocol access"
ON public.protocol_sessions 
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.parliament_protocols pp 
  WHERE pp.id = protocol_sessions.protocol_id 
  AND pp.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.parliament_protocols pp 
  WHERE pp.id = protocol_sessions.protocol_id 
  AND pp.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

-- Create trigger for updating timestamps
CREATE TRIGGER update_parliament_protocols_updated_at
BEFORE UPDATE ON public.parliament_protocols
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for protocol PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('parliament-protocols', 'parliament-protocols', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for protocol files
CREATE POLICY "Users can upload protocol files in their tenant"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'parliament-protocols' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view protocol files in their tenant"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'parliament-protocols' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete protocol files in their tenant"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'parliament-protocols' 
  AND auth.role() = 'authenticated'
);