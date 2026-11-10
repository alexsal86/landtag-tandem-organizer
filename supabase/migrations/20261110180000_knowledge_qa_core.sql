-- Additive question/answer workspace. Existing knowledge tables remain intact.
CREATE TABLE public.knowledge_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 10000),
  assigned_to uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  answer_content jsonb,
  answer_text text NOT NULL DEFAULT '',
  answered_by uuid,
  answered_at timestamptz,
  answer_updated_at timestamptz,
  revision integer NOT NULL DEFAULT 1,
  answer_revision integer NOT NULL DEFAULT 0,
  review_status text NOT NULL DEFAULT 'unverified' CHECK (review_status IN ('unverified','verified','needs_review')),
  verified_by uuid,
  verified_at timestamptz,
  verified_answer_revision integer,
  review_due_at timestamptz,
  UNIQUE (tenant_id,id),
  CHECK ((answer_content IS NULL AND answer_text='' AND answered_at IS NULL) OR
    (answer_content IS NOT NULL AND length(btrim(answer_text)) BETWEEN 1 AND 50000 AND answered_at IS NOT NULL)),
  CHECK (review_status <> 'verified' OR
    (verified_by IS NOT NULL AND verified_at IS NOT NULL AND verified_answer_revision=answer_revision AND answer_content IS NOT NULL))
);
CREATE INDEX knowledge_questions_tenant_updated ON public.knowledge_questions(tenant_id,updated_at DESC,id);
CREATE INDEX knowledge_questions_open ON public.knowledge_questions(tenant_id,created_at DESC) WHERE answered_at IS NULL;
CREATE INDEX knowledge_questions_author ON public.knowledge_questions(tenant_id,created_by);

CREATE TABLE public.knowledge_question_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  question_id uuid NOT NULL,
  revision integer NOT NULL,
  event_type text NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL,
  FOREIGN KEY (tenant_id,question_id) REFERENCES public.knowledge_questions(tenant_id,id),
  UNIQUE (question_id,revision)
);
CREATE INDEX knowledge_question_events_author ON public.knowledge_question_events(tenant_id,actor_id,question_id);

CREATE TABLE public.knowledge_question_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  question_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  file_type text NOT NULL,
  file_size bigint NOT NULL CHECK (file_size BETWEEN 1 AND 20971520),
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','ready','removed')),
  FOREIGN KEY (tenant_id,question_id) REFERENCES public.knowledge_questions(tenant_id,id)
);
CREATE INDEX knowledge_question_attachments_parent ON public.knowledge_question_attachments(tenant_id,question_id);

CREATE FUNCTION public.knowledge_qa_can_access(p_tenant uuid,p_action text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM user_tenant_memberships
    WHERE tenant_id=p_tenant AND user_id=auth.uid() AND is_active
  ) AND (p_action IS NULL OR is_tenant_action_allowed(auth.uid(),p_tenant,p_action));
$$;

ALTER TABLE public.knowledge_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_question_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_question_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_questions_read ON public.knowledge_questions FOR SELECT TO authenticated
  USING (public.knowledge_qa_can_access(tenant_id));
CREATE POLICY knowledge_events_read ON public.knowledge_question_events FOR SELECT TO authenticated
  USING (public.knowledge_qa_can_access(tenant_id));
CREATE POLICY knowledge_attachments_read ON public.knowledge_question_attachments FOR SELECT TO authenticated
  USING (public.knowledge_qa_can_access(tenant_id) AND (state='ready' OR uploaded_by=auth.uid()));
REVOKE ALL ON public.knowledge_questions,public.knowledge_question_events,public.knowledge_question_attachments FROM anon,authenticated;
GRANT SELECT ON public.knowledge_questions,public.knowledge_question_events,public.knowledge_question_attachments TO authenticated;

-- Accept a small, explicit Lexical vocabulary; derive search text in the database.
CREATE FUNCTION public.knowledge_qa_node_text(p_node jsonb,p_depth integer DEFAULT 0)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE node_type text:=p_node->>'type'; child jsonb; result text:='';
BEGIN
  IF p_depth>24 OR jsonb_typeof(p_node)<>'object' OR node_type IS NULL OR
    node_type NOT IN ('root','paragraph','text','linebreak','heading','quote','list','listitem','link','autolink') THEN
    RAISE EXCEPTION 'Ungültiger Antwortinhalt' USING ERRCODE='22023';
  END IF;
  IF (node_type='root' AND p_depth<>0) OR coalesce(p_node->>'style','')<>'' OR
    (node_type='heading' AND coalesce(p_node->>'tag','') NOT IN ('h1','h2','h3','h4','h5','h6')) OR
    (node_type='list' AND coalesce(p_node->>'listType','') NOT IN ('bullet','number')) THEN
    RAISE EXCEPTION 'Nicht unterstützte Formatierung' USING ERRCODE='22023';
  END IF;
  IF node_type IN ('link','autolink') AND (coalesce(p_node->>'url','') !~* '^(https?://|mailto:)[^[:cntrl:] ]+$') THEN
    RAISE EXCEPTION 'Nur https-, http- und mailto-Links sind erlaubt' USING ERRCODE='22023';
  END IF;
  IF node_type='text' THEN
    IF jsonb_typeof(p_node->'text') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Ungültiger Text' USING ERRCODE='22023'; END IF;
    RETURN p_node->>'text';
  END IF;
  IF node_type='linebreak' THEN RETURN E'\n'; END IF;
  IF jsonb_typeof(p_node->'children') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ungültige Textstruktur' USING ERRCODE='22023'; END IF;
  FOR child IN SELECT value FROM jsonb_array_elements(p_node->'children') LOOP
    result:=result || knowledge_qa_node_text(child,p_depth+1);
  END LOOP;
  RETURN result || CASE WHEN node_type IN ('paragraph','heading','quote','listitem') THEN E'\n' ELSE '' END;
END $$;

CREATE FUNCTION public.knowledge_qa_record_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event_name text;
BEGIN
  IF TG_OP='INSERT' THEN event_name:='question_created';
  ELSIF NEW.answer_revision IS DISTINCT FROM OLD.answer_revision THEN event_name:='answer_changed';
  ELSIF NEW.verified_at IS DISTINCT FROM OLD.verified_at AND NEW.review_status='verified' THEN event_name:='verified';
  ELSIF NEW.review_status='needs_review' THEN event_name:='review_requested';
  ELSE event_name:='assignee_changed'; END IF;
  INSERT INTO knowledge_question_events(tenant_id,question_id,revision,event_type,actor_id,snapshot)
  VALUES(NEW.tenant_id,NEW.id,NEW.revision,event_name,auth.uid(),
    (to_jsonb(NEW)-'search_vector') || jsonb_build_object('attachments',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'file_size',a.file_size)), '[]'::jsonb)
       FROM knowledge_question_attachments a WHERE a.question_id=NEW.id AND a.state='ready')));
  RETURN NEW;
END $$;
CREATE TRIGGER knowledge_qa_audit AFTER INSERT OR UPDATE ON public.knowledge_questions
  FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_record_event();

CREATE FUNCTION public.knowledge_qa_create_question(p_tenant uuid,p_title text,p_description text DEFAULT '',p_assigned_to uuid DEFAULT NULL)
RETURNS public.knowledge_questions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result knowledge_questions;
BEGIN
  IF NOT knowledge_qa_can_access(p_tenant,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
  IF p_assigned_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_assigned_to AND is_active) THEN
    RAISE EXCEPTION 'Zuständige Person gehört nicht zum Büro' USING ERRCODE='22023';
  END IF;
  INSERT INTO knowledge_questions(tenant_id,title,description,assigned_to,created_by,updated_by)
    VALUES(p_tenant,btrim(p_title),coalesce(p_description,''),p_assigned_to,auth.uid(),auth.uid()) RETURNING * INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.knowledge_qa_save_answer(p_question uuid,p_expected_revision integer,p_content jsonb)
RETURNS public.knowledge_questions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; plain text;
BEGIN
  SELECT * INTO q FROM knowledge_questions WHERE id=p_question FOR UPDATE;
  IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
  IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Frage wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  IF p_content IS NULL OR octet_length(p_content::text)>200000 OR p_content->'root'->>'type' IS DISTINCT FROM 'root' THEN
    RAISE EXCEPTION 'Ungültiger oder zu langer Antwortinhalt' USING ERRCODE='22023';
  END IF;
  plain:=btrim(knowledge_qa_node_text(p_content->'root'), E' \n\r\t');
  IF length(plain) NOT BETWEEN 1 AND 50000 THEN RAISE EXCEPTION 'Bitte eine Antwort eingeben (höchstens 50.000 Zeichen)' USING ERRCODE='22023'; END IF;
  IF q.answer_content IS NOT DISTINCT FROM p_content THEN RETURN q; END IF;
  UPDATE knowledge_questions SET answer_content=p_content,answer_text=plain,
    answered_by=coalesce(answered_by,auth.uid()),answered_at=coalesce(answered_at,now()),
    answer_updated_at=now(),updated_at=now(),updated_by=auth.uid(),revision=revision+1,answer_revision=answer_revision+1,
    review_status='unverified',verified_by=NULL,verified_at=NULL,verified_answer_revision=NULL,review_due_at=NULL
    WHERE id=q.id RETURNING * INTO q;
  RETURN q;
END $$;

CREATE FUNCTION public.knowledge_qa_review(p_question uuid,p_expected_revision integer,p_verified boolean,p_due_at timestamptz DEFAULT NULL)
RETURNS public.knowledge_questions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions;
BEGIN
  SELECT * INTO q FROM knowledge_questions WHERE id=p_question FOR UPDATE;
  IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.verify') THEN RAISE EXCEPTION 'Keine Prüfberechtigung' USING ERRCODE='42501'; END IF;
  IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Antwort wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  IF q.answered_at IS NULL OR p_verified IS NULL THEN RAISE EXCEPTION 'Es gibt noch keine Antwort' USING ERRCODE='22023'; END IF;
  IF p_verified AND p_due_at IS NOT NULL AND p_due_at<=now() THEN RAISE EXCEPTION 'Prüftermin muss in der Zukunft liegen' USING ERRCODE='22023'; END IF;
  UPDATE knowledge_questions SET review_status=CASE WHEN p_verified THEN 'verified' ELSE 'needs_review' END,
    verified_by=CASE WHEN p_verified THEN auth.uid() END,verified_at=CASE WHEN p_verified THEN now() END,
    verified_answer_revision=CASE WHEN p_verified THEN answer_revision END,
    review_due_at=CASE WHEN p_verified THEN p_due_at ELSE review_due_at END,
    revision=revision+1,updated_at=now(),updated_by=auth.uid()
    WHERE id=q.id RETURNING * INTO q;
  RETURN q;
END $$;

CREATE FUNCTION public.knowledge_qa_set_assignee(p_question uuid,p_expected_revision integer,p_assigned_to uuid)
RETURNS public.knowledge_questions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions;
BEGIN
  SELECT * INTO q FROM knowledge_questions WHERE id=p_question FOR UPDATE;
  IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
  IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Frage wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  IF p_assigned_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=q.tenant_id AND user_id=p_assigned_to AND is_active) THEN
    RAISE EXCEPTION 'Zuständige Person gehört nicht zum Büro' USING ERRCODE='22023'; END IF;
  IF q.assigned_to IS NOT DISTINCT FROM p_assigned_to THEN RETURN q; END IF;
  UPDATE knowledge_questions SET assigned_to=p_assigned_to,revision=revision+1,updated_by=auth.uid(),updated_at=now()
    WHERE id=q.id RETURNING * INTO q;
  RETURN q;
END $$;

REVOKE ALL ON FUNCTION public.knowledge_qa_record_event(),public.knowledge_qa_node_text(jsonb,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.knowledge_qa_can_access(uuid,text),public.knowledge_qa_create_question(uuid,text,text,uuid),
  public.knowledge_qa_save_answer(uuid,integer,jsonb),public.knowledge_qa_review(uuid,integer,boolean,timestamptz),
  public.knowledge_qa_set_assignee(uuid,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_can_access(uuid,text),public.knowledge_qa_create_question(uuid,text,text,uuid),
  public.knowledge_qa_save_answer(uuid,integer,jsonb),public.knowledge_qa_review(uuid,integer,boolean,timestamptz),
  public.knowledge_qa_set_assignee(uuid,integer,uuid) TO authenticated;

-- The existing selftest center exercises real writes, but all test records and
-- audit events roll back in a subtransaction. No special delete permission.
CREATE FUNCTION public.knowledge_qa_selftest(p_tenant uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; previous knowledge_questions; result jsonb:='{}'; payload jsonb;
BEGIN
  IF NOT knowledge_qa_can_access(p_tenant) THEN RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE='42501'; END IF;
  BEGIN
    IF NOT knowledge_qa_can_access(p_tenant,'knowledge.write') THEN
      BEGIN
        PERFORM knowledge_qa_create_question(p_tenant,'Selbsttest: Wissensfrage');
        result:=jsonb_build_object('write_denied',false);
      EXCEPTION WHEN insufficient_privilege THEN result:=jsonb_build_object('write_denied',true); END;
    ELSE
      q:=knowledge_qa_create_question(p_tenant,'Selbsttest: Wissensfrage');
      result:=jsonb_build_object('question_without_assignee',q.assigned_to IS NULL AND q.answered_at IS NULL AND q.created_by=auth.uid());
      payload:=jsonb_build_object('root',jsonb_build_object('type','root','children',jsonb_build_array(
        jsonb_build_object('type','paragraph','children',jsonb_build_array(jsonb_build_object('type','text','text','Antwort im Selbsttest.'))))));
      q:=knowledge_qa_save_answer(q.id,q.revision,payload);
      result:=result || jsonb_build_object('answer_unverified',q.review_status='unverified' AND q.answer_text='Antwort im Selbsttest.');
      IF knowledge_qa_can_access(p_tenant,'knowledge.verify') THEN
        q:=knowledge_qa_review(q.id,q.revision,true);
        result:=result || jsonb_build_object('manual_review',q.verified_by=auth.uid() AND q.verified_at IS NOT NULL AND q.verified_answer_revision=q.answer_revision);
        q:=knowledge_qa_set_assignee(q.id,q.revision,auth.uid());
        result:=result || jsonb_build_object('assignment_preserves_review',q.review_status='verified');
        previous:=q;
        payload:=jsonb_set(payload,'{root,children,0,children,0,text}','"Geänderte Antwort im Selbsttest."');
        q:=knowledge_qa_save_answer(q.id,q.revision,payload);
        result:=result || jsonb_build_object('changed_answer_invalidates_review',q.review_status='unverified' AND q.verified_at IS NULL);
        BEGIN
          PERFORM knowledge_qa_review(previous.id,previous.revision,true);
          result:=result || jsonb_build_object('stale_review_denied',false);
        EXCEPTION WHEN serialization_failure THEN result:=result || jsonb_build_object('stale_review_denied',true); END;
        q:=knowledge_qa_review(q.id,q.revision,false);
        result:=result || jsonb_build_object('review_requested',q.review_status='needs_review');
      ELSE
        BEGIN
          PERFORM knowledge_qa_review(q.id,q.revision,true);
          result:=result || jsonb_build_object('review_denied',false);
        EXCEPTION WHEN insufficient_privilege THEN result:=result || jsonb_build_object('review_denied',true); END;
      END IF;
      result:=result || jsonb_build_object('atomic_history',EXISTS(SELECT 1 FROM knowledge_question_events WHERE question_id=q.id AND revision=q.revision AND actor_id=auth.uid()));
      BEGIN
        UPDATE knowledge_questions SET verified_by=auth.uid() WHERE id=q.id;
        result:=result || jsonb_build_object('direct_write_denied',false);
      EXCEPTION WHEN insufficient_privilege THEN result:=result || jsonb_build_object('direct_write_denied',true); END;
    END IF;
    RAISE EXCEPTION 'rollback selftest' USING ERRCODE='ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
    WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'message',SQLERRM);
  END;
  RETURN jsonb_build_object('ok',NOT EXISTS(SELECT 1 FROM jsonb_each(result) e WHERE e.value<>'true'::jsonb),'checks',result);
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_selftest(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_selftest(uuid) TO authenticated;
