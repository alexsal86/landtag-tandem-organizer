-- Add remaining RLS policies for letter_attachments table
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
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Users can delete their own attachments"
ON public.letter_attachments
FOR DELETE
USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.letters l
    INNER JOIN public.user_tenant_memberships utm ON utm.tenant_id = l.tenant_id
    WHERE l.id = letter_attachments.letter_id
    AND utm.user_id = auth.uid()
    AND utm.is_active = true
  )
);