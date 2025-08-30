-- Create letter_attachments table
CREATE TABLE public.letter_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letter_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add missing fields to letters table for DIN 5008
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS sender_info_id uuid;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS information_block_ids text[];
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS letter_date date DEFAULT CURRENT_DATE;

-- Enable RLS on letter_attachments
ALTER TABLE public.letter_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for letter_attachments
CREATE POLICY "Users can create attachments for accessible letters" 
ON public.letter_attachments 
FOR INSERT 
WITH CHECK (
  uploaded_by = auth.uid() AND 
  EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = letter_attachments.letter_id 
    AND (
      l.created_by = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.letter_collaborators lc 
        WHERE lc.letter_id = l.id AND lc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can view attachments for accessible letters" 
ON public.letter_attachments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = letter_attachments.letter_id 
    AND (
      l.created_by = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.letter_collaborators lc 
        WHERE lc.letter_id = l.id AND lc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can delete their own attachments" 
ON public.letter_attachments 
FOR DELETE 
USING (uploaded_by = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_letter_attachments_updated_at
BEFORE UPDATE ON public.letter_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();