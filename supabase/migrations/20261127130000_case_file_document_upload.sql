INSERT INTO storage.buckets (id, name, public)
VALUES ('case-file-documents', 'case-file-documents', false);

CREATE POLICY "Upload case documents to own tenant folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'case-file-documents'
  AND (storage.foldername(name))[1] = 'case-files'
  AND (storage.foldername(name))[2] = ANY (
    SELECT t::text FROM unnest(public.get_user_tenant_ids((SELECT auth.uid()))) t
  )
  AND (storage.foldername(name))[3] = (SELECT auth.uid()::text)
);

CREATE POLICY "Read own uploads and visible case documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'case-file-documents'
  AND (storage.foldername(name))[2] = ANY (
    SELECT t::text FROM unnest(public.get_user_tenant_ids((SELECT auth.uid()))) t
  )
  AND (
    (storage.foldername(name))[3] = (SELECT auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path LIKE 'case-files/%' AND d.file_path = storage.objects.name
        AND d.tenant_id::text = (storage.foldername(storage.objects.name))[2]
    )
  )
);

CREATE POLICY "Delete own uploads and visible case documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'case-file-documents'
  AND (storage.foldername(name))[2] = ANY (
    SELECT t::text FROM unnest(public.get_user_tenant_ids((SELECT auth.uid()))) t
  )
  AND (
    (storage.foldername(name))[3] = (SELECT auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path LIKE 'case-files/%' AND d.file_path = storage.objects.name
        AND d.tenant_id::text = (storage.foldername(storage.objects.name))[2]
    )
  )
);

-- Keep documents from private cases out of other users' library results.
-- The uploader can still manage their document after its source case is removed.
CREATE POLICY "Restrict case document rows to the uploader or accessible source case"
ON public.documents AS RESTRICTIVE FOR ALL TO authenticated
USING (file_path NOT LIKE 'case-files/%' OR user_id = (SELECT auth.uid()) OR EXISTS (
  SELECT 1 FROM public.case_files cf
  WHERE cf.id::text = split_part(documents.file_path, '/', 4)
    AND cf.tenant_id = documents.tenant_id
))
WITH CHECK (file_path NOT LIKE 'case-files/%' OR user_id = (SELECT auth.uid()) OR EXISTS (
  SELECT 1 FROM public.case_files cf
  WHERE cf.id::text = split_part(documents.file_path, '/', 4)
    AND cf.tenant_id = documents.tenant_id
));

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_documents_file_path
  ON public.documents (file_path) WHERE file_path LIKE 'case-files/%';
CREATE INDEX IF NOT EXISTS idx_documents_description_trgm ON public.documents USING gin (description extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_file_name_trgm ON public.documents USING gin (file_name extensions.gin_trgm_ops);

CREATE FUNCTION public.create_case_file_document(
  p_case_file_id uuid,
  p_tenant_id uuid,
  p_title text,
  p_file_name text,
  p_file_path text,
  p_file_size bigint,
  p_file_type text,
  p_relevance text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_document_id uuid;
BEGIN
  IF v_user_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.case_files
      WHERE id = p_case_file_id AND tenant_id = p_tenant_id
    )
    OR split_part(p_file_path, '/', 1) IS DISTINCT FROM 'case-files'
    OR split_part(p_file_path, '/', 2) IS DISTINCT FROM p_tenant_id::text
    OR split_part(p_file_path, '/', 3) IS DISTINCT FROM v_user_id::text
    OR split_part(p_file_path, '/', 4) IS DISTINCT FROM p_case_file_id::text
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects WHERE bucket_id = 'case-file-documents' AND name = p_file_path
    )
  THEN
    RAISE EXCEPTION 'Case file or upload is unavailable' USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(p_title), '') IS NULL OR p_relevance IS NULL
    OR p_relevance NOT IN ('primary', 'supporting', 'reference')
  THEN
    RAISE EXCEPTION 'Invalid title or relevance' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.documents (tenant_id, user_id, title, file_name, file_path, file_size, file_type, status)
  VALUES (p_tenant_id, v_user_id, btrim(p_title), p_file_name, p_file_path, p_file_size, p_file_type, 'draft')
  ON CONFLICT (file_path) WHERE file_path LIKE 'case-files/%' DO NOTHING
  RETURNING id INTO v_document_id;

  IF v_document_id IS NULL THEN
    SELECT id INTO STRICT v_document_id FROM public.documents
    WHERE file_path = p_file_path AND tenant_id = p_tenant_id AND user_id = v_user_id;
    RETURN v_document_id;
  END IF;

  INSERT INTO public.case_file_documents (case_file_id, document_id, relevance, notes)
  VALUES (p_case_file_id, v_document_id, p_relevance, nullif(btrim(p_notes), ''));

  INSERT INTO public.case_file_timeline (case_file_id, event_date, event_type, title, source_type, source_id, created_by)
  VALUES (p_case_file_id, now(), 'document', 'Dokument hinzugefügt: ' || btrim(p_title), 'document', v_document_id, v_user_id);

  RETURN v_document_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_case_file_document(uuid, uuid, text, text, text, bigint, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_case_file_document(uuid, uuid, text, text, text, bigint, text, text, text) TO authenticated;
