-- Answers expire at most twelve calendar months after creation/approval.
-- All dates use Europe/Berlin calendar arithmetic, including leap years/DST.
CREATE OR REPLACE FUNCTION public.knowledge_qa_max_valid_until(p_start timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT ((p_start AT TIME ZONE 'Europe/Berlin') + interval '12 months') AT TIME ZONE 'Europe/Berlin';
$$;
REVOKE ALL ON FUNCTION public.knowledge_qa_max_valid_until(timestamptz) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.knowledge_qa_record_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event_name text;
BEGIN
  IF TG_OP='INSERT' THEN event_name:='question_created';
  ELSIF NEW.metadata_revision IS DISTINCT FROM OLD.metadata_revision THEN event_name:=NEW.metadata_event;
  ELSIF NEW.merged_into IS DISTINCT FROM OLD.merged_into THEN event_name:='question_merged';
  ELSIF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN event_name:='question_archived';
  ELSIF NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description THEN event_name:='question_edited';
  ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN event_name:='assignee_changed';
  ELSIF NEW.answer_revision IS DISTINCT FROM OLD.answer_revision THEN event_name:='answer_changed';
  ELSIF NEW.verified_at IS DISTINCT FROM OLD.verified_at AND NEW.review_status='verified' THEN event_name:='verified';
  ELSIF NEW.review_status='needs_review' THEN event_name:='review_requested';
  ELSE event_name:='assignee_changed'; END IF;
  INSERT INTO knowledge_question_events(tenant_id,question_id,revision,event_type,actor_id,snapshot)
  VALUES(NEW.tenant_id,NEW.id,NEW.revision,event_name,coalesce(auth.uid(),NEW.updated_by),
    (to_jsonb(NEW)-'search_vector'-'title_search_vector'-'tag_search_text') || jsonb_build_object('tags', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) ORDER BY lower(t.name),t.id),'[]'::jsonb) FROM knowledge_question_tags qt JOIN knowledge_tags t ON t.id=qt.tag_id AND t.tenant_id=qt.tenant_id WHERE qt.question_id=NEW.id), 'attachments',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'file_size',a.file_size)), '[]'::jsonb)
       FROM knowledge_question_attachments a WHERE a.question_id=NEW.id AND a.state='ready')));
  RETURN NEW;
END $$;
-- Backfill is revisioned/audited. An existing earlier deadline is retained.
UPDATE public.knowledge_questions SET
 review_due_at=least(review_due_at,public.knowledge_qa_max_valid_until(coalesce(verified_at,answered_at))),
 metadata_revision=metadata_revision+1,metadata_event='validity_policy_applied',metadata_note='Automatisch auf höchstens zwölf Monate begrenzt.',
 revision=revision+1,updated_at=now()
WHERE answered_at IS NOT NULL AND archived_at IS NULL
 AND (review_due_at IS NULL OR review_due_at>public.knowledge_qa_max_valid_until(coalesce(verified_at,answered_at)));

CREATE OR REPLACE FUNCTION public.knowledge_qa_enforce_validity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap timestamptz;
BEGIN
 IF NEW.answered_at IS NULL OR NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  cap:=knowledge_qa_max_valid_until(coalesce(NEW.verified_at,NEW.answered_at));
 ELSIF OLD.archived_at IS NOT NULL THEN
  cap:=least(OLD.review_due_at,knowledge_qa_max_valid_until(coalesce(OLD.verified_at,NEW.answered_at)));
 ELSIF NEW.review_status='verified' AND NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
  cap:=knowledge_qa_max_valid_until(NEW.verified_at);
 ELSE
  -- Editing an answer, source or attachment cannot restart an approval period.
  cap:=coalesce(OLD.review_due_at,knowledge_qa_max_valid_until(coalesce(OLD.verified_at,NEW.answered_at)));
 END IF;
 NEW.review_due_at:=least(NEW.review_due_at,cap);
 IF NEW.assigned_to IS NULL AND (TG_OP='INSERT' OR OLD.answered_at IS NULL) THEN
  NEW.assigned_to:=NEW.answered_by;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_enforce_validity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS knowledge_qa_validity ON public.knowledge_questions;
CREATE TRIGGER knowledge_qa_validity BEFORE INSERT OR UPDATE ON public.knowledge_questions
 FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_enforce_validity();

CREATE OR REPLACE FUNCTION public.knowledge_qa_review(p_question uuid,p_expected_revision integer,p_verified boolean,p_due_at timestamptz DEFAULT NULL)
RETURNS public.knowledge_questions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; cap timestamptz:=knowledge_qa_max_valid_until(now());
BEGIN
 SELECT * INTO q FROM knowledge_questions WHERE id=p_question FOR UPDATE;
 IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id) THEN RAISE EXCEPTION 'Keine Leseberechtigung' USING ERRCODE='42501'; END IF;
 IF p_verified IS NULL OR q.answered_at IS NULL OR q.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Es gibt keine aktive Antwort.' USING ERRCODE='22023'; END IF;
 IF p_verified AND q.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Nur die zuständige Person kann diese Antwort freigeben. Bitte die Zuständigkeit zuordnen.' USING ERRCODE='42501'; END IF;
 IF NOT p_verified AND q.assigned_to IS DISTINCT FROM auth.uid() AND NOT knowledge_qa_can_access(q.tenant_id,'knowledge.verify') THEN RAISE EXCEPTION 'Keine Prüfberechtigung' USING ERRCODE='42501'; END IF;
 IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Antwort wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 IF p_verified AND p_due_at IS NOT NULL AND (p_due_at<=now() OR p_due_at>cap) THEN RAISE EXCEPTION 'Der Prüftermin muss in der Zukunft und innerhalb der nächsten zwölf Monate liegen.' USING ERRCODE='22023'; END IF;
 UPDATE knowledge_questions SET review_status=CASE WHEN p_verified THEN 'verified' ELSE 'needs_review' END,
  verified_by=CASE WHEN p_verified THEN auth.uid() ELSE verified_by END,
  verified_at=CASE WHEN p_verified THEN now() ELSE verified_at END,
  verified_answer_revision=CASE WHEN p_verified THEN answer_revision ELSE verified_answer_revision END,
  review_due_at=CASE WHEN p_verified THEN coalesce(p_due_at,cap) ELSE review_due_at END,
  revision=revision+1,updated_at=now(),updated_by=auth.uid() WHERE id=q.id RETURNING * INTO q;
 RETURN q;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_review(uuid,integer,boolean,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_review(uuid,integer,boolean,timestamptz) TO authenticated;

-- One durable task per question: later review cycles reopen the same task.
CREATE UNIQUE INDEX IF NOT EXISTS tasks_knowledge_review_unique ON public.tasks(tenant_id,source_id)
 WHERE source_type='knowledge_review' AND source_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.knowledge_qa_sync_review_task(p_question uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; target uuid; due timestamptz;
BEGIN
 SELECT * INTO q FROM knowledge_questions WHERE id=p_question FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF q.archived_at IS NOT NULL OR (q.review_status='verified' AND q.review_due_at>now()) THEN
  UPDATE tasks SET status='completed',progress=100,recurrence_rule=NULL,updated_at=now(),
   timeline=timeline||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'actorName','System','text',CASE WHEN q.archived_at IS NOT NULL THEN 'Wissensfrage archiviert.' ELSE 'Antwort erneut freigegeben.' END))
   WHERE tenant_id=q.tenant_id AND source_type='knowledge_review' AND source_id=q.id AND status<>'completed';
  RETURN;
 END IF;
 IF q.answered_at IS NULL OR NOT(q.review_status='needs_review' OR q.review_due_at<=now()) THEN RETURN; END IF;
 SELECT m.user_id INTO target FROM user_tenant_memberships m WHERE m.tenant_id=q.tenant_id AND m.user_id=q.assigned_to AND m.is_active;
 due:=least(q.review_due_at,now());
 INSERT INTO tasks(user_id,tenant_id,title,description,assigned_to,status,priority,category,due_date,
  ball_owner,ball_assignee_id,next_action,next_action_due,source_type,source_id,timeline)
 VALUES(coalesce(target,q.created_by),q.tenant_id,left('Wissensantwort prüfen: '||q.title,250),
  'Bitte Antwort und Quellen prüfen und die Wissensantwort als zuständige Person erneut freigeben. Das Erledigen dieser Aufgabe allein verlängert die Gültigkeit nicht.',
  target::text,'todo','medium','personal',due,'office',target,'Wissensantwort prüfen und erneut freigeben',
  (due AT TIME ZONE 'Europe/Berlin')::date,'knowledge_review',q.id,
  jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'actorName','System','text','Überprüfung der Wissensantwort erforderlich.')))
 ON CONFLICT(tenant_id,source_id) WHERE source_type='knowledge_review' AND source_id IS NOT NULL
 DO UPDATE SET assigned_to=EXCLUDED.assigned_to,ball_assignee_id=EXCLUDED.ball_assignee_id,
  title=EXCLUDED.title,status=CASE WHEN tasks.status='completed' THEN 'todo' ELSE tasks.status END,
  progress=CASE WHEN tasks.status='completed' THEN 0 ELSE tasks.progress END,
  due_date=CASE WHEN tasks.status='completed' THEN EXCLUDED.due_date ELSE least(tasks.due_date,EXCLUDED.due_date) END,
  next_action_due=CASE WHEN tasks.status='completed' THEN EXCLUDED.next_action_due ELSE least(tasks.next_action_due,EXCLUDED.next_action_due) END,
  updated_at=now(),timeline=tasks.timeline||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','system','at',now(),'actorName','System','text','Prüfaufgabe erneut geöffnet oder Zuständigkeit aktualisiert.'))
 WHERE tasks.status='completed' OR tasks.assigned_to IS DISTINCT FROM EXCLUDED.assigned_to OR tasks.title IS DISTINCT FROM EXCLUDED.title;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_sync_review_task(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.knowledge_qa_review_task_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN PERFORM knowledge_qa_sync_review_task(NEW.id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_review_task_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS knowledge_qa_review_task ON public.knowledge_questions;
CREATE TRIGGER knowledge_qa_review_task AFTER INSERT OR UPDATE ON public.knowledge_questions
 FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_review_task_trigger();

CREATE OR REPLACE FUNCTION public.dispatch_due_knowledge_reviews() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; processed integer:=0;
BEGIN
 FOR q IN SELECT k.* FROM knowledge_questions k
 WHERE k.archived_at IS NULL AND k.answered_at IS NOT NULL AND k.review_due_at<=now()
 AND (k.review_status<>'needs_review' OR NOT EXISTS(SELECT 1 FROM tasks t WHERE t.tenant_id=k.tenant_id AND t.source_type='knowledge_review' AND t.source_id=k.id AND t.status<>'completed'
  AND t.assigned_to IS NOT DISTINCT FROM CASE WHEN EXISTS(SELECT 1 FROM user_tenant_memberships m WHERE m.tenant_id=k.tenant_id AND m.user_id=k.assigned_to AND m.is_active) THEN k.assigned_to::text END))
 ORDER BY k.review_due_at,k.id LIMIT 500 FOR UPDATE SKIP LOCKED LOOP
  IF q.review_status<>'needs_review' THEN
   UPDATE knowledge_questions SET review_status='needs_review',metadata_revision=metadata_revision+1,
    metadata_event='review_expired',metadata_note='Automatisch: Gültigkeit abgelaufen.',revision=revision+1,
    updated_at=now(),updated_by=coalesce(q.assigned_to,q.answered_by,q.created_by) WHERE id=q.id;
  ELSE
   PERFORM knowledge_qa_sync_review_task(q.id);
  END IF;
  PERFORM knowledge_qa_notify(q.tenant_id,CASE WHEN EXISTS(SELECT 1 FROM user_tenant_memberships m WHERE m.tenant_id=q.tenant_id AND m.user_id=q.assigned_to AND m.is_active) THEN q.assigned_to ELSE q.created_by END,'knowledge_qa_due',
   'expiry-task:'||q.id::text||':'||extract(epoch FROM q.review_due_at)::text,q.id,q.title);
  processed:=processed+1;
 END LOOP;
 RETURN processed;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_due_knowledge_reviews() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_due_knowledge_reviews() TO service_role;

-- Give existing unassigned answers an active author as their responsible person.
UPDATE public.knowledge_questions q SET assigned_to=coalesce(
 (SELECT m.user_id FROM user_tenant_memberships m WHERE m.tenant_id=q.tenant_id AND m.user_id=q.answered_by AND m.is_active),
 (SELECT m.user_id FROM user_tenant_memberships m WHERE m.tenant_id=q.tenant_id AND m.user_id=q.created_by AND m.is_active)),
 revision=revision+1,updated_at=now()
WHERE q.answered_at IS NOT NULL AND q.archived_at IS NULL AND q.assigned_to IS NULL
 AND EXISTS(SELECT 1 FROM user_tenant_memberships m WHERE m.tenant_id=q.tenant_id AND m.user_id IN(q.answered_by,q.created_by) AND m.is_active);
-- Also repair a previously archived answer when it is restored: the BEFORE
-- trigger gives it a bounded deadline before it can appear as current again.
SELECT public.dispatch_due_knowledge_reviews();
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  RAISE EXCEPTION 'Für automatische Wissens-Prüfaufgaben muss pg_cron aktiviert sein.';
 ELSE
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='dispatch-knowledge-reviews') THEN PERFORM cron.unschedule('dispatch-knowledge-reviews'); END IF;
  PERFORM cron.schedule('dispatch-knowledge-reviews','*/15 * * * *','SELECT public.dispatch_due_knowledge_reviews();');
 END IF;
END $$;
NOTIFY pgrst, 'reload schema';
