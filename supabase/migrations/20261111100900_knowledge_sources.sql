-- Source insertion stays invoker-based so document/case RLS is checked by the
-- caller, not bypassed by a definer lookup. Private triggers only lock/audit the
-- already permission-checked parent. Removal has a revision-checked RPC.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typname='knowledge_source_kind' AND typnamespace='public'::regnamespace) THEN
 CREATE TYPE public.knowledge_source_kind AS ENUM('link','document','law','person','case'); END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.knowledge_question_sources(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,question_id uuid NOT NULL,
 kind public.knowledge_source_kind NOT NULL,title text NOT NULL CHECK(title=btrim(title) AND length(title) BETWEEN 1 AND 300),
 url text CHECK(url IS NULL OR (length(url)<=2048 AND url ~* '^https?://[^[:space:][:cntrl:]]+$')),
 document_id uuid REFERENCES public.documents(id),case_id uuid REFERENCES public.case_files(id),as_of date,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),client_revision integer NOT NULL,
 FOREIGN KEY(tenant_id,question_id) REFERENCES public.knowledge_questions(tenant_id,id),
 CHECK((kind='document' AND document_id IS NOT NULL AND case_id IS NULL AND url IS NULL) OR
 (kind='case' AND case_id IS NOT NULL AND document_id IS NULL AND url IS NULL) OR
 (kind NOT IN ('document','case') AND document_id IS NULL AND case_id IS NULL)),
 CHECK(kind<>'link' OR url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS knowledge_sources_parent ON public.knowledge_question_sources(tenant_id,question_id,created_at,id);
ALTER TABLE public.knowledge_question_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_sources_read ON public.knowledge_question_sources;
CREATE POLICY knowledge_sources_read ON public.knowledge_question_sources FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM knowledge_questions q WHERE q.id=question_id AND q.tenant_id=knowledge_question_sources.tenant_id)
 AND (document_id IS NULL OR EXISTS(SELECT 1 FROM documents d WHERE d.id=document_id AND d.tenant_id=knowledge_question_sources.tenant_id))
 AND (case_id IS NULL OR EXISTS(SELECT 1 FROM case_files c WHERE c.id=case_id AND c.tenant_id=knowledge_question_sources.tenant_id))
);
DROP POLICY IF EXISTS knowledge_sources_insert ON public.knowledge_question_sources;
CREATE POLICY knowledge_sources_insert ON public.knowledge_question_sources FOR INSERT TO authenticated WITH CHECK(
 created_by=auth.uid() AND knowledge_qa_can_access(tenant_id,'knowledge.write')
 AND EXISTS(SELECT 1 FROM knowledge_questions q WHERE q.id=question_id AND q.tenant_id=knowledge_question_sources.tenant_id AND q.answered_at IS NOT NULL AND q.archived_at IS NULL)
 AND (document_id IS NULL OR EXISTS(SELECT 1 FROM documents d WHERE d.id=document_id AND d.tenant_id=knowledge_question_sources.tenant_id))
 AND (case_id IS NULL OR EXISTS(SELECT 1 FROM case_files c WHERE c.id=case_id AND c.tenant_id=knowledge_question_sources.tenant_id))
);
REVOKE ALL ON public.knowledge_question_sources FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.knowledge_question_sources TO authenticated;
CREATE OR REPLACE FUNCTION public.knowledge_qa_source_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions;
BEGIN
 SELECT * INTO q FROM knowledge_questions WHERE id=NEW.question_id AND tenant_id=NEW.tenant_id FOR UPDATE;
 IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
 IF q.revision IS DISTINCT FROM NEW.client_revision THEN RAISE EXCEPTION 'Die Antwort wurde inzwischen geändert.' USING ERRCODE='40001'; END IF;
 IF q.answered_at IS NULL OR q.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Quellen gehören zu einer aktiven Antwort.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM knowledge_question_sources WHERE question_id=q.id)>=10 THEN RAISE EXCEPTION 'Höchstens zehn Quellen pro Frage.' USING ERRCODE='22023'; END IF;
 NEW.created_at:=now(); RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.knowledge_qa_source_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE knowledge_questions SET revision=revision+1,metadata_revision=metadata_revision+1,metadata_event='sources_changed',metadata_note=NULL,
 review_status='unverified',verified_by=NULL,verified_at=NULL,verified_answer_revision=NULL,review_due_at=NULL,updated_at=now(),updated_by=auth.uid()
 WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.question_id ELSE NEW.question_id END;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_source_guard(),public.knowledge_qa_source_audit() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS knowledge_source_guard ON public.knowledge_question_sources;
CREATE TRIGGER knowledge_source_guard BEFORE INSERT ON public.knowledge_question_sources FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_source_guard();
DROP TRIGGER IF EXISTS knowledge_source_audit ON public.knowledge_question_sources;
CREATE TRIGGER knowledge_source_audit AFTER INSERT OR DELETE ON public.knowledge_question_sources FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_source_audit();
CREATE OR REPLACE FUNCTION public.knowledge_qa_add_source(p_question uuid,p_expected_revision integer,p_kind public.knowledge_source_kind,p_title text DEFAULT '',p_url text DEFAULT NULL,p_document uuid DEFAULT NULL,p_case uuid DEFAULT NULL,p_as_of date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE office uuid; label text:=btrim(p_title);
BEGIN
 SELECT tenant_id INTO office FROM knowledge_questions WHERE id=p_question;
 IF NOT FOUND OR NOT knowledge_qa_can_access(office,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
 IF p_kind='document' THEN
 SELECT title INTO label FROM documents WHERE id=p_document AND tenant_id=office;
 IF NOT FOUND THEN RAISE EXCEPTION 'Dokument nicht verfügbar' USING ERRCODE='42501'; END IF;
 ELSIF p_kind='case' THEN
 SELECT title INTO label FROM case_files WHERE id=p_case AND tenant_id=office;
 IF NOT FOUND THEN RAISE EXCEPTION 'Fallakte nicht verfügbar' USING ERRCODE='42501'; END IF;
 END IF;
 INSERT INTO knowledge_question_sources(tenant_id,question_id,kind,title,url,document_id,case_id,as_of,created_by,client_revision)
 VALUES(office,p_question,p_kind,label,nullif(btrim(p_url),''),p_document,p_case,p_as_of,auth.uid(),p_expected_revision);
END $$;
CREATE OR REPLACE FUNCTION public.knowledge_qa_remove_source(p_source uuid,p_expected_revision integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; parent uuid;
BEGIN
 SELECT question_id INTO parent FROM knowledge_question_sources WHERE id=p_source;
 SELECT * INTO q FROM knowledge_questions WHERE id=parent FOR UPDATE;
 IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
 IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Antwort wurde inzwischen geändert.' USING ERRCODE='40001'; END IF;
 IF q.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Die Frage ist geschlossen.' USING ERRCODE='22023'; END IF;
 DELETE FROM knowledge_question_sources WHERE id=p_source;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_add_source(uuid,integer,public.knowledge_source_kind,text,text,uuid,uuid,date),public.knowledge_qa_remove_source(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_add_source(uuid,integer,public.knowledge_source_kind,text,text,uuid,uuid,date),public.knowledge_qa_remove_source(uuid,integer) TO authenticated;
