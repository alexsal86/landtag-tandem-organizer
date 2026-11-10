INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('knowledge-attachments','knowledge-attachments',false,20971520,ARRAY[
  'application/pdf','text/plain','text/csv','image/png','image/jpeg','image/webp',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

CREATE FUNCTION public.knowledge_qa_reserve_attachment(p_question uuid,p_name text,p_type text,p_size bigint)
RETURNS public.knowledge_question_attachments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; a knowledge_question_attachments; new_id uuid:=gen_random_uuid();
BEGIN
  SELECT * INTO q FROM knowledge_questions WHERE id=p_question FOR UPDATE;
  IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
  IF q.answered_at IS NULL THEN RAISE EXCEPTION 'Bitte zuerst die Antwort speichern' USING ERRCODE='22023'; END IF;
  IF p_type IS NULL OR p_type<>ALL(ARRAY['application/pdf','text/plain','text/csv','image/png','image/jpeg','image/webp',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) THEN
    RAISE EXCEPTION 'Dieser Dateityp ist nicht erlaubt' USING ERRCODE='22023'; END IF;
  INSERT INTO knowledge_question_attachments(id,tenant_id,question_id,storage_path,file_name,file_type,file_size,uploaded_by)
    VALUES(new_id,q.tenant_id,q.id,q.tenant_id::text || '/' || q.id::text || '/' || new_id::text,p_name,p_type,p_size,auth.uid()) RETURNING * INTO a;
  RETURN a;
END $$;

CREATE FUNCTION public.knowledge_qa_finish_attachment(p_attachment uuid,p_expected_revision integer,p_remove boolean DEFAULT false)
RETURNS public.knowledge_questions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a knowledge_question_attachments; q knowledge_questions; object_metadata jsonb;
BEGIN
  -- Lock parent before attachment, in the same order as reservation.
  SELECT * INTO a FROM knowledge_question_attachments WHERE id=p_attachment;
  SELECT * INTO q FROM knowledge_questions WHERE id=a.question_id FOR UPDATE;
  IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM knowledge_question_attachments WHERE id=p_attachment FOR UPDATE;
  IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Antwort wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  IF p_remove IS NULL THEN RAISE EXCEPTION 'Ungültige Aktion' USING ERRCODE='22023'; END IF;
  IF p_remove THEN
    IF a.state='removed' THEN RETURN q; END IF;
    UPDATE knowledge_question_attachments SET state='removed' WHERE id=a.id;
  ELSE
    IF a.state<>'pending' OR a.uploaded_by<>auth.uid() THEN RAISE EXCEPTION 'Ungültiger Upload' USING ERRCODE='42501'; END IF;
    SELECT metadata INTO object_metadata FROM storage.objects WHERE bucket_id='knowledge-attachments' AND name=a.storage_path;
    IF NOT FOUND OR (object_metadata->>'size')::bigint IS DISTINCT FROM a.file_size OR object_metadata->>'mimetype' IS DISTINCT FROM a.file_type THEN
      RAISE EXCEPTION 'Datei wurde nicht vollständig hochgeladen' USING ERRCODE='22023'; END IF;
    UPDATE knowledge_question_attachments SET state='ready' WHERE id=a.id;
  END IF;
  -- Cancelled pending uploads do not change the published answer.
  IF p_remove AND a.state='pending' THEN RETURN q; END IF;
  UPDATE knowledge_questions SET revision=revision+1,answer_revision=answer_revision+1,
    updated_at=now(),answer_updated_at=now(),updated_by=auth.uid(),review_status='unverified',
    verified_by=NULL,verified_at=NULL,verified_answer_revision=NULL,review_due_at=NULL
    WHERE id=q.id RETURNING * INTO q;
  RETURN q;
END $$;

CREATE FUNCTION public.knowledge_qa_file_allowed(p_path text,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM knowledge_question_attachments a WHERE a.storage_path=p_path
    AND knowledge_qa_can_access(a.tenant_id,CASE WHEN p_action='read' THEN NULL ELSE 'knowledge.write' END)
    AND CASE p_action WHEN 'read' THEN a.state='ready' OR (a.state='pending' AND a.uploaded_by=auth.uid())
        OR (a.state='removed' AND knowledge_qa_can_access(a.tenant_id,'knowledge.write'))
      WHEN 'upload' THEN a.state='pending' AND a.uploaded_by=auth.uid()
      WHEN 'delete' THEN a.state='removed' OR (a.state='pending' AND a.uploaded_by=auth.uid()) ELSE false END);
$$;
CREATE POLICY knowledge_files_read ON storage.objects FOR SELECT TO authenticated
  USING(bucket_id='knowledge-attachments' AND public.knowledge_qa_file_allowed(name,'read'));
CREATE POLICY knowledge_files_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id='knowledge-attachments' AND public.knowledge_qa_file_allowed(name,'upload'));
CREATE POLICY knowledge_files_delete ON storage.objects FOR DELETE TO authenticated
  USING(bucket_id='knowledge-attachments' AND public.knowledge_qa_file_allowed(name,'delete'));
-- Existing generic storage policies must never broaden this private bucket's ACL.
CREATE POLICY knowledge_files_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING(bucket_id<>'knowledge-attachments' OR public.knowledge_qa_file_allowed(name,'read') OR public.knowledge_qa_file_allowed(name,'delete'))
  WITH CHECK(bucket_id<>'knowledge-attachments' OR public.knowledge_qa_file_allowed(name,'upload'));
CREATE POLICY knowledge_files_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING(bucket_id<>'knowledge-attachments' OR public.knowledge_qa_file_allowed(name,'read'));
CREATE POLICY knowledge_files_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING(bucket_id<>'knowledge-attachments' OR public.knowledge_qa_file_allowed(name,'delete'));
CREATE POLICY knowledge_files_no_overwrite ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING(bucket_id<>'knowledge-attachments') WITH CHECK(bucket_id<>'knowledge-attachments');
CREATE POLICY knowledge_files_anon_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO anon
  USING(bucket_id<>'knowledge-attachments') WITH CHECK(bucket_id<>'knowledge-attachments');

REVOKE ALL ON FUNCTION public.knowledge_qa_reserve_attachment(uuid,text,text,bigint),
  public.knowledge_qa_finish_attachment(uuid,integer,boolean),public.knowledge_qa_file_allowed(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_reserve_attachment(uuid,text,text,bigint),
  public.knowledge_qa_finish_attachment(uuid,integer,boolean),public.knowledge_qa_file_allowed(text,text) TO authenticated;
