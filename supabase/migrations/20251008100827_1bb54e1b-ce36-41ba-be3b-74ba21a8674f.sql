-- Create separate storage bucket for decision attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'decision-attachments',
  'decision-attachments',
  false,
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
);

-- Policy 1: Upload (INSERT)
CREATE POLICY "Authenticated users can upload decision attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'decision-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Download (SELECT)
CREATE POLICY "Users can view decision attachments they have access to"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'decision-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    -- Own files
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Files from decisions they participate in
    EXISTS (
      SELECT 1 FROM public.task_decision_participants tdp
      JOIN public.task_decision_attachments tda ON tda.decision_id = tdp.decision_id
      WHERE tda.file_path = name
      AND tdp.user_id = auth.uid()
    )
    OR
    -- Files from own decisions
    EXISTS (
      SELECT 1 FROM public.task_decisions td
      JOIN public.task_decision_attachments tda ON tda.decision_id = td.id
      WHERE tda.file_path = name
      AND td.created_by = auth.uid()
    )
  )
);

-- Policy 3: Delete (DELETE)
CREATE POLICY "Users can delete their own decision attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'decision-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    -- Own files
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Files from own decisions (creator can delete all)
    EXISTS (
      SELECT 1 FROM public.task_decisions td
      JOIN public.task_decision_attachments tda ON tda.decision_id = td.id
      WHERE tda.file_path = name
      AND td.created_by = auth.uid()
    )
  )
);

-- Policy 4: Update (UPDATE) - for metadata
CREATE POLICY "Users can update their own decision attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'decision-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);