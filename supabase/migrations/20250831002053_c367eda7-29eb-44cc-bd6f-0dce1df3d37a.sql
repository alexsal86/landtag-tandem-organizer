-- Add missing columns to letter_attachments table
ALTER TABLE public.letter_attachments 
ADD COLUMN uploaded_by uuid,
ADD COLUMN file_type text,
ADD COLUMN updated_at timestamp with time zone DEFAULT now();

-- Update existing records to have uploaded_by as null (they can be cleaned up later)
-- Create RLS policies for letter_attachments table
CREATE POLICY "Users can upload attachments to their tenant letters"
ON public.letter_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.letters l
    INNER JOIN public.user_tenant_memberships utm ON utm.tenant_id = l.tenant_id
    WHERE l.id = letter_attachments.letter_id
    AND utm.user_id = auth.uid()
    AND utm.is_active = true
  )
  AND (uploaded_by = auth.uid() OR uploaded_by IS NULL)
);

CREATE POLICY "Users can delete attachments from their tenant letters"
ON public.letter_attachments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.letters l
    INNER JOIN public.user_tenant_memberships utm ON utm.tenant_id = l.tenant_id
    WHERE l.id = letter_attachments.letter_id
    AND utm.user_id = auth.uid()
    AND utm.is_active = true
  )
);