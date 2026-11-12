ALTER TABLE public.document_annotations ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_annotations_assignee ON public.document_annotations(document_id,assigned_to) WHERE parent_id IS NULL;

-- Links are written only by the atomic task RPC. Deleting a note keeps its task/document link.
CREATE TABLE public.document_annotation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id uuid UNIQUE REFERENCES public.document_annotations(id) ON DELETE SET NULL,
  task_id uuid NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_annotation_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_annotation_tasks FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.document_annotation_tasks TO authenticated;
GRANT ALL ON public.document_annotation_tasks TO service_role;
CREATE POLICY "Tenant members read annotation tasks" ON public.document_annotation_tasks FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id,auth.uid()));
CREATE INDEX idx_annotation_tasks_document ON public.document_annotation_tasks(document_id);

CREATE OR REPLACE FUNCTION public.document_annotation_assignment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE scope_tenant uuid; scope_parent uuid;
BEGIN
  IF TG_OP='UPDATE' THEN scope_tenant:=OLD.tenant_id; scope_parent:=OLD.parent_id;
  ELSE scope_tenant:=NEW.tenant_id; scope_parent:=NEW.parent_id; END IF;
  IF NEW.assigned_to IS NOT NULL THEN
    IF scope_parent IS NOT NULL THEN RAISE EXCEPTION 'Assign the thread, not a reply' USING ERRCODE='22023'; END IF;
    IF TG_OP='INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      IF NOT public.is_tenant_member(scope_tenant,NEW.assigned_to) THEN
        RAISE EXCEPTION 'Die Person gehört nicht zum Büro' USING ERRCODE='22023';
      END IF;
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    AND NOT public.document_annotation_can_manage(OLD.tenant_id,OLD.created_by)
    -- Allow FK cleanup during account deletion without granting reassignment rights.
    AND NOT (NEW.assigned_to IS NULL AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.assigned_to)) THEN
    RAISE EXCEPTION 'Nur Autor oder Leitung dürfen die Zuständigkeit ändern' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_annotation_assignment BEFORE INSERT OR UPDATE ON public.document_annotations
FOR EACH ROW EXECUTE FUNCTION public.document_annotation_assignment_guard();
REVOKE EXECUTE ON FUNCTION public.document_annotation_assignment_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_document_annotation_task(_annotation uuid,_title text DEFAULT NULL,_assignee uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.document_annotations; d public.documents; v_task_id uuid; owner_id uuid; title_text text; body text;
BEGIN
  SELECT * INTO a FROM public.document_annotations WHERE id=_annotation AND public.is_tenant_member(tenant_id,auth.uid()) FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_tenant_member(a.tenant_id,auth.uid()) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE='42501';
  END IF;
  IF a.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Aufgabe aus der Hauptanmerkung erstellen' USING ERRCODE='22023'; END IF;
  SELECT l.task_id INTO v_task_id FROM public.document_annotation_tasks l WHERE l.annotation_id=a.id;
  IF v_task_id IS NOT NULL THEN RETURN v_task_id; END IF;
  owner_id:=coalesce(_assignee,a.assigned_to,auth.uid());
  IF NOT public.is_tenant_member(a.tenant_id,owner_id) THEN RAISE EXCEPTION 'Die Person gehört nicht zum Büro' USING ERRCODE='22023'; END IF;
  SELECT * INTO d FROM public.documents WHERE id=a.document_id AND tenant_id=a.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dokument nicht gefunden' USING ERRCODE='22023'; END IF;
  title_text:=coalesce(nullif(btrim(_title),''),'Anmerkung klären – '||d.title||CASE WHEN a.page_number IS NULL THEN '' ELSE ' · Seite '||a.page_number END);
  IF length(title_text)>240 THEN RAISE EXCEPTION 'Aufgabentitel zu lang' USING ERRCODE='22023'; END IF;
  body:=regexp_replace(a.content,'@\[([^]\r\n]*)\]\([0-9a-fA-F-]{36}\)','@\1','g');
  body:=concat_ws(E'\n\n',nullif(body,''),CASE WHEN nullif(a.quote_text,'') IS NOT NULL THEN 'Markierte Stelle: '||a.quote_text END,
    'Originaldokument: '||d.title||CASE WHEN a.page_number IS NULL THEN '' ELSE ' · Seite '||a.page_number END,
    '/documents?tab=documents&annotate='||d.id||'&annotation='||a.id);
  v_task_id:=gen_random_uuid();
  INSERT INTO public.tasks(id,user_id,tenant_id,title,description,assigned_to,status,priority,category,
    ball_owner,ball_assignee_id,next_action,source_type,source_id,timeline)
  VALUES(v_task_id,auth.uid(),a.tenant_id,title_text,body,owner_id::text,'todo',CASE WHEN a.color='red' THEN 'high' ELSE 'medium' END,'personal',
    'office',owner_id,title_text,'document_annotation',a.id,
    jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','system','at',now(),
      'actorName',coalesce((SELECT display_name FROM public.profiles WHERE user_id=auth.uid() LIMIT 1),'System'),
      'text','Aufgabe aus Anmerkung zu „'||d.title||'“ erstellt')));
  -- The existing assigned_to trigger normally does this; ON CONFLICT also supports older installations.
  INSERT INTO public.task_assignees(task_id,user_id,assigned_by) VALUES(v_task_id,owner_id,auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO public.document_annotation_tasks(annotation_id,task_id,document_id,tenant_id) VALUES(a.id,v_task_id,d.id,a.tenant_id);
  -- Existing per-document Realtime subscribers pick up the new task link in the same commit.
  UPDATE public.document_annotations SET updated_at=now() WHERE id=a.id;
  RETURN v_task_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_document_annotation_task(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_document_annotation_task(uuid,text,uuid) TO authenticated;

-- Exercise persistence/idempotence/Stafette in a subtransaction; no test tasks or notifications survive.
CREATE OR REPLACE FUNCTION public.document_annotation_task_selftest(_tenant uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_document_id uuid; v_annotation_id uuid; first_task uuid; second_task uuid; t public.tasks; checks jsonb:='{}';
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_member(_tenant,auth.uid()) THEN RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE='42501'; END IF;
  BEGIN
    INSERT INTO public.documents(tenant_id,user_id,title,file_name,file_path)
      VALUES(_tenant,auth.uid(),'[SELFTEST] Annotation-Aufgabe','selftest.pdf','selftest/'||gen_random_uuid()||'.pdf') RETURNING id INTO v_document_id;
    INSERT INTO public.document_annotations(tenant_id,document_id,created_by,file_kind,annotation_type,color,content,page_number,target_selector)
      VALUES(_tenant,v_document_id,auth.uid(),'pdf','rect','red','[SELFTEST] Rückfrage formulieren',12,'{"rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.2}]}') RETURNING id INTO v_annotation_id;
    UPDATE public.document_annotations SET assigned_to=auth.uid() WHERE id=v_annotation_id;
    checks:=checks||jsonb_build_object('assignment',EXISTS(SELECT 1 FROM public.document_annotations WHERE id=v_annotation_id AND assigned_to=auth.uid()));
    BEGIN
      UPDATE public.document_annotations SET assigned_to=gen_random_uuid() WHERE id=v_annotation_id;
      checks:=checks||jsonb_build_object('foreign_assignee_denied',false);
    EXCEPTION WHEN SQLSTATE '22023' THEN checks:=checks||jsonb_build_object('foreign_assignee_denied',true); END;
    first_task:=public.create_document_annotation_task(v_annotation_id,'[SELFTEST] Rückfrage zu Seite 12',auth.uid());
    second_task:=public.create_document_annotation_task(v_annotation_id,'[SELFTEST] Doppelklick',auth.uid());
    SELECT * INTO t FROM public.tasks WHERE id=first_task;
    checks:=checks||jsonb_build_object('idempotent',first_task=second_task,'stafette',t.ball_owner='office' AND t.ball_assignee_id=auth.uid()
      AND t.next_action='[SELFTEST] Rückfrage zu Seite 12' AND t.priority='high' AND t.status='todo',
      'assignee',EXISTS(SELECT 1 FROM public.task_assignees a WHERE a.task_id=first_task AND a.user_id=auth.uid()),
      'document_link',EXISTS(SELECT 1 FROM public.document_annotation_tasks l WHERE l.annotation_id=v_annotation_id AND l.task_id=first_task AND l.document_id=v_document_id),
      'back_link',position('annotate='||v_document_id::text IN t.description)>0 AND position('annotation='||v_annotation_id::text IN t.description)>0);
    RAISE EXCEPTION 'rollback selftest' USING ERRCODE='ZX014';
  EXCEPTION WHEN SQLSTATE 'ZX014' THEN NULL;
    WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'message',SQLERRM,'checks',checks);
  END;
  RETURN jsonb_build_object('ok',NOT EXISTS(SELECT 1 FROM jsonb_each(checks) c WHERE c.value IS DISTINCT FROM 'true'::jsonb),
    'message','Zuständigkeit und idempotente Stafette-Aufgabe geprüft; sämtliche Teständerungen zurückgerollt.','checks',checks);
END $$;
REVOKE EXECUTE ON FUNCTION public.document_annotation_task_selftest(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.document_annotation_task_selftest(uuid) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='document_annotation_tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.document_annotation_tasks;
  END IF;
END $$;
