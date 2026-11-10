-- Rebuild weighted vectors once on writes; never parse every title during sorting.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION public.knowledge_qa_normalize(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=public,extensions,pg_temp AS $$
 SELECT unaccent('extensions.unaccent'::regdictionary,replace(replace(replace(lower(coalesce(value,'')),'ae','ä'),'oe','ö'),'ue','ü'));
$$;
DROP FUNCTION IF EXISTS public.search_knowledge_questions(uuid,text,text,integer,integer,uuid);
DROP VIEW IF EXISTS public.knowledge_question_cards;
DROP INDEX IF EXISTS public.knowledge_questions_fts;
ALTER TABLE public.knowledge_questions DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.knowledge_questions ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
 setweight(to_tsvector('german'::regconfig,knowledge_qa_normalize(title)),'A') ||
 setweight(to_tsvector('german'::regconfig,knowledge_qa_normalize(description)),'B') ||
 setweight(to_tsvector('german'::regconfig,knowledge_qa_normalize(answer_text)),'C')
) STORED;
ALTER TABLE public.knowledge_questions ADD COLUMN IF NOT EXISTS title_search_vector tsvector GENERATED ALWAYS AS (
 to_tsvector('german'::regconfig,knowledge_qa_normalize(title))) STORED;
CREATE INDEX IF NOT EXISTS knowledge_questions_fts ON public.knowledge_questions USING gin(search_vector);
CREATE INDEX IF NOT EXISTS knowledge_questions_title_trgm ON public.knowledge_questions USING gin(knowledge_qa_normalize(title) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS knowledge_questions_answered_updated ON public.knowledge_questions(tenant_id,updated_at DESC,id) WHERE answered_at IS NOT NULL;
CREATE OR REPLACE VIEW public.knowledge_question_cards WITH (security_invoker=true) AS
SELECT q.*,CASE WHEN q.review_status='needs_review' OR q.review_due_at<=now() THEN 'needs_review' ELSE q.review_status END AS effective_review_status,
  now() AS server_now
FROM public.knowledge_questions q;
REVOKE ALL ON public.knowledge_question_cards FROM anon;
GRANT SELECT ON public.knowledge_question_cards TO authenticated;

CREATE OR REPLACE FUNCTION public.search_knowledge_questions(p_tenant uuid,p_query text DEFAULT '',p_view text DEFAULT 'answers',
  p_limit integer DEFAULT 20,p_offset integer DEFAULT 0,p_question uuid DEFAULT NULL)
RETURNS SETOF public.knowledge_question_cards LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE query tsquery; expression text;
BEGIN
  IF length(coalesce(p_query,''))>300 OR p_view NOT IN ('answers','open','mine') OR p_view IS NULL THEN
    RAISE EXCEPTION 'Ungültige Suchanfrage' USING ERRCODE='22023'; END IF;
  -- Extract lexemes rather than accepting user-supplied tsquery operators.
  SELECT string_agg(quote_literal(word) || ':*',' & ') INTO expression
    FROM unnest(tsvector_to_array(to_tsvector('german',knowledge_qa_normalize(p_query)))) word;
  IF expression IS NOT NULL THEN query:=to_tsquery('german',expression); END IF;
  RETURN QUERY SELECT c.* FROM knowledge_question_cards c
  WHERE c.tenant_id=p_tenant AND (p_question IS NULL OR c.id=p_question)
    AND (p_question IS NOT NULL OR CASE p_view WHEN 'answers' THEN c.answered_at IS NOT NULL
      WHEN 'open' THEN c.answered_at IS NULL
      ELSE c.created_by=auth.uid() OR EXISTS(SELECT 1 FROM knowledge_question_events e
        WHERE e.question_id=c.id AND e.tenant_id=p_tenant AND e.actor_id=auth.uid() AND e.event_type='answer_changed') END)
    AND (btrim(coalesce(p_query,''))='' OR
      CASE WHEN query IS NOT NULL THEN c.search_vector @@ query
      ELSE position(lower(btrim(p_query)) IN lower(c.title || ' ' || c.answer_text))>0 END)
  ORDER BY CASE WHEN query IS NOT NULL AND c.title_search_vector @@ query THEN 1 ELSE 0 END DESC,
    coalesce(ts_rank_cd(c.search_vector,query),0) DESC,c.updated_at DESC,c.id
  LIMIT greatest(1,least(coalesce(p_limit,20),50)) OFFSET greatest(0,least(coalesce(p_offset,0),10000));
END $$;
REVOKE ALL ON FUNCTION public.search_knowledge_questions(uuid,text,text,integer,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_knowledge_questions(uuid,text,text,integer,integer,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.knowledge_qa_list(p_tenant uuid,p_query text DEFAULT '',p_view text DEFAULT 'answers',p_limit integer DEFAULT 20,p_cursor jsonb DEFAULT NULL)
RETURNS TABLE(items jsonb,total_count bigint,next_cursor jsonb)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,extensions,pg_temp SET pg_trgm.word_similarity_threshold=0.35 AS $$
DECLARE term tsquery; expression text; normalized text:=knowledge_qa_normalize(btrim(p_query));
 browsing boolean:=btrim(coalesce(p_query,''))=''; fuzzy boolean:=false;
 predicate text; source text; ordering text; boundary text;
BEGIN
 IF p_view IS NULL OR p_view NOT IN ('answers','open','mine') OR length(coalesce(p_query,''))>300
 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Ungültige Suchanfrage' USING ERRCODE='22023'; END IF;
 IF p_cursor IS NOT NULL AND (jsonb_typeof(p_cursor)<>'object' OR NOT p_cursor ?& ARRAY['id','updated_at','rank']) THEN
 RAISE EXCEPTION 'Ungültiger Cursor' USING ERRCODE='22023'; END IF;
 predicate:=$filter$ q.tenant_id=$1 AND CASE $3 WHEN 'answers' THEN q.answered_at IS NOT NULL WHEN 'open' THEN q.answered_at IS NULL
 ELSE q.created_by=auth.uid() OR EXISTS(SELECT 1 FROM knowledge_question_events e WHERE e.tenant_id=$1 AND e.question_id=q.id AND e.actor_id=auth.uid() AND e.event_type='answer_changed') END $filter$;
 IF browsing THEN
  source:='SELECT q.id,q.updated_at,0::double precision AS rank FROM knowledge_questions q WHERE ' || predicate;
  ordering:='updated_at DESC,id';
  boundary:='updated_at<($5->>''updated_at'')::timestamptz OR (updated_at=($5->>''updated_at'')::timestamptz AND id>($5->>''id'')::uuid)';
 ELSE
  SELECT string_agg(quote_literal(word)||':*',' & ') INTO expression FROM unnest(tsvector_to_array(to_tsvector('german',normalized))) word;
  term:=CASE WHEN expression IS NOT NULL THEN to_tsquery('german',expression) ELSE plainto_tsquery('german',normalized) END;
  EXECUTE 'SELECT NOT EXISTS(SELECT 1 FROM knowledge_questions q WHERE '||predicate||' AND q.search_vector @@ $2)' INTO fuzzy USING p_tenant,term,p_view;
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
 USING p_tenant,term,p_view,p_limit,p_cursor,normalized,browsing,fuzzy;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_list(uuid,text,text,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_list(uuid,text,text,integer,jsonb) TO authenticated;

-- Search indexes are derived data and do not belong in audit snapshots.
CREATE OR REPLACE FUNCTION public.knowledge_qa_record_event()
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
    (to_jsonb(NEW)-'search_vector'-'title_search_vector') || jsonb_build_object('attachments',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'file_size',a.file_size)), '[]'::jsonb)
       FROM knowledge_question_attachments a WHERE a.question_id=NEW.id AND a.state='ready')));
  RETURN NEW;
END $$;
