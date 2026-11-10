ALTER TABLE public.knowledge_questions ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('german'::regconfig,title),'A') || setweight(to_tsvector('german'::regconfig,answer_text),'B')
) STORED;
CREATE INDEX knowledge_questions_fts ON public.knowledge_questions USING gin(search_vector);

CREATE VIEW public.knowledge_question_cards WITH (security_invoker=true) AS
SELECT q.*,CASE WHEN q.review_status='needs_review' OR q.review_due_at<=now() THEN 'needs_review' ELSE q.review_status END AS effective_review_status,
  now() AS server_now
FROM public.knowledge_questions q;
REVOKE ALL ON public.knowledge_question_cards FROM anon;
GRANT SELECT ON public.knowledge_question_cards TO authenticated;

CREATE FUNCTION public.search_knowledge_questions(p_tenant uuid,p_query text DEFAULT '',p_view text DEFAULT 'answers',
  p_limit integer DEFAULT 20,p_offset integer DEFAULT 0,p_question uuid DEFAULT NULL)
RETURNS SETOF public.knowledge_question_cards LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE query tsquery; expression text;
BEGIN
  IF length(coalesce(p_query,''))>300 OR p_view NOT IN ('answers','open','mine') OR p_view IS NULL THEN
    RAISE EXCEPTION 'Ungültige Suchanfrage' USING ERRCODE='22023'; END IF;
  -- Extract lexemes rather than accepting user-supplied tsquery operators.
  SELECT string_agg(quote_literal(word) || ':*',' & ') INTO expression
    FROM unnest(tsvector_to_array(to_tsvector('german',coalesce(p_query,'')))) word;
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
  ORDER BY CASE WHEN query IS NOT NULL AND to_tsvector('german',c.title) @@ query THEN 1 ELSE 0 END DESC,
    coalesce(ts_rank_cd(c.search_vector,query),0) DESC,c.updated_at DESC,c.id
  LIMIT greatest(1,least(coalesce(p_limit,20),50)) OFFSET greatest(0,least(coalesce(p_offset,0),10000));
END $$;
REVOKE ALL ON FUNCTION public.search_knowledge_questions(uuid,text,text,integer,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_knowledge_questions(uuid,text,text,integer,integer,uuid) TO authenticated;
