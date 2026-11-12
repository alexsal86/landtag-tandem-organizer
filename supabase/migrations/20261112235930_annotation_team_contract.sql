-- Existing installations already have parent_id; make the schema contract idempotent.
ALTER TABLE public.document_annotations ADD COLUMN IF NOT EXISTS parent_id uuid;
CREATE INDEX IF NOT EXISTS idx_document_annotations_parent ON public.document_annotations(parent_id);
DO $$
DECLARE parent_column smallint;
BEGIN
  SELECT attnum INTO parent_column FROM pg_attribute WHERE attrelid='public.document_annotations'::regclass AND attname='parent_id' AND NOT attisdropped;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.document_annotations'::regclass AND contype='f'
    AND conkey=ARRAY[parent_column] AND confrelid='public.document_annotations'::regclass) THEN
    ALTER TABLE public.document_annotations ADD CONSTRAINT document_annotations_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES public.document_annotations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.document_annotation_reply_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'annotation parent is immutable';
  END IF;
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.document_annotations p WHERE p.id=NEW.parent_id
    AND p.id<>NEW.id AND p.document_id=NEW.document_id AND p.tenant_id=NEW.tenant_id AND p.parent_id IS NULL) THEN
    RAISE EXCEPTION 'invalid annotation parent';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_annotation_reply_guard ON public.document_annotations;
CREATE TRIGGER trg_annotation_reply_guard BEFORE INSERT OR UPDATE ON public.document_annotations
FOR EACH ROW EXECUTE FUNCTION public.document_annotation_reply_guard();
REVOKE EXECUTE ON FUNCTION public.document_annotation_reply_guard() FROM PUBLIC,anon,authenticated;

-- Both the edit guard and delete policy use the same permission predicate.
CREATE OR REPLACE FUNCTION public.document_annotation_can_manage(_tenant uuid, _author uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND public.is_tenant_member(_tenant,auth.uid())
    AND (_author=auth.uid() OR public.has_role(auth.uid(),'abgeordneter'::public.app_role)
      OR public.has_role(auth.uid(),'bueroleitung'::public.app_role));
$$;
REVOKE EXECUTE ON FUNCTION public.document_annotation_can_manage(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.document_annotation_can_manage(uuid,uuid) TO authenticated;
DROP POLICY IF EXISTS "Author or leads delete annotations" ON public.document_annotations;
CREATE POLICY "Author or leads delete annotations" ON public.document_annotations FOR DELETE TO authenticated
USING (public.document_annotation_can_manage(tenant_id,created_by));
CREATE OR REPLACE FUNCTION public.document_annotations_guard_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.document_annotation_can_manage(OLD.tenant_id,OLD.created_by) AND (
    NEW.content IS DISTINCT FROM OLD.content OR NEW.color IS DISTINCT FROM OLD.color
    OR NEW.target_selector IS DISTINCT FROM OLD.target_selector OR NEW.annotation_type IS DISTINCT FROM OLD.annotation_type
    OR NEW.page_number IS DISTINCT FROM OLD.page_number OR NEW.quote_text IS DISTINCT FROM OLD.quote_text
    OR NEW.file_kind IS DISTINCT FROM OLD.file_kind OR NEW.file_version IS DISTINCT FROM OLD.file_version
  ) THEN RAISE EXCEPTION 'only author or leads may edit annotation' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.document_annotations_guard_edit() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.document_annotation_mention_ids(_content text)
RETURNS SETOF uuid LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT DISTINCT (m)[1]::uuid FROM regexp_matches(coalesce(_content,''),
    '@\[[^]\r\n]*\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)', 'g') AS m;
$$;
REVOKE EXECUTE ON FUNCTION public.document_annotation_mention_ids(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.document_annotation_mention_ids(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.document_annotation_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE recipient uuid; old_content text:=''; doc_title text; message text;
BEGIN
  IF TG_OP='UPDATE' THEN old_content:=OLD.content; END IF;
  IF NEW.content=old_content THEN RETURN NEW; END IF;
  SELECT title INTO doc_title FROM public.documents WHERE id=NEW.document_id;
  message:=regexp_replace(NEW.content,'@\[([^]\r\n]*)\]\([0-9a-fA-F-]{36}\)','@\1','g');
  FOR recipient IN
    SELECT * FROM public.document_annotation_mention_ids(NEW.content)
    EXCEPT SELECT * FROM public.document_annotation_mention_ids(old_content)
  LOOP
    IF recipient<>auth.uid() AND public.is_tenant_member(NEW.tenant_id,recipient) THEN
      PERFORM public.create_notification(recipient,'document_mention','Erwähnung: '||doc_title,message,
        jsonb_build_object('document_id',NEW.document_id,'annotation_id',NEW.id,'document_type','annotation','tenant_id',NEW.tenant_id),'medium');
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_annotation_mentions ON public.document_annotations;
CREATE TRIGGER trg_annotation_mentions AFTER INSERT OR UPDATE OF content ON public.document_annotations
FOR EACH ROW EXECUTE FUNCTION public.document_annotation_mentions();
REVOKE EXECUTE ON FUNCTION public.document_annotation_mentions() FROM PUBLIC,anon,authenticated;

-- Membership rows are private to staff; expose only this tenant-scoped mention directory.
CREATE OR REPLACE FUNCTION public.document_annotation_mention_members(_tenant uuid)
RETURNS TABLE(user_id uuid,display_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT m.user_id,coalesce(nullif(max(p.display_name),''),'Mitarbeiter')
  FROM public.user_tenant_memberships m LEFT JOIN public.profiles p ON p.user_id=m.user_id
  WHERE m.tenant_id=_tenant AND m.is_active=true AND auth.uid() IS NOT NULL AND public.is_tenant_member(_tenant,auth.uid())
  GROUP BY m.user_id;
$$;
REVOKE EXECUTE ON FUNCTION public.document_annotation_mention_members(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.document_annotation_mention_members(uuid) TO authenticated;

-- Read-only selftest of the active account's server permissions and the actual RLS/trigger wiring.
CREATE OR REPLACE FUNCTION public.document_annotations_permissions_selftest(_tenant uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE checks jsonb; lead boolean; policy_expression text:='document_annotation_can_manage(tenant_id,created_by)';
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_member(_tenant,auth.uid()) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE='42501';
  END IF;
  lead:=public.has_role(auth.uid(),'abgeordneter'::public.app_role) OR public.has_role(auth.uid(),'bueroleitung'::public.app_role);
  checks:=jsonb_build_object(
    'own_edit',public.document_annotation_can_manage(_tenant,auth.uid()),
    'mention_directory',EXISTS (SELECT 1 FROM public.document_annotation_mention_members(_tenant) WHERE user_id=auth.uid())
      AND NOT EXISTS (SELECT 1 FROM public.document_annotation_mention_members(_tenant) m WHERE NOT public.is_tenant_member(_tenant,m.user_id)),
    'foreign_edit',public.document_annotation_can_manage(_tenant,gen_random_uuid())=lead,
    'foreign_tenant_denied',NOT public.document_annotation_can_manage(gen_random_uuid(),auth.uid()),
    'rls_enabled',(SELECT relrowsecurity FROM pg_class WHERE oid='public.document_annotations'::regclass),
    'delete_policy',EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid='public.document_annotations'::regclass AND p.polcmd='d' AND p.polpermissive
      AND 'authenticated'::regrole::oid=ANY(p.polroles)
      AND replace(regexp_replace(pg_get_expr(p.polqual,p.polrelid),'\s','','g'),'public.','') IN (policy_expression,'('||policy_expression||')'))
      AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid='public.document_annotations'::regclass AND p.polcmd IN ('d','*') AND p.polpermissive
        AND (0::oid=ANY(p.polroles) OR 'authenticated'::regrole::oid=ANY(p.polroles))
        AND replace(regexp_replace(coalesce(pg_get_expr(p.polqual,p.polrelid),''),'\s','','g'),'public.','') NOT IN (policy_expression,'('||policy_expression||')')),
    'edit_trigger',EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.document_annotations'::regclass AND tgfoid='public.document_annotations_guard_edit()'::regprocedure AND tgenabled IN ('O','A')),
    'edit_uses_permission_rule',position('document_annotation_can_manage' IN pg_get_functiondef('public.document_annotations_guard_edit()'::regprocedure))>0,
    'thread_cascade',EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.conrelid='public.document_annotations'::regclass AND c.confrelid=c.conrelid AND c.contype='f' AND a.attname='parent_id' AND c.confdeltype='c'),
    'reply_trigger',EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.document_annotations'::regclass AND tgfoid='public.document_annotation_reply_guard()'::regprocedure AND tgenabled IN ('O','A')),
    'mention_trigger',EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.document_annotations'::regclass AND tgfoid='public.document_annotation_mentions()'::regprocedure AND tgenabled IN ('O','A'))
  );
  RETURN jsonb_build_object('ok',NOT EXISTS (SELECT 1 FROM jsonb_each(checks) c WHERE c.value IS DISTINCT FROM 'true'::jsonb),
    'checks',checks,'message','Serverrollen, RLS, Löschpolicy und Trigger des aktuellen Kontos geprüft.');
END $$;
REVOKE EXECUTE ON FUNCTION public.document_annotations_permissions_selftest(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.document_annotations_permissions_selftest(uuid) TO authenticated;
