-- Kurzantwort (1-3 Sätze) neben der ausführlichen Antwort.
--
-- Bestehende Antworten vor dieser Migration bleiben ohne Kurzantwort
-- (answer_short IS NULL): eine Massenaktualisierung würde den Archivschutz
-- verletzen und für jede Zeile einen doppelten Verlaufseintrag erzeugen. Der
-- Trigger verlangt die Kurzantwort daher bei jedem Schreibvorgang einer
-- Antwort; ältere Antworten werden beim nächsten Bearbeiten ergänzt und zeigen
-- bis dahin den bisherigen Auszug.

ALTER TABLE public.knowledge_questions ADD COLUMN IF NOT EXISTS answer_short text;

ALTER TABLE public.knowledge_questions DROP CONSTRAINT IF EXISTS knowledge_questions_answer_short_length;
ALTER TABLE public.knowledge_questions ADD CONSTRAINT knowledge_questions_answer_short_length
  CHECK (answer_short IS NULL OR length(btrim(answer_short)) BETWEEN 1 AND 500);

-- Enforce the short answer wherever an answer is written, while leaving
-- metadata-only updates of older answers (tags, sources, review) untouched.
CREATE OR REPLACE FUNCTION public.knowledge_qa_require_short_answer()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.answer_content IS NOT NULL AND
    (TG_OP='INSERT' OR NEW.answer_content IS DISTINCT FROM OLD.answer_content OR NEW.answer_short IS DISTINCT FROM OLD.answer_short) AND
    btrim(coalesce(NEW.answer_short,''))='' THEN
    RAISE EXCEPTION 'Bitte eine Kurzantwort mit 1 bis 3 Sätzen eingeben (höchstens 500 Zeichen)' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_require_short_answer() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS knowledge_qa_short_answer_required ON public.knowledge_questions;
CREATE TRIGGER knowledge_qa_short_answer_required BEFORE INSERT OR UPDATE ON public.knowledge_questions
  FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_require_short_answer();

-- The short answer ranks above the long answer (B before C) and below the title.
CREATE OR REPLACE FUNCTION public.knowledge_qa_update_search() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.title IS NOT DISTINCT FROM OLD.title AND NEW.description IS NOT DISTINCT FROM OLD.description
 AND NEW.answer_text IS NOT DISTINCT FROM OLD.answer_text AND NEW.answer_short IS NOT DISTINCT FROM OLD.answer_short
 AND NEW.tag_search_text IS NOT DISTINCT FROM OLD.tag_search_text THEN
 NEW.search_vector:=OLD.search_vector; RETURN NEW; END IF;
 NEW.search_vector:=setweight(to_tsvector('german',knowledge_qa_normalize(NEW.title)),'A') ||
 setweight(to_tsvector('german',knowledge_qa_normalize(NEW.description||' '||NEW.tag_search_text)),'B') ||
 setweight(to_tsvector('german',knowledge_qa_normalize(coalesce(NEW.answer_short,''))),'B') ||
 setweight(to_tsvector('german',knowledge_qa_normalize(NEW.answer_text)),'C'); RETURN NEW;
END $$;

-- Save answer and short answer atomically. The previous three-argument
-- signature is replaced so no client can skip the short answer.
DROP FUNCTION IF EXISTS public.knowledge_qa_save_answer(uuid,integer,jsonb);
CREATE OR REPLACE FUNCTION public.knowledge_qa_save_answer(p_question uuid,p_expected_revision integer,p_content jsonb,p_short text DEFAULT NULL)
RETURNS public.knowledge_questions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; plain text; short_text text;
BEGIN
  SELECT * INTO q FROM knowledge_questions WHERE id=p_question FOR UPDATE;
  IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
  IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Frage wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  IF p_content IS NULL OR octet_length(p_content::text)>200000 OR p_content->'root'->>'type' IS DISTINCT FROM 'root' THEN
    RAISE EXCEPTION 'Ungültiger oder zu langer Antwortinhalt' USING ERRCODE='22023';
  END IF;
  plain:=btrim(knowledge_qa_node_text(p_content->'root'), E' \n\r\t');
  IF length(plain) NOT BETWEEN 1 AND 50000 THEN RAISE EXCEPTION 'Bitte eine Antwort eingeben (höchstens 50.000 Zeichen)' USING ERRCODE='22023'; END IF;
  short_text:=btrim(regexp_replace(coalesce(p_short,''),'\s+',' ','g'));
  IF length(short_text) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Bitte eine Kurzantwort mit 1 bis 3 Sätzen eingeben (höchstens 500 Zeichen)' USING ERRCODE='22023';
  END IF;
  IF q.answer_content IS NOT DISTINCT FROM p_content AND q.answer_short IS NOT DISTINCT FROM short_text THEN RETURN q; END IF;
  UPDATE knowledge_questions SET answer_content=p_content,answer_short=short_text,answer_text=plain,
    answered_by=coalesce(answered_by,auth.uid()),answered_at=coalesce(answered_at,now()),
    answer_updated_at=now(),updated_at=now(),updated_by=auth.uid(),revision=revision+1,answer_revision=answer_revision+1,
    review_status='unverified',verified_by=NULL,verified_at=NULL,verified_answer_revision=NULL,review_due_at=NULL
    WHERE id=q.id RETURNING * INTO q;
  RETURN q;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_save_answer(uuid,integer,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_save_answer(uuid,integer,jsonb,text) TO authenticated;

-- Both read views keep their established column order: every existing column is
-- re-emitted in place and the short answer is appended once. Derived columns are
-- mapped explicitly, so a re-run stays identical and installations without the
-- optional tags table remain valid.
DO $$ DECLARE columns text; BEGIN
 SELECT string_agg(CASE attname
  WHEN 'answer_excerpt' THEN 'CASE WHEN length(btrim(q.answer_short))>0 THEN q.answer_short ELSE left(q.answer_text,200) END'
  WHEN 'effective_review_status' THEN 'CASE WHEN q.review_status=''needs_review'' OR q.review_due_at<=now() THEN ''needs_review'' ELSE q.review_status END'
  WHEN 'server_now' THEN 'now()'
  WHEN 'created_by_person' THEN 'jsonb_build_object(''user_id'',q.created_by,''display_name'',creator.display_name,''avatar_url'',creator.avatar_url)'
  WHEN 'assigned_to_person' THEN 'CASE WHEN q.assigned_to IS NOT NULL THEN jsonb_build_object(''user_id'',q.assigned_to,''display_name'',assignee.display_name,''avatar_url'',assignee.avatar_url) END'
  WHEN 'verified_by_person' THEN 'CASE WHEN q.verified_by IS NOT NULL THEN jsonb_build_object(''user_id'',q.verified_by,''display_name'',verifier.display_name,''avatar_url'',verifier.avatar_url) END'
  WHEN 'tags' THEN '(SELECT coalesce(jsonb_agg(jsonb_build_object(''id'',t.id,''name'',t.name) ORDER BY lower(t.name),t.id),''[]''::jsonb) FROM public.knowledge_question_tags qt JOIN public.knowledge_tags t ON t.id=qt.tag_id AND t.tenant_id=qt.tenant_id WHERE qt.question_id=q.id)'
  ELSE 'q.'||quote_ident(attname) END || ' AS '||quote_ident(attname),',' ORDER BY attnum)
 INTO columns FROM pg_attribute
 WHERE attrelid='public.knowledge_question_summaries'::regclass AND attnum>0 AND NOT attisdropped
 AND attname<>'answer_short';
 EXECUTE 'CREATE OR REPLACE VIEW public.knowledge_question_summaries WITH (security_invoker=true) AS SELECT '||columns||
 ',q.answer_short AS answer_short FROM public.knowledge_questions q
 LEFT JOIN public.profiles creator ON creator.user_id=q.created_by AND creator.tenant_id=q.tenant_id
 LEFT JOIN public.profiles assignee ON assignee.user_id=q.assigned_to AND assignee.tenant_id=q.tenant_id
 LEFT JOIN public.profiles verifier ON verifier.user_id=q.verified_by AND verifier.tenant_id=q.tenant_id';
END $$;

DO $$ DECLARE columns text; BEGIN
 SELECT string_agg(CASE attname
  WHEN 'effective_review_status' THEN 'CASE WHEN q.review_status=''needs_review'' OR q.review_due_at<=now() THEN ''needs_review'' ELSE q.review_status END'
  WHEN 'server_now' THEN 'now()'
  WHEN 'created_by_person' THEN 'jsonb_build_object(''user_id'',q.created_by,''display_name'',creator.display_name,''avatar_url'',creator.avatar_url)'
  WHEN 'assigned_to_person' THEN 'CASE WHEN q.assigned_to IS NOT NULL THEN jsonb_build_object(''user_id'',q.assigned_to,''display_name'',assignee.display_name,''avatar_url'',assignee.avatar_url) END'
  WHEN 'verified_by_person' THEN 'CASE WHEN q.verified_by IS NOT NULL THEN jsonb_build_object(''user_id'',q.verified_by,''display_name'',verifier.display_name,''avatar_url'',verifier.avatar_url) END'
  WHEN 'tags' THEN '(SELECT coalesce(jsonb_agg(jsonb_build_object(''id'',t.id,''name'',t.name) ORDER BY lower(t.name),t.id),''[]''::jsonb) FROM public.knowledge_question_tags qt JOIN public.knowledge_tags t ON t.id=qt.tag_id AND t.tenant_id=qt.tenant_id WHERE qt.question_id=q.id)'
  ELSE 'q.'||quote_ident(attname) END || ' AS '||quote_ident(attname),',' ORDER BY attnum)
 INTO columns FROM pg_attribute
 WHERE attrelid='public.knowledge_question_cards'::regclass AND attnum>0 AND NOT attisdropped
 AND attname<>'answer_short';
 EXECUTE 'CREATE OR REPLACE VIEW public.knowledge_question_cards WITH (security_invoker=true) AS SELECT '||columns||
 ',q.answer_short AS answer_short FROM public.knowledge_questions q
 LEFT JOIN public.profiles creator ON creator.user_id=q.created_by AND creator.tenant_id=q.tenant_id
 LEFT JOIN public.profiles assignee ON assignee.user_id=q.assigned_to AND assignee.tenant_id=q.tenant_id
 LEFT JOIN public.profiles verifier ON verifier.user_id=q.verified_by AND verifier.tenant_id=q.tenant_id';
END $$;

-- Lists show the short answer; full-text hits keep a highlighted excerpt from
-- short and long answer so a match in the long text stays visible.
CREATE OR REPLACE FUNCTION public.knowledge_qa_list(p_tenant uuid,p_query text DEFAULT '',p_view text DEFAULT 'answers',p_limit integer DEFAULT 20,p_cursor jsonb DEFAULT NULL,p_status text DEFAULT '',p_assignee text DEFAULT '',p_sort text DEFAULT 'updated',p_tag text DEFAULT '',p_quick text DEFAULT '')
RETURNS TABLE(items jsonb,total_count bigint,next_cursor jsonb,counts jsonb,topics jsonb)
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
 IF p_quick IS NULL OR p_quick NOT IN ('','open','assigned','review') OR p_tag IS NULL OR (p_tag<>'' AND p_tag !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'Ungültiger Schnell- oder Tagfilter' USING ERRCODE='22023'; END IF;
 IF p_tag<>'' AND NOT EXISTS(SELECT 1 FROM knowledge_tags WHERE id=p_tag::uuid AND tenant_id=p_tenant) THEN RAISE EXCEPTION 'Ungültiger Tagfilter' USING ERRCODE='22023'; END IF;
 IF ((p_view='review' AND p_quick='') OR p_quick='review') AND NOT knowledge_qa_can_access(p_tenant,'knowledge.verify') THEN
 RAISE EXCEPTION 'Keine Prüfberechtigung' USING ERRCODE='42501'; END IF;
 IF p_cursor IS NOT NULL AND (jsonb_typeof(p_cursor)<>'object' OR NOT p_cursor ?& ARRAY['id','updated_at','rank']) THEN
 RAISE EXCEPTION 'Ungültiger Cursor' USING ERRCODE='22023'; END IF;
 predicate:=$filter$ q.tenant_id=$1 AND q.archived_at IS NULL AND CASE WHEN $12<>'' THEN true ELSE CASE $3 WHEN 'answers' THEN q.answered_at IS NOT NULL WHEN 'open' THEN q.answered_at IS NULL
 WHEN 'assigned' THEN q.assigned_to=auth.uid()
 WHEN 'review' THEN q.answered_at IS NOT NULL AND (q.review_status='needs_review' OR q.review_due_at<=now())
 ELSE q.created_by=auth.uid() OR EXISTS(SELECT 1 FROM knowledge_question_events e WHERE e.tenant_id=$1 AND e.question_id=q.id AND e.actor_id=auth.uid() AND e.event_type='answer_changed') END END
 AND ($9='' OR CASE WHEN $9='open' THEN q.answered_at IS NULL ELSE q.answered_at IS NOT NULL AND
 CASE WHEN q.review_status='needs_review' OR q.review_due_at<=now() THEN 'needs_review' ELSE q.review_status END=$9 END)
 AND ($10='' OR CASE WHEN $10='unassigned' THEN q.assigned_to IS NULL ELSE q.assigned_to=nullif(nullif($10,''),'unassigned')::uuid END)
 AND ($11='' OR EXISTS(SELECT 1 FROM knowledge_question_tags qt WHERE qt.question_id=q.id AND qt.tenant_id=q.tenant_id AND qt.tag_id=nullif($11,'')::uuid))
 AND CASE $12 WHEN 'open' THEN q.answered_at IS NULL WHEN 'assigned' THEN q.assigned_to=auth.uid() WHEN 'review' THEN q.answered_at IS NOT NULL AND (q.review_status='needs_review' OR q.review_due_at<=now()) ELSE true END $filter$;
 IF browsing THEN
  source:='SELECT q.id,q.updated_at,0::double precision AS rank FROM knowledge_questions q WHERE ' || predicate;
  ordering:=CASE WHEN p_sort='oldest' THEN 'updated_at ASC,id' ELSE 'updated_at DESC,id' END;
  boundary:='updated_at' || CASE WHEN p_sort='oldest' THEN '>' ELSE '<' END || '($5->>''updated_at'')::timestamptz OR (updated_at=($5->>''updated_at'')::timestamptz AND id>($5->>''id'')::uuid)';
 ELSE
  SELECT string_agg(quote_literal(word)||':*',' & ') INTO expression FROM unnest(tsvector_to_array(to_tsvector('german',normalized))) word;
  term:=CASE WHEN expression IS NOT NULL THEN to_tsquery('german',expression) ELSE plainto_tsquery('german',normalized) END;
  EXECUTE 'SELECT NOT EXISTS(SELECT 1 FROM knowledge_questions q WHERE '||predicate||' AND q.search_vector @@ $2)' INTO fuzzy USING p_tenant,term,p_view,p_limit,p_cursor,normalized,browsing,fuzzy,p_status,p_assignee,p_tag,p_quick;
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
 CASE WHEN $7 OR $8 THEN page.answer_excerpt ELSE left(ts_headline('german',coalesce(q.answer_short||E'\n','')||q.answer_text,$2,'StartSel=,StopSel=,MaxWords=35,MinWords=15,MaxFragments=1'),220) END) ORDER BY n),'[]'),
 (SELECT count(*) FROM matches), CASE WHEN (SELECT count(*) FROM numbered)>$4 THEN
 (SELECT jsonb_build_object('id',p.id,'updated_at',p.updated_at,'rank',p.rank) FROM page p ORDER BY p.n DESC LIMIT 1) END
, (SELECT to_jsonb(c) FROM knowledge_qa_counts($1) c), (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM knowledge_qa_tag_topics($1) t)
 FROM page JOIN knowledge_questions q ON q.id=page.id
 $sql$,source,boundary,ordering,ordering)
 USING p_tenant,term,p_view,p_limit,p_cursor,normalized,browsing,fuzzy,p_status,p_assignee,p_tag,p_quick;
END $$;

-- Selftest now covers the short answer: required, stored, searchable, and
-- confirmation-invalidating when only the short answer changes.
CREATE OR REPLACE FUNCTION public.knowledge_qa_selftest(p_tenant uuid)
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
      BEGIN
        PERFORM knowledge_qa_save_answer(q.id,q.revision,payload);
        result:=result || jsonb_build_object('short_answer_required',false);
      EXCEPTION WHEN invalid_parameter_value THEN result:=result || jsonb_build_object('short_answer_required',true); END;
      q:=knowledge_qa_save_answer(q.id,q.revision,payload,'Kurzantwort mit Stichwortdachs.');
      result:=result || jsonb_build_object('answer_unverified',q.review_status='unverified' AND q.answer_text='Antwort im Selbsttest.');
      result:=result || jsonb_build_object('short_answer_stored',q.answer_short='Kurzantwort mit Stichwortdachs.');
      result:=result || jsonb_build_object('short_answer_searchable',
        (SELECT bool_and(search_vector @@ plainto_tsquery('german','stichwortdachs')) FROM knowledge_questions WHERE id=q.id));
      IF knowledge_qa_can_access(p_tenant,'knowledge.verify') THEN
        q:=knowledge_qa_review(q.id,q.revision,true);
        result:=result || jsonb_build_object('manual_review',q.verified_by=auth.uid() AND q.verified_at IS NOT NULL AND q.verified_answer_revision=q.answer_revision);
        q:=knowledge_qa_set_assignee(q.id,q.revision,auth.uid());
        result:=result || jsonb_build_object('assignment_preserves_review',q.review_status='verified');
        previous:=q;
        q:=knowledge_qa_save_answer(q.id,q.revision,payload,'Geänderte Kurzantwort.');
        result:=result || jsonb_build_object('short_answer_change_invalidates_review',q.review_status='unverified' AND q.verified_at IS NULL);
        payload:=jsonb_set(payload,'{root,children,0,children,0,text}','"Geänderte Antwort im Selbsttest."');
        q:=knowledge_qa_save_answer(q.id,q.revision,payload,'Geänderte Kurzantwort.');
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

NOTIFY pgrst, 'reload schema';
