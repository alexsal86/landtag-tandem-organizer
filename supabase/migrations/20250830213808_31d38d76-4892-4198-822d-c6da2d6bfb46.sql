-- Create sender information table for letterhead management
CREATE TABLE public.sender_information (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  department TEXT,
  organization TEXT NOT NULL,
  street TEXT,
  house_number TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Deutschland',
  phone TEXT,
  fax TEXT,
  email TEXT,
  website TEXT,
  return_address_line TEXT, -- Short format for return address in window
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create information blocks table for right sidebar info
CREATE TABLE public.information_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  block_data JSONB NOT NULL DEFAULT '{}', -- Structured data for different info types
  block_type TEXT NOT NULL DEFAULT 'contact', -- contact, date, reference, custom
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create letter attachments table
CREATE TABLE public.letter_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letter_id UUID NOT NULL,
  document_id UUID,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add only new fields to letters table that don't exist yet
ALTER TABLE public.letters 
ADD COLUMN IF NOT EXISTS sender_information_id UUID REFERENCES public.sender_information(id),
ADD COLUMN IF NOT EXISTS information_block_id UUID REFERENCES public.information_blocks(id),
ADD COLUMN IF NOT EXISTS letter_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS subject_line TEXT,
ADD COLUMN IF NOT EXISTS reference_number TEXT,
ADD COLUMN IF NOT EXISTS attachments_list TEXT[];

-- Enable RLS
ALTER TABLE public.sender_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.information_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sender_information
CREATE POLICY "Users can view sender info in their tenant" 
ON public.sender_information 
FOR SELECT 
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND is_active = true);

CREATE POLICY "Tenant admins can manage sender info" 
ON public.sender_information 
FOR ALL 
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- RLS Policies for information_blocks
CREATE POLICY "Users can view info blocks in their tenant" 
ON public.information_blocks 
FOR SELECT 
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND is_active = true);

CREATE POLICY "Tenant admins can manage info blocks" 
ON public.information_blocks 
FOR ALL 
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- RLS Policies for letter_attachments
CREATE POLICY "Users can manage attachments for accessible letters" 
ON public.letter_attachments 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.letters l 
  WHERE l.id = letter_attachments.letter_id 
  AND (l.created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.letter_collaborators lc 
    WHERE lc.letter_id = l.id AND lc.user_id = auth.uid()
  ))
));

-- Create trigger for updated_at
CREATE TRIGGER update_sender_information_updated_at
BEFORE UPDATE ON public.sender_information
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_information_blocks_updated_at
BEFORE UPDATE ON public.information_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();