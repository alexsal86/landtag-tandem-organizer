-- Recovery for SQLSTATE 42501 on pg_trgm.word_similarity_threshold.
-- Replay the idempotent management migration because a failed SQL-editor run may
-- have rolled back every statement in 20261111100500, not only the list RPC.
-- Run this file after 20261111100400 instead of retrying the failed 100500 file.
-- Also safe after a successful 100500. Existing permissions/data are preserved.
-- Compare word_similarity explicitly: no SET privilege or connection-local GUC
-- is required. This predicate does not request a threshold-dependent GIN scan;
-- the existing measured RLS/FTS performance limitation remains documented.

-- Preserve questions, answers, files and audit history when closing duplicates.
ALTER TABLE public.knowledge_questions ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.knowledge_questions ADD COLUMN IF NOT EXISTS merged_into uuid;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='knowledge_questions_merge_target') THEN
 ALTER TABLE public.knowledge_questions ADD CONSTRAINT knowledge_questions_merge_target FOREIGN KEY(tenant_id,merged_into) REFERENCES public.knowledge_questions(tenant_id,id);
 ALTER TABLE public.knowledge_questions ADD CONSTRAINT knowledge_questions_merge_not_self CHECK(merged_into IS NULL OR (merged_into<>id AND archived_at IS NOT NULL));
 END IF;
END $$;
INSERT INTO public.action_permissions(tenant_id,action_key,allowed_roles)
 SELECT id,'knowledge.manage',ARRAY['abgeordneter','bueroleitung']::public.app_role[] FROM tenants
 ON CONFLICT(tenant_id,action_key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.knowledge_qa_seed_manage_permission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN INSERT INTO action_permissions(tenant_id,action_key,allowed_roles)
 VALUES(NEW.id,'knowledge.manage',ARRAY['abgeordneter','bueroleitung']::app_role[]) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_seed_manage_permission() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS knowledge_qa_manage_default ON public.tenants;
CREATE TRIGGER knowledge_qa_manage_default AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_seed_manage_permission();
CREATE OR REPLACE FUNCTION public.knowledge_qa_manage(p_question uuid,p_expected_revision integer,p_action text,p_title text DEFAULT NULL,p_description text DEFAULT NULL,p_target uuid DEFAULT NULL,p_target_revision integer DEFAULT NULL)
RETURNS public.knowledge_questions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; target knowledge_questions;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('edit','archive','merge') THEN RAISE EXCEPTION 'Ungültige Pflegeaktion' USING ERRCODE='22023'; END IF;
 -- Lock both rows in a deterministic order when merging.
 PERFORM 1 FROM knowledge_questions WHERE id=p_question OR (p_action='merge' AND id=p_target) ORDER BY id FOR UPDATE;
 SELECT * INTO q FROM knowledge_questions WHERE id=p_question;
 IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.manage') THEN RAISE EXCEPTION 'Keine Pflegeberechtigung' USING ERRCODE='42501'; END IF;
 IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Frage wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 IF q.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Die Frage ist bereits geschlossen' USING ERRCODE='22023'; END IF;
 IF p_action='edit' THEN
  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 300 OR p_description IS NULL OR length(p_description)>10000 THEN RAISE EXCEPTION 'Ungültiger Titel oder Beschreibung' USING ERRCODE='22023'; END IF;
  IF q.title=btrim(p_title) AND q.description=p_description THEN RETURN q; END IF;
  UPDATE knowledge_questions SET title=btrim(p_title),description=p_description,revision=revision+1,updated_at=now(),updated_by=auth.uid() WHERE id=q.id RETURNING * INTO q;
 ELSE
  IF p_action='merge' THEN
   SELECT * INTO target FROM knowledge_questions WHERE id=p_target AND tenant_id=q.tenant_id;
   IF NOT FOUND OR target.id=q.id OR target.archived_at IS NOT NULL OR target.merged_into IS NOT NULL THEN RAISE EXCEPTION 'Ungültige Zielfrage' USING ERRCODE='22023'; END IF;
   IF target.revision IS DISTINCT FROM p_target_revision THEN RAISE EXCEPTION 'Die Zielfrage wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  END IF;
  UPDATE knowledge_questions SET archived_at=now(),merged_into=CASE WHEN p_action='merge' THEN target.id END,
   revision=revision+1,updated_at=now(),updated_by=auth.uid() WHERE id=q.id RETURNING * INTO q;
 END IF;
 RETURN q;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_manage(uuid,integer,text,text,text,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_manage(uuid,integer,text,text,text,uuid,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.knowledge_qa_guard_archived() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN IF OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Geschlossene Fragen können nicht geändert werden' USING ERRCODE='22023'; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_guard_archived() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS knowledge_qa_guard_archived ON public.knowledge_questions;
CREATE TRIGGER knowledge_qa_guard_archived BEFORE UPDATE ON public.knowledge_questions FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_guard_archived();

-- Preserve existing view column order even after an idempotent vector rebuild.
DO $$ DECLARE columns text; BEGIN
 SELECT string_agg('q.'||quote_ident(attname),',' ORDER BY attnum) INTO columns
 FROM pg_attribute WHERE attrelid='public.knowledge_question_cards'::regclass AND attnum>0 AND NOT attisdropped
 AND attname NOT IN ('effective_review_status','server_now','archived_at','merged_into');
 EXECUTE 'CREATE OR REPLACE VIEW public.knowledge_question_cards WITH (security_invoker=true) AS SELECT '||columns||
 ',CASE WHEN q.review_status=''needs_review'' OR q.review_due_at<=now() THEN ''needs_review'' ELSE q.review_status END AS effective_review_status,now() AS server_now,q.archived_at,q.merged_into FROM public.knowledge_questions q';
END $$;
CREATE OR REPLACE FUNCTION public.knowledge_qa_record_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event_name text;
BEGIN
  IF TG_OP='INSERT' THEN event_name:='question_created';
  ELSIF NEW.merged_into IS DISTINCT FROM OLD.merged_into THEN event_name:='question_merged';
  ELSIF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN event_name:='question_archived';
  ELSIF NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description THEN event_name:='question_edited';
  ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN event_name:='assignee_changed';
  ELSIF NEW.answer_revision IS DISTINCT FROM OLD.answer_revision THEN event_name:='answer_changed';
  ELSIF NEW.verified_at IS DISTINCT FROM OLD.verified_at AND NEW.review_status='verified' THEN event_name:='verified';
  ELSIF NEW.review_status='needs_review' THEN event_name:='review_requested';
  ELSE event_name:='assignee_changed'; END IF;
  INSERT INTO knowledge_question_events(tenant_id,question_id,revision,event_type,actor_id,snapshot)
  VALUES(NEW.tenant_id,NEW.id,NEW.revision,event_name,auth.uid(),
    (to_jsonb(NEW)-'search_vector'-'title_search_vector') || jsonb_build_object('attachments',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'file_size',a.file_size)), '[]'::jsonb)
       FROM knowledge_question_attachments a WHERE a.question_id=NEW.id AND a.state='ready')));
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.knowledge_qa_list(p_tenant uuid,p_query text DEFAULT '',p_view text DEFAULT 'answers',p_limit integer DEFAULT 20,p_cursor jsonb DEFAULT NULL,p_status text DEFAULT '',p_assignee text DEFAULT '',p_sort text DEFAULT 'updated')
RETURNS TABLE(items jsonb,total_count bigint,next_cursor jsonb)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,extensions,pg_temp AS $$
DECLARE term tsquery; expression text; normalized text:=knowledge_qa_normalize(btrim(p_query));
 browsing boolean:=btrim(coalesce(p_query,''))=''; fuzzy boolean:=false;
 predicate text; source text; ordering text; boundary text;
BEGIN
 IF p_view IS NULL OR p_view NOT IN ('answers','open','mine','assigned','review') OR length(coalesce(p_query,''))>300
 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Ungültige Suchanfrage' USING ERRCODE='22023'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('','open','unverified','verified','needs_review') OR p_sort IS NULL OR p_sort NOT IN ('updated','oldest')
 OR p_assignee IS NULL OR (p_assignee NOT IN ('','unassigned') AND p_assignee !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') THEN
 RAISE EXCEPTION 'Ungültiger Filter' USING ERRCODE='22023'; END IF;
 IF p_view='review' AND NOT knowledge_qa_can_access(p_tenant,'knowledge.verify') THEN
 RAISE EXCEPTION 'Keine Prüfberechtigung' USING ERRCODE='42501'; END IF;
 IF p_cursor IS NOT NULL AND (jsonb_typeof(p_cursor)<>'object' OR NOT p_cursor ?& ARRAY['id','updated_at','rank']) THEN
 RAISE EXCEPTION 'Ungültiger Cursor' USING ERRCODE='22023'; END IF;
 predicate:=$filter$ q.tenant_id=$1 AND q.archived_at IS NULL AND CASE $3 WHEN 'answers' THEN q.answered_at IS NOT NULL WHEN 'open' THEN q.answered_at IS NULL
 WHEN 'assigned' THEN q.assigned_to=auth.uid()
 WHEN 'review' THEN q.answered_at IS NOT NULL AND (q.review_status='needs_review' OR q.review_due_at<=now())
 ELSE q.created_by=auth.uid() OR EXISTS(SELECT 1 FROM knowledge_question_events e WHERE e.tenant_id=$1 AND e.question_id=q.id AND e.actor_id=auth.uid() AND e.event_type='answer_changed') END
 AND ($9='' OR CASE WHEN $9='open' THEN q.answered_at IS NULL ELSE q.answered_at IS NOT NULL AND
 CASE WHEN q.review_status='needs_review' OR q.review_due_at<=now() THEN 'needs_review' ELSE q.review_status END=$9 END)
 AND ($10='' OR CASE WHEN $10='unassigned' THEN q.assigned_to IS NULL ELSE q.assigned_to=nullif(nullif($10,''),'unassigned')::uuid END) $filter$;
 IF browsing THEN
  source:='SELECT q.id,q.updated_at,0::double precision AS rank FROM knowledge_questions q WHERE ' || predicate;
  ordering:=CASE WHEN p_sort='oldest' THEN 'updated_at ASC,id' ELSE 'updated_at DESC,id' END;
  boundary:='updated_at' || CASE WHEN p_sort='oldest' THEN '>' ELSE '<' END || '($5->>''updated_at'')::timestamptz OR (updated_at=($5->>''updated_at'')::timestamptz AND id>($5->>''id'')::uuid)';
 ELSE
  SELECT string_agg(quote_literal(word)||':*',' & ') INTO expression FROM unnest(tsvector_to_array(to_tsvector('german',normalized))) word;
  term:=CASE WHEN expression IS NOT NULL THEN to_tsquery('german',expression) ELSE plainto_tsquery('german',normalized) END;
  EXECUTE 'SELECT NOT EXISTS(SELECT 1 FROM knowledge_questions q WHERE '||predicate||' AND q.search_vector @@ $2)' INTO fuzzy USING p_tenant,term,p_view,p_limit,p_cursor,normalized,browsing,fuzzy,p_status,p_assignee;
  IF fuzzy THEN
   source:='SELECT q.id,q.updated_at,greatest(similarity(knowledge_qa_normalize(q.title),$6),word_similarity($6,knowledge_qa_normalize(q.title)))::double precision AS rank FROM knowledge_questions q WHERE '||predicate||' AND word_similarity($6,knowledge_qa_normalize(q.title)) >= 0.35';
  ELSE
   source:='SELECT q.id,q.updated_at,(CASE WHEN q.title_search_vector @@ $2 THEN 1 ELSE 0 END + ts_rank_cd(q.search_vector,$2,32))::double precision AS rank FROM knowledge_questions q WHERE '||predicate||' AND q.search_vector @@ $2';
  END IF;
  ordering:='rank DESC,id';
  boundary:='rank<($5->>''rank'')::double precision OR (rank=($5->>''rank'')::double precision AND id>($5->>''id'')::uuid)';
 END IF;
 RETURN QUERY EXECUTE format($sql$
 WITH matches AS NOT MATERIALIZED (%s), candidates AS (
 SELECT * FROM matches WHERE $5 IS NULL OR (%s) ORDER BY %s LIMIT $4+1
 ), numbered AS (SELECT *,row_number() OVER (ORDER BY %s) AS n FROM candidates), page AS (
 SELECT s.*,n.n,n.rank FROM numbered n JOIN knowledge_question_summaries s ON s.id=n.id WHERE n.n<=$4
 )
 SELECT coalesce(jsonb_agg((to_jsonb(page)-'n'-'rank') || jsonb_build_object('answer_excerpt',
 CASE WHEN $7 OR $8 THEN page.answer_excerpt ELSE left(ts_headline('german',q.answer_text,$2,'StartSel=,StopSel=,MaxWords=35,MinWords=15,MaxFragments=1'),220) END) ORDER BY n),'[]'),
 (SELECT count(*) FROM matches), CASE WHEN (SELECT count(*) FROM numbered)>$4 THEN
 (SELECT jsonb_build_object('id',p.id,'updated_at',p.updated_at,'rank',p.rank) FROM page p ORDER BY p.n DESC LIMIT 1) END
 FROM page JOIN knowledge_questions q ON q.id=page.id
 $sql$,source,boundary,ordering,ordering)
 USING p_tenant,term,p_view,p_limit,p_cursor,normalized,browsing,fuzzy,p_status,p_assignee;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_list(uuid,text,text,integer,jsonb,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_list(uuid,text,text,integer,jsonb,text,text,text) TO authenticated;


CREATE OR REPLACE FUNCTION public.knowledge_qa_counts(p_tenant uuid)
RETURNS TABLE(answers bigint,open bigint,mine bigint,assigned bigint,review bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT count(*) FILTER(WHERE q.answered_at IS NOT NULL),count(*) FILTER(WHERE q.answered_at IS NULL),
 count(*) FILTER(WHERE q.created_by=auth.uid() OR EXISTS(SELECT 1 FROM knowledge_question_events e WHERE e.tenant_id=p_tenant AND e.actor_id=auth.uid() AND e.event_type='answer_changed' AND e.question_id=q.id)),
 count(*) FILTER(WHERE q.assigned_to=auth.uid()),
 count(*) FILTER(WHERE knowledge_qa_can_access(p_tenant,'knowledge.verify') AND q.answered_at IS NOT NULL AND (q.review_status='needs_review' OR q.review_due_at<=now()))
 FROM knowledge_questions q WHERE q.tenant_id=p_tenant AND q.archived_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.knowledge_qa_counts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_counts(uuid) TO authenticated;
-- One deadline is one event, even if a subsequent review request clears verification metadata. Legacy suffixed delivery keys remain recognized.
CREATE OR REPLACE FUNCTION public.dispatch_due_knowledge_reviews() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q record; delivered integer:=0; target uuid; delivery_key text;
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
  PERFORM knowledge_qa_notify(q.tenant_id,target,'knowledge_qa_due',delivery_key,q.id,q.title);
  delivered:=delivered+1;
 END LOOP;
 RETURN delivered;
END $$;

-- Selftest uses real revisions/audit and rolls back every business side effect.
CREATE OR REPLACE FUNCTION public.knowledge_qa_manage_selftest(p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; target knowledge_questions; previous_revision integer; checks jsonb:='{}';
BEGIN
 IF NOT knowledge_qa_can_access(p_tenant) THEN RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE='42501'; END IF;
 IF NOT knowledge_qa_can_access(p_tenant,'knowledge.write') THEN RETURN jsonb_build_object('ok',true,'skipped','Keine Schreibberechtigung für Testdatensätze'); END IF;
 BEGIN
  q:=knowledge_qa_create_question(p_tenant,'Selbsttest: Pflege');
  IF NOT knowledge_qa_can_access(p_tenant,'knowledge.manage') THEN
   BEGIN PERFORM knowledge_qa_manage(q.id,q.revision,'archive'); checks:=jsonb_build_object('manage_denied',false);
   EXCEPTION WHEN insufficient_privilege THEN checks:=jsonb_build_object('manage_denied',true); END;
  ELSE
   previous_revision:=q.revision;
   q:=knowledge_qa_manage(q.id,q.revision,'edit','Selbsttest: Pflege bearbeitet','Kontext');
   checks:=jsonb_build_object('edit',q.title='Selbsttest: Pflege bearbeitet');
   BEGIN PERFORM knowledge_qa_manage(q.id,previous_revision,'archive'); checks:=checks||jsonb_build_object('stale_denied',false);
   EXCEPTION WHEN serialization_failure THEN checks:=checks||jsonb_build_object('stale_denied',true); END;
   target:=knowledge_qa_create_question(p_tenant,'Selbsttest: Zielfrage');
   q:=knowledge_qa_manage(q.id,q.revision,'merge',NULL,NULL,target.id,target.revision);
   checks:=checks||jsonb_build_object('merge',q.merged_into=target.id AND q.archived_at IS NOT NULL);
   target:=knowledge_qa_manage(target.id,target.revision,'archive');
   checks:=checks||jsonb_build_object('archive',target.archived_at IS NOT NULL,'audit',EXISTS(SELECT 1 FROM knowledge_question_events WHERE question_id=q.id AND event_type='question_merged'));
  END IF;
  RAISE EXCEPTION 'rollback selftest' USING ERRCODE='ZX002';
 EXCEPTION WHEN SQLSTATE 'ZX002' THEN NULL;
 WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'message',SQLERRM);
 END;
 RETURN jsonb_build_object('ok',NOT EXISTS(SELECT 1 FROM jsonb_each(checks) e WHERE e.value<>'true'::jsonb),'checks',checks);
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_manage_selftest(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_manage_selftest(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.knowledge_qa_notification_selftest(p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; event_id uuid; before_count integer; checks jsonb:='{}'; enabled boolean;
BEGIN
 IF NOT knowledge_qa_can_access(p_tenant) THEN RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE='42501'; END IF;
 IF NOT knowledge_qa_can_access(p_tenant,'knowledge.write') THEN RETURN jsonb_build_object('ok',true,'skipped','Keine Schreibberechtigung für Testdatensätze'); END IF;
 BEGIN
  q:=knowledge_qa_create_question(p_tenant,'Selbsttest: Benachrichtigung','',auth.uid());
  SELECT id INTO event_id FROM knowledge_question_events WHERE question_id=q.id AND revision=q.revision;
  checks:=jsonb_build_object('assignment_delivery',EXISTS(SELECT 1 FROM knowledge_qa_notification_deliveries WHERE event_key=event_id::text||':assigned' AND recipient=auth.uid()));
  SELECT count(*) INTO before_count FROM notifications WHERE data->>'question_id'=q.id::text;
  PERFORM knowledge_qa_notify(p_tenant,auth.uid(),'knowledge_qa_assigned',event_id::text||':assigned',q.id,q.title);
  checks:=checks||jsonb_build_object('replay_deduplicated',before_count=(SELECT count(*) FROM notifications WHERE data->>'question_id'=q.id::text));
  SELECT coalesce(bool_or(t.is_active AND coalesce(s.is_enabled,true)),false) INTO enabled FROM notification_types t
   LEFT JOIN user_notification_settings s ON s.notification_type_id=t.id AND s.user_id=auth.uid()
   WHERE t.tenant_id=p_tenant AND t.name='knowledge_qa_assigned';
  checks:=checks||jsonb_build_object('preference_respected',(before_count=1)=enabled);
  RAISE EXCEPTION 'rollback selftest' USING ERRCODE='ZX003';
 EXCEPTION WHEN SQLSTATE 'ZX003' THEN NULL;
 WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'message',SQLERRM);
 END;
 RETURN jsonb_build_object('ok',NOT EXISTS(SELECT 1 FROM jsonb_each(checks) e WHERE e.value<>'true'::jsonb),'checks',checks);
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_notification_selftest(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_notification_selftest(uuid) TO authenticated;
