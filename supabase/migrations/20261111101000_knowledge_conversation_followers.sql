-- Collaboration remains tenant-visible. Restricted visibility is deliberately
-- not introduced without the requested product/permission agreement.
CREATE TABLE IF NOT EXISTS public.knowledge_question_comments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,question_id uuid NOT NULL,
 author_id uuid NOT NULL,body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now(),revision integer NOT NULL,
 UNIQUE(question_id,revision),FOREIGN KEY(tenant_id,question_id) REFERENCES knowledge_questions(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS knowledge_comments_parent ON public.knowledge_question_comments(tenant_id,question_id,revision DESC);
CREATE TABLE IF NOT EXISTS public.knowledge_question_followers(
 tenant_id uuid NOT NULL,question_id uuid NOT NULL,user_id uuid NOT NULL,
 PRIMARY KEY(question_id,user_id),FOREIGN KEY(tenant_id,question_id) REFERENCES knowledge_questions(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS knowledge_followers_user ON public.knowledge_question_followers(tenant_id,user_id,question_id);
CREATE TABLE IF NOT EXISTS public.knowledge_question_outdated_reports(
 tenant_id uuid NOT NULL,question_id uuid NOT NULL,reporter_id uuid NOT NULL,body text CHECK(length(body)<=1000),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(question_id,reporter_id),FOREIGN KEY(tenant_id,question_id) REFERENCES knowledge_questions(tenant_id,id)
);
ALTER TABLE public.knowledge_question_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_question_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_question_outdated_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_comments_read ON public.knowledge_question_comments;
CREATE POLICY knowledge_comments_read ON public.knowledge_question_comments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM knowledge_questions q WHERE q.id=question_id AND q.tenant_id=knowledge_question_comments.tenant_id AND q.answered_at IS NULL AND q.archived_at IS NULL));
DROP POLICY IF EXISTS knowledge_followers_read ON public.knowledge_question_followers;
CREATE POLICY knowledge_followers_read ON public.knowledge_question_followers FOR SELECT TO authenticated USING(user_id=auth.uid() AND EXISTS(SELECT 1 FROM knowledge_questions q WHERE q.id=question_id AND q.tenant_id=knowledge_question_followers.tenant_id));
DROP POLICY IF EXISTS knowledge_reports_read ON public.knowledge_question_outdated_reports;
CREATE POLICY knowledge_reports_read ON public.knowledge_question_outdated_reports FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM knowledge_questions q WHERE q.id=question_id AND q.tenant_id=knowledge_question_outdated_reports.tenant_id));
REVOKE ALL ON public.knowledge_question_comments,public.knowledge_question_followers,public.knowledge_question_outdated_reports FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.knowledge_question_comments,public.knowledge_question_followers,public.knowledge_question_outdated_reports TO authenticated;
CREATE OR REPLACE VIEW public.knowledge_question_comment_cards WITH(security_invoker=true) AS
 SELECT c.*,jsonb_build_object('user_id',c.author_id,'display_name',p.display_name,'avatar_url',p.avatar_url) AS author_person
 FROM knowledge_question_comments c LEFT JOIN profiles p ON p.user_id=c.author_id AND p.tenant_id=c.tenant_id;
REVOKE ALL ON public.knowledge_question_comment_cards FROM PUBLIC,anon;
GRANT SELECT ON public.knowledge_question_comment_cards TO authenticated;
CREATE OR REPLACE FUNCTION public.knowledge_qa_comment(p_question uuid,p_expected_revision integer,p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions;
BEGIN
 SELECT * INTO q FROM knowledge_questions WHERE id=p_question FOR UPDATE;
 IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id) THEN RAISE EXCEPTION 'Keine Leseberechtigung' USING ERRCODE='42501'; END IF;
 IF q.answered_at IS NOT NULL OR q.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Rückfragen sind nur an offenen Fragen möglich.' USING ERRCODE='22023'; END IF;
 IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Frage wurde inzwischen geändert.' USING ERRCODE='40001'; END IF;
 IF p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Rückfrage muss 1–1000 Zeichen lang sein.' USING ERRCODE='22023'; END IF;
 INSERT INTO knowledge_question_comments(tenant_id,question_id,author_id,body,revision) VALUES(q.tenant_id,q.id,auth.uid(),btrim(p_body),q.revision+1);
 UPDATE knowledge_questions SET revision=revision+1,metadata_revision=metadata_revision+1,metadata_event='comment_added',metadata_note=btrim(p_body),updated_at=now(),updated_by=auth.uid() WHERE id=q.id;
END $$;
CREATE OR REPLACE FUNCTION public.knowledge_qa_follow(p_question uuid,p_follow boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions;
BEGIN
 SELECT * INTO q FROM knowledge_questions WHERE id=p_question;
 IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id) THEN RAISE EXCEPTION 'Keine Leseberechtigung' USING ERRCODE='42501'; END IF;
 IF p_follow IS NULL THEN RAISE EXCEPTION 'Ungültige Folgeaktion' USING ERRCODE='22023'; END IF;
 IF p_follow THEN INSERT INTO knowledge_question_followers VALUES(q.tenant_id,q.id,auth.uid()) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM knowledge_question_followers WHERE question_id=q.id AND user_id=auth.uid(); END IF;
END $$;
CREATE OR REPLACE FUNCTION public.knowledge_qa_report_outdated(p_question uuid,p_expected_revision integer,p_body text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; already_reported boolean;
BEGIN
 SELECT * INTO q FROM knowledge_questions WHERE id=p_question FOR UPDATE;
 IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id) THEN RAISE EXCEPTION 'Keine Leseberechtigung' USING ERRCODE='42501'; END IF;
 IF q.answered_at IS NULL OR q.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Nur aktive Antworten können als veraltet gemeldet werden.' USING ERRCODE='22023'; END IF;
 IF length(coalesce(p_body,''))>1000 THEN RAISE EXCEPTION 'Kommentar darf höchstens 1000 Zeichen lang sein.' USING ERRCODE='22023'; END IF;
 SELECT EXISTS(SELECT 1 FROM knowledge_question_outdated_reports WHERE question_id=q.id) INTO already_reported;
 IF NOT already_reported AND q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Antwort wurde inzwischen geändert.' USING ERRCODE='40001'; END IF;
 INSERT INTO knowledge_question_outdated_reports(tenant_id,question_id,reporter_id,body) VALUES(q.tenant_id,q.id,auth.uid(),btrim(coalesce(p_body,''))) ON CONFLICT DO NOTHING;
 IF already_reported THEN RETURN; END IF;
 UPDATE knowledge_questions SET revision=revision+1,metadata_revision=metadata_revision+1,metadata_event='outdated_reported',metadata_note=btrim(coalesce(p_body,'')),
 review_status='needs_review',verified_at=NULL,verified_by=NULL,verified_answer_revision=NULL,updated_at=now(),updated_by=auth.uid() WHERE id=q.id;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_comment(uuid,integer,text),public.knowledge_qa_follow(uuid,boolean),public.knowledge_qa_report_outdated(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_comment(uuid,integer,text),public.knowledge_qa_follow(uuid,boolean),public.knowledge_qa_report_outdated(uuid,integer,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.knowledge_qa_auto_follow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target uuid;
BEGIN
 IF TG_OP='INSERT' THEN target:=NEW.created_by;
 ELSIF NEW.answer_revision IS DISTINCT FROM OLD.answer_revision AND NEW.answered_at IS NOT NULL THEN target:=auth.uid();
 ELSIF NEW.verified_at IS DISTINCT FROM OLD.verified_at AND NEW.review_status='verified' THEN target:=auth.uid(); END IF;
 IF target IS NOT NULL THEN INSERT INTO knowledge_question_followers VALUES(NEW.tenant_id,NEW.id,target) ON CONFLICT DO NOTHING; END IF;
 IF TG_OP='UPDATE' AND (NEW.answer_revision IS DISTINCT FROM OLD.answer_revision OR (NEW.verified_at IS DISTINCT FROM OLD.verified_at AND NEW.review_status='verified') OR (OLD.review_status='needs_review' AND NEW.review_status<>'needs_review')) THEN
 DELETE FROM knowledge_question_outdated_reports WHERE question_id=NEW.id; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_auto_follow() FROM PUBLIC,anon,authenticated;
-- Backfill only before installing the automatic-follow trigger for the first
-- time. Re-running this migration must not re-subscribe people who unfollowed.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.knowledge_questions'::regclass AND tgname='knowledge_qa_auto_follow') THEN
 INSERT INTO public.knowledge_question_followers SELECT q.tenant_id,q.id,q.created_by FROM knowledge_questions q WHERE EXISTS(SELECT 1 FROM user_tenant_memberships m WHERE m.tenant_id=q.tenant_id AND m.user_id=q.created_by AND m.is_active) ON CONFLICT DO NOTHING;
 END IF;
END $$;
DROP TRIGGER IF EXISTS knowledge_qa_auto_follow ON public.knowledge_questions;
CREATE TRIGGER knowledge_qa_auto_follow AFTER INSERT OR UPDATE ON public.knowledge_questions FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_auto_follow();

CREATE OR REPLACE FUNCTION public.knowledge_qa_seed_notifications(p_tenant uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 INSERT INTO notification_types(tenant_id,name,label,description,category,is_active)
 SELECT p_tenant,name,label,label,'knowledge',true FROM (VALUES
 ('knowledge_qa_assigned','Wissensfrage mir zugewiesen'),('knowledge_qa_answered','Antworten und Änderungen an gefolgten Fragen'),
 ('knowledge_qa_due','Prüftermin für Wissen erreicht'),('knowledge_qa_review_requested','Prüfstatus und Veraltet-Meldungen'),
 ('knowledge_qa_comment','Rückfragen zu meiner oder zugewiesener Frage')) types(name,label)
 ON CONFLICT(tenant_id,name) DO NOTHING;
$$;
SELECT public.knowledge_qa_seed_notifications(id) FROM tenants;
CREATE OR REPLACE FUNCTION public.knowledge_qa_notify_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE previous jsonb; target uuid; recipient uuid; type_name text; suffix text; allowed app_role[];
BEGIN
 SELECT snapshot INTO previous FROM knowledge_question_events WHERE question_id=NEW.question_id AND revision=NEW.revision-1;
 target:=(NEW.snapshot->>'assigned_to')::uuid;
 IF target IS NOT NULL AND target IS DISTINCT FROM (previous->>'assigned_to')::uuid THEN
 PERFORM knowledge_qa_notify(NEW.tenant_id,target,'knowledge_qa_assigned',NEW.id::text||':assigned',NEW.question_id,NEW.snapshot->>'title'); END IF;
 IF NEW.event_type='comment_added' THEN
 FOR recipient IN SELECT DISTINCT id FROM unnest(ARRAY[target,(NEW.snapshot->>'created_by')::uuid]) id WHERE id IS NOT NULL LOOP
 PERFORM knowledge_qa_notify(NEW.tenant_id,recipient,'knowledge_qa_comment',NEW.id::text||':comment',NEW.question_id,NEW.snapshot->>'title'); END LOOP;
 ELSIF NEW.event_type='answer_changed' OR NEW.event_type IN ('verified','review_requested','outdated_reported') OR (previous IS NOT NULL AND NEW.snapshot->>'review_status' IS DISTINCT FROM previous->>'review_status') THEN
 type_name:=CASE WHEN NEW.event_type='answer_changed' THEN 'knowledge_qa_answered' ELSE 'knowledge_qa_review_requested' END;
 suffix:=CASE WHEN NEW.event_type='answer_changed' THEN ':answered' ELSE ':review' END;
 SELECT allowed_roles INTO allowed FROM action_permissions WHERE tenant_id=NEW.tenant_id AND action_key='knowledge.verify';
 FOR recipient IN
 SELECT user_id FROM knowledge_question_followers WHERE question_id=NEW.question_id
 UNION SELECT (NEW.snapshot->>'created_by')::uuid WHERE NEW.event_type='answer_changed' AND previous->>'answered_at' IS NULL
 UNION SELECT target WHERE NEW.event_type<>'answer_changed' AND target IS NOT NULL
 UNION SELECT auth.uid() WHERE NEW.event_type IN ('answer_changed','verified')
 UNION SELECT m.user_id FROM user_tenant_memberships m WHERE NEW.event_type='outdated_reported' AND m.tenant_id=NEW.tenant_id AND m.is_active AND (allowed IS NULL OR m.role=ANY(allowed) OR is_superadmin(m.user_id))
 LOOP
 PERFORM knowledge_qa_notify(NEW.tenant_id,recipient,type_name,NEW.id::text||suffix,NEW.question_id,NEW.snapshot->>'title');
 END LOOP;
 END IF;
 RETURN NEW;
END $$;

UPDATE public.notification_types SET label='Antworten und Änderungen an gefolgten Fragen' WHERE name='knowledge_qa_answered';
UPDATE public.notification_types SET label='Prüfstatus und Veraltet-Meldungen' WHERE name='knowledge_qa_review_requested';
CREATE OR REPLACE FUNCTION public.dispatch_due_knowledge_reviews() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q record; delivered integer:=0; target uuid; delivery_key text; recipient uuid;
BEGIN
 FOR q IN SELECT k.* FROM knowledge_questions k
 WHERE archived_at IS NULL AND answered_at IS NOT NULL AND review_due_at<=now()
 AND EXISTS(SELECT 1 FROM user_tenant_memberships m WHERE m.tenant_id=k.tenant_id AND m.user_id=coalesce(k.assigned_to,k.created_by) AND m.is_active)
 AND NOT EXISTS(SELECT 1 FROM knowledge_qa_notification_deliveries d
 WHERE (d.event_key='due:'||k.id::text||':'||extract(epoch FROM k.review_due_at)::text OR d.event_key LIKE 'due:'||k.id::text||':'||extract(epoch FROM k.review_due_at)::text||':%')
 AND d.recipient=coalesce(k.assigned_to,k.created_by))
 ORDER BY review_due_at,id LIMIT 500 FOR UPDATE SKIP LOCKED LOOP
  target:=coalesce(q.assigned_to,q.created_by);
  delivery_key:='due:'||q.id::text||':'||extract(epoch FROM q.review_due_at)::text;
  FOR recipient IN SELECT user_id FROM knowledge_question_followers WHERE question_id=q.id UNION SELECT target LOOP
  PERFORM knowledge_qa_notify(q.tenant_id,recipient,'knowledge_qa_due',delivery_key,q.id,q.title); END LOOP;
  delivered:=delivered+1;
 END LOOP;
 RETURN delivered;
END $$;
