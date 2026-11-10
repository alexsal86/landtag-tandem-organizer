-- Add restrictive boundaries instead of rewriting historical policies or data.
CREATE OR REPLACE FUNCTION public.can_access_knowledge_document(_document_id uuid,_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT (_user_id=auth.uid() OR auth.role()='service_role') AND EXISTS(
    SELECT 1 FROM knowledge_documents d
    WHERE d.id=_document_id AND EXISTS(SELECT 1 FROM user_tenant_memberships m
      WHERE m.tenant_id=d.tenant_id AND m.user_id=_user_id AND m.is_active)
    AND (d.created_by=_user_id OR d.is_published OR EXISTS(SELECT 1 FROM knowledge_document_permissions p
      WHERE p.document_id=d.id AND p.user_id=_user_id))
  );
$$;
CREATE OR REPLACE FUNCTION public.can_edit_knowledge_document(_document_id uuid,_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT (_user_id=auth.uid() OR auth.role()='service_role') AND EXISTS(
    SELECT 1 FROM knowledge_documents d
    WHERE d.id=_document_id AND EXISTS(SELECT 1 FROM user_tenant_memberships m
      WHERE m.tenant_id=d.tenant_id AND m.user_id=_user_id AND m.is_active)
    AND (d.created_by=_user_id OR (NOT coalesce(d.is_locked,false) AND EXISTS(SELECT 1 FROM knowledge_document_permissions p
      WHERE p.document_id=d.id AND p.user_id=_user_id AND p.permission_type='edit')))
  );
$$;
CREATE POLICY knowledge_legacy_tenant_boundary ON public.knowledge_documents AS RESTRICTIVE FOR ALL TO authenticated
  USING(public.knowledge_qa_can_access(tenant_id)) WITH CHECK(public.knowledge_qa_can_access(tenant_id));
CREATE POLICY knowledge_legacy_read_boundary ON public.knowledge_documents AS RESTRICTIVE FOR SELECT TO authenticated
  USING(public.can_access_knowledge_document(id,auth.uid()));
CREATE POLICY knowledge_legacy_edit_boundary ON public.knowledge_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING(public.can_edit_knowledge_document(id,auth.uid())) WITH CHECK(public.can_edit_knowledge_document(id,auth.uid()));
CREATE POLICY knowledge_legacy_anon_boundary ON public.knowledge_documents AS RESTRICTIVE FOR ALL TO anon USING(false) WITH CHECK(false);

CREATE FUNCTION public.knowledge_qa_keep_legacy_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Büro und ursprünglicher Autor dürfen nicht geändert werden' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER knowledge_legacy_identity BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_keep_legacy_identity();
REVOKE ALL ON FUNCTION public.knowledge_qa_keep_legacy_identity() FROM PUBLIC,anon,authenticated;

DO $$
DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY['knowledge_document_versions','knowledge_document_snapshots','knowledge_document_collaborators','knowledge_document_topics','knowledge_document_permissions'] LOOP
    IF to_regclass('public.' || relation) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY knowledge_parent_read_boundary ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_access_knowledge_document(document_id,auth.uid()))',relation);
      EXECUTE format('CREATE POLICY knowledge_parent_anon_boundary ON public.%I AS RESTRICTIVE FOR ALL TO anon USING(false) WITH CHECK(false)',relation);
      IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=relation AND column_name='tenant_id') THEN
        EXECUTE format('CREATE POLICY knowledge_parent_insert_boundary ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_edit_knowledge_document(document_id,auth.uid()) AND EXISTS(SELECT 1 FROM public.knowledge_documents d WHERE d.id=document_id AND d.tenant_id=%I.tenant_id))',relation,relation);
      ELSIF relation='knowledge_document_snapshots' THEN
        EXECUTE format('CREATE POLICY knowledge_parent_insert_boundary ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_edit_knowledge_document(document_id,auth.uid()))',relation);
      END IF;
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.can_access_knowledge_document(uuid,uuid),public.can_edit_knowledge_document(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_knowledge_document(uuid,uuid),public.can_edit_knowledge_document(uuid,uuid) TO authenticated,service_role;
