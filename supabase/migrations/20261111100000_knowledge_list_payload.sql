-- Keep list payload independent of answer size; full rows remain RLS-protected.
CREATE OR REPLACE VIEW public.knowledge_question_summaries WITH (security_invoker=true) AS
SELECT id,tenant_id,title,left(description,300) AS description,
 left(answer_text,200) AS answer_excerpt,answered_at,review_status,
 CASE WHEN review_status='needs_review' OR review_due_at<=now() THEN 'needs_review' ELSE review_status END AS effective_review_status,
 review_due_at,assigned_to,created_by,created_at,updated_at,answer_updated_at,revision,now() AS server_now
FROM public.knowledge_questions;
GRANT SELECT ON public.knowledge_question_summaries TO authenticated;
REVOKE ALL ON public.knowledge_question_summaries FROM anon;
CREATE OR REPLACE FUNCTION public.knowledge_qa_list(p_tenant uuid,p_query text DEFAULT '',p_view text DEFAULT 'answers',p_limit integer DEFAULT 20,p_offset integer DEFAULT 0)
RETURNS TABLE(items jsonb,total_count bigint) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 WITH matches AS MATERIALIZED (
 SELECT q.id,row_number() OVER (ORDER BY q.updated_at DESC,q.id) AS position
 FROM knowledge_questions q WHERE q.tenant_id=p_tenant AND length(p_query)<=300
 AND p_view IN ('answers','open','mine')
 AND CASE p_view WHEN 'answers' THEN q.answered_at IS NOT NULL WHEN 'open' THEN q.answered_at IS NULL
 ELSE q.created_by=auth.uid() OR EXISTS(SELECT 1 FROM knowledge_question_events e WHERE e.tenant_id=p_tenant AND e.question_id=q.id AND e.actor_id=auth.uid() AND e.event_type='answer_changed') END
 AND (btrim(p_query)='' OR q.search_vector @@ plainto_tsquery('german',p_query))
 ), page AS (
 SELECT s.*,m.position FROM matches m JOIN knowledge_question_summaries s ON s.id=m.id
 ORDER BY m.position LIMIT greatest(1,least(p_limit,50)) OFFSET greatest(0,p_offset)
 )
 SELECT coalesce(jsonb_agg(to_jsonb(page)-'position' ORDER BY position),'[]'),(SELECT count(*) FROM matches) FROM page;
$$;
REVOKE ALL ON FUNCTION public.knowledge_qa_list(uuid,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_list(uuid,text,text,integer,integer) TO authenticated;
-- Realtime is optional in installations without a publication.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
 AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='knowledge_questions') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_questions;
 END IF;
END $$;
