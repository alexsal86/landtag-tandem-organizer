-- Quick views select their own scope; retain the existing cursor and RLS boundaries.
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
 CASE WHEN $7 OR $8 THEN page.answer_excerpt ELSE left(ts_headline('german',q.answer_text,$2,'StartSel=,StopSel=,MaxWords=35,MinWords=15,MaxFragments=1'),220) END) ORDER BY n),'[]'),
 (SELECT count(*) FROM matches), CASE WHEN (SELECT count(*) FROM numbered)>$4 THEN
 (SELECT jsonb_build_object('id',p.id,'updated_at',p.updated_at,'rank',p.rank) FROM page p ORDER BY p.n DESC LIMIT 1) END
, (SELECT to_jsonb(c) FROM knowledge_qa_counts($1) c), (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM knowledge_qa_tag_topics($1) t)
 FROM page JOIN knowledge_questions q ON q.id=page.id
 $sql$,source,boundary,ordering,ordering)
 USING p_tenant,term,p_view,p_limit,p_cursor,normalized,browsing,fuzzy,p_status,p_assignee,p_tag,p_quick;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_list(uuid,text,text,integer,jsonb,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_list(uuid,text,text,integer,jsonb,text,text,text,text,text) TO authenticated;



-- A NULL metadata marker must never loosen archive protection.
CREATE OR REPLACE FUNCTION public.knowledge_qa_guard_archived() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.archived_at IS NOT NULL AND NOT coalesce((
 NEW.metadata_event='tags_changed' AND NEW.metadata_revision=OLD.metadata_revision+1 AND knowledge_qa_can_access(OLD.tenant_id,'knowledge.manage') AND
 (to_jsonb(NEW)-ARRAY['tag_search_text','search_vector','title_search_vector','revision','metadata_revision','metadata_event','metadata_note','updated_at','updated_by']) IS NOT DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['tag_search_text','search_vector','title_search_vector','revision','metadata_revision','metadata_event','metadata_note','updated_at','updated_by'])
 ),false) THEN RAISE EXCEPTION 'Geschlossene Fragen können nicht geändert werden' USING ERRCODE='22023'; END IF; RETURN NEW;
END $$;

-- Metadata-only edits must not rebuild a 50k-character answer search vector.
CREATE OR REPLACE FUNCTION public.knowledge_qa_update_search() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.title IS NOT DISTINCT FROM OLD.title AND NEW.description IS NOT DISTINCT FROM OLD.description
 AND NEW.answer_text IS NOT DISTINCT FROM OLD.answer_text AND NEW.tag_search_text IS NOT DISTINCT FROM OLD.tag_search_text THEN
 NEW.search_vector:=OLD.search_vector; RETURN NEW; END IF;
 NEW.search_vector:=setweight(to_tsvector('german',knowledge_qa_normalize(NEW.title)),'A') ||
 setweight(to_tsvector('german',knowledge_qa_normalize(NEW.description||' '||NEW.tag_search_text)),'B') ||
 setweight(to_tsvector('german',knowledge_qa_normalize(NEW.answer_text)),'C'); RETURN NEW;
END $$;

-- Preserve tag names at event time, including rename/merge history.
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
  VALUES(NEW.tenant_id,NEW.id,NEW.revision,event_name,auth.uid(),
    (to_jsonb(NEW)-'search_vector'-'title_search_vector'-'tag_search_text') || jsonb_build_object('tags', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) ORDER BY lower(t.name),t.id),'[]'::jsonb) FROM knowledge_question_tags qt JOIN knowledge_tags t ON t.id=qt.tag_id AND t.tenant_id=qt.tenant_id WHERE qt.question_id=NEW.id), 'attachments',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'file_size',a.file_size)), '[]'::jsonb)
       FROM knowledge_question_attachments a WHERE a.question_id=NEW.id AND a.state='ready')));
  RETURN NEW;
END $$;

-- Make the extended RPC signature and new source/comment views visible to PostgREST.
NOTIFY pgrst, 'reload schema';
