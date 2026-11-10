-- Use existing notification tables/preferences. Delivery keys are durable, not a time heuristic.
CREATE TABLE IF NOT EXISTS public.knowledge_qa_notification_deliveries(
 event_key text NOT NULL,recipient uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_key,recipient)
);
ALTER TABLE public.knowledge_qa_notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.knowledge_qa_notification_deliveries FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.knowledge_qa_seed_notifications(p_tenant uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 INSERT INTO notification_types(tenant_id,name,label,description,category,is_active)
 SELECT p_tenant,name,label,label,'knowledge',true FROM (VALUES
 ('knowledge_qa_assigned','Wissensfrage mir zugewiesen'),
 ('knowledge_qa_answered','Meine Wissensfrage beantwortet'),
 ('knowledge_qa_due','Prüftermin für Wissen erreicht'),
 ('knowledge_qa_review_requested','Überprüfung einer Antwort angefordert')) AS types(name,label)
 ON CONFLICT(tenant_id,name) DO NOTHING;
$$;
SELECT public.knowledge_qa_seed_notifications(id) FROM public.tenants;
CREATE OR REPLACE FUNCTION public.knowledge_qa_notify(p_tenant uuid,p_recipient uuid,p_type text,p_key text,p_question uuid,p_title text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE type_id uuid;
BEGIN
 IF p_recipient IS NULL OR NOT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_recipient AND is_active) THEN RETURN; END IF;
 INSERT INTO knowledge_qa_notification_deliveries(event_key,recipient) VALUES(p_key,p_recipient) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM knowledge_qa_seed_notifications(p_tenant);
 SELECT id INTO type_id FROM notification_types WHERE tenant_id=p_tenant AND name=p_type AND is_active;
 IF type_id IS NULL THEN RETURN; END IF;
 INSERT INTO user_notification_settings(user_id,notification_type_id,is_enabled,push_enabled)
 VALUES(p_recipient,type_id,true,true) ON CONFLICT(user_id,notification_type_id) DO NOTHING;
 IF EXISTS(SELECT 1 FROM user_notification_settings WHERE user_id=p_recipient AND notification_type_id=type_id AND is_enabled) THEN
  INSERT INTO notifications(tenant_id,user_id,notification_type_id,title,message,data,priority)
  VALUES(p_tenant,p_recipient,type_id,p_title,'Öffne die Wissensfrage für Einzelheiten.',
   jsonb_build_object('question_id',p_question,'tenant_id',p_tenant,'event_key',p_key),'medium');
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.knowledge_qa_notify_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE previous jsonb; target uuid; title text:=NEW.snapshot->>'title';
BEGIN
 SELECT snapshot INTO previous FROM knowledge_question_events WHERE question_id=NEW.question_id AND revision=NEW.revision-1;
 target:=(NEW.snapshot->>'assigned_to')::uuid;
 IF target IS NOT NULL AND target IS DISTINCT FROM (previous->>'assigned_to')::uuid THEN
  PERFORM knowledge_qa_notify(NEW.tenant_id,target,'knowledge_qa_assigned',NEW.id::text||':assigned',NEW.question_id,title);
 END IF;
 IF NEW.event_type='answer_changed' AND NEW.snapshot->>'answered_at' IS NOT NULL AND previous->>'answered_at' IS NULL THEN
  PERFORM knowledge_qa_notify(NEW.tenant_id,(NEW.snapshot->>'created_by')::uuid,'knowledge_qa_answered',NEW.id::text||':answered',NEW.question_id,title);
 END IF;
 IF NEW.event_type='review_requested' AND NEW.snapshot->>'assigned_to' IS NOT DISTINCT FROM previous->>'assigned_to' THEN
  -- Unassigned answers go to their author; recipients must still be active members.
  target:=coalesce(target,(NEW.snapshot->>'answered_by')::uuid,(NEW.snapshot->>'created_by')::uuid);
  PERFORM knowledge_qa_notify(NEW.tenant_id,target,'knowledge_qa_review_requested',NEW.id::text||':review',NEW.question_id,title);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS knowledge_qa_notifications ON public.knowledge_question_events;
CREATE TRIGGER knowledge_qa_notifications AFTER INSERT ON public.knowledge_question_events FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_notify_event();
CREATE INDEX IF NOT EXISTS knowledge_questions_due ON public.knowledge_questions(review_due_at,id) WHERE answered_at IS NOT NULL AND review_due_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.dispatch_due_knowledge_reviews() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q record; delivered integer:=0; target uuid; delivery_key text;
BEGIN
 FOR q IN SELECT k.* FROM knowledge_questions k
 WHERE answered_at IS NOT NULL AND review_due_at<=now()
 AND EXISTS(SELECT 1 FROM user_tenant_memberships m WHERE m.tenant_id=k.tenant_id AND m.user_id=coalesce(k.assigned_to,k.created_by) AND m.is_active)
 AND NOT EXISTS(SELECT 1 FROM knowledge_qa_notification_deliveries d
 WHERE d.event_key='due:'||k.id::text||':'||extract(epoch FROM k.review_due_at)::text||':'||coalesce(k.verified_answer_revision,0)::text
 AND d.recipient=coalesce(k.assigned_to,k.created_by))
 ORDER BY review_due_at,id LIMIT 500 FOR UPDATE SKIP LOCKED LOOP
  target:=coalesce(q.assigned_to,q.created_by);
  delivery_key:='due:'||q.id::text||':'||extract(epoch FROM q.review_due_at)::text||':'||coalesce(q.verified_answer_revision,0)::text;
  PERFORM knowledge_qa_notify(q.tenant_id,target,'knowledge_qa_due',delivery_key,q.id,q.title);
  delivered:=delivered+1;
 END LOOP;
 RETURN delivered;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_seed_notifications(uuid),public.knowledge_qa_notify(uuid,uuid,text,text,uuid,text),public.knowledge_qa_notify_event(),public.dispatch_due_knowledge_reviews() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_due_knowledge_reviews() TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='dispatch-knowledge-reviews') THEN PERFORM cron.unschedule('dispatch-knowledge-reviews'); END IF;
  PERFORM cron.schedule('dispatch-knowledge-reviews','*/15 * * * *','SELECT public.dispatch_due_knowledge_reviews();');
 END IF;
END $$;

-- Make the same four preferences available before the first question in a new office.
CREATE OR REPLACE FUNCTION public.knowledge_qa_seed_tenant_notifications() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN PERFORM knowledge_qa_seed_notifications(NEW.id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_seed_tenant_notifications() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS knowledge_qa_seed_notifications ON public.tenants;
CREATE TRIGGER knowledge_qa_seed_notifications AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_seed_tenant_notifications();
