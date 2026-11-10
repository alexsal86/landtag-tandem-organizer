-- Views and server-side whitelists share RLS; contributions have a covering index.
CREATE INDEX IF NOT EXISTS knowledge_events_contributor ON public.knowledge_question_events(tenant_id,actor_id,event_type,question_id);
CREATE INDEX IF NOT EXISTS knowledge_questions_assignee_updated ON public.knowledge_questions(tenant_id,assigned_to,updated_at DESC,id);
DROP FUNCTION IF EXISTS public.knowledge_qa_list(uuid,text,text,integer,jsonb);
CREATE OR REPLACE FUNCTION public.knowledge_qa_list(p_tenant uuid,p_query text DEFAULT '',p_view text DEFAULT 'answers',p_limit integer DEFAULT 20,p_cursor jsonb DEFAULT NULL,p_status text DEFAULT '',p_assignee text DEFAULT '',p_sort text DEFAULT 'updated')
RETURNS TABLE(items jsonb,total_count bigint,next_cursor jsonb)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,extensions,pg_temp SET pg_trgm.word_similarity_threshold=0.35 AS $$
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
 predicate:=$filter$ q.tenant_id=$1 AND CASE $3 WHEN 'answers' THEN q.answered_at IS NOT NULL WHEN 'open' THEN q.answered_at IS NULL
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
   source:='SELECT q.id,q.updated_at,greatest(similarity(knowledge_qa_normalize(q.title),$6),word_similarity($6,knowledge_qa_normalize(q.title)))::double precision AS rank FROM knowledge_questions q WHERE '||predicate||' AND knowledge_qa_normalize(q.title) %> $6';
  ELSE
   source:='SELECT q.id,q.updated_at,(CASE WHEN q.title_search_vector @@ $2 THEN 1 ELSE 0 END + ts_rank_cd(q.search_vector,$2))::double precision AS rank FROM knowledge_questions q WHERE '||predicate||' AND q.search_vector @@ $2';
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
 FROM knowledge_questions q WHERE q.tenant_id=p_tenant;
$$;
REVOKE ALL ON FUNCTION public.knowledge_qa_counts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_counts(uuid) TO authenticated;
