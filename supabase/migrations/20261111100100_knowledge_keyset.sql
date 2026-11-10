-- A stable tie-breaker avoids offsets; count refers to all matches before cursor.
DROP FUNCTION IF EXISTS public.knowledge_qa_list(uuid,text,text,integer,integer);
CREATE OR REPLACE FUNCTION public.knowledge_qa_list(p_tenant uuid,p_query text DEFAULT '',p_view text DEFAULT 'answers',p_limit integer DEFAULT 20,p_cursor jsonb DEFAULT NULL)
RETURNS TABLE(items jsonb,total_count bigint,next_cursor jsonb)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE term tsquery:=plainto_tsquery('german',coalesce(p_query,''));
BEGIN
 IF p_view IS NULL OR p_view NOT IN ('answers','open','mine') OR length(coalesce(p_query,''))>300
 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Ungültige Suchanfrage' USING ERRCODE='22023'; END IF;
 IF p_cursor IS NOT NULL AND (jsonb_typeof(p_cursor)<>'object' OR NOT p_cursor ?& ARRAY['id','updated_at','rank']) THEN
 RAISE EXCEPTION 'Ungültiger Cursor' USING ERRCODE='22023'; END IF;
 RETURN QUERY WITH matches AS MATERIALIZED (
  SELECT q.id,q.updated_at,coalesce(ts_rank_cd(q.search_vector,term),0)::double precision AS rank
  FROM knowledge_questions q WHERE q.tenant_id=p_tenant
  AND CASE p_view WHEN 'answers' THEN q.answered_at IS NOT NULL WHEN 'open' THEN q.answered_at IS NULL
   ELSE q.created_by=auth.uid() OR EXISTS(SELECT 1 FROM knowledge_question_events e WHERE e.tenant_id=p_tenant AND e.question_id=q.id AND e.actor_id=auth.uid() AND e.event_type='answer_changed') END
  AND (btrim(coalesce(p_query,''))='' OR q.search_vector @@ term)
 ), candidates AS (
 SELECT m.* FROM matches m WHERE p_cursor IS NULL OR
 CASE WHEN btrim(coalesce(p_query,''))='' THEN m.updated_at<(p_cursor->>'updated_at')::timestamptz OR (m.updated_at=(p_cursor->>'updated_at')::timestamptz AND m.id>(p_cursor->>'id')::uuid)
 ELSE m.rank<(p_cursor->>'rank')::double precision OR (m.rank=(p_cursor->>'rank')::double precision AND m.id>(p_cursor->>'id')::uuid) END
 ORDER BY CASE WHEN btrim(coalesce(p_query,''))<>'' THEN m.rank END DESC,
 CASE WHEN btrim(coalesce(p_query,''))='' THEN m.updated_at END DESC,m.id LIMIT p_limit+1
 ), numbered AS (
 SELECT c.*,row_number() OVER (ORDER BY CASE WHEN btrim(coalesce(p_query,''))<>'' THEN c.rank END DESC,
 CASE WHEN btrim(coalesce(p_query,''))='' THEN c.updated_at END DESC,c.id) AS n FROM candidates c
 ), page AS (
 SELECT s.*,n.n,n.rank FROM numbered n JOIN knowledge_question_summaries s ON s.id=n.id WHERE n.n<=p_limit
 )
 SELECT coalesce(jsonb_agg(to_jsonb(page)-'n'-'rank' ORDER BY n),'[]'),(SELECT count(*) FROM matches),
 CASE WHEN (SELECT count(*) FROM numbered)>p_limit THEN
 (SELECT jsonb_build_object('id',p.id,'updated_at',p.updated_at,'rank',p.rank) FROM page p ORDER BY p.n DESC LIMIT 1) END
 FROM page;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_list(uuid,text,text,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_list(uuid,text,text,integer,jsonb) TO authenticated;
