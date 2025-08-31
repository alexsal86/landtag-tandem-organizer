-- Create RLS policies for letter_attachments table
CREATE POLICY "Users can view attachments from their tenant letters"
ON public.letter_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.letters l
    INNER JOIN public.user_tenant_memberships utm ON utm.tenant_id = l.tenant_id
    WHERE l.id = letter_attachments.letter_id
    AND utm.user_id = auth.uid()
    AND utm.is_active = true
  )
);