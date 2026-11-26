-- Etappe 1 der zentralen Themen: Die Oberfläche schreibt Vorgangs- und
-- Wissensfragen-Themen direkt in die Verknüpfungstabellen. Der bisherige
-- JSON-Spiegel für Vorgänge wird stillgelegt, damit spätere Payload-Updates
-- keine Themen mehr löschen oder aus veralteten topic_ids wieder anlegen.
DROP TRIGGER IF EXISTS sync_case_item_topics ON public.case_items;
DROP FUNCTION IF EXISTS public.sync_case_item_topics();

-- Wissen: Themen werden wie Tags revisionsgeschützt und nur nach einer Antwort
-- gepflegt. Die Modulregeln begrenzen Anzahl, Pflicht und Abschaltbarkeit.
CREATE OR REPLACE FUNCTION public.knowledge_qa_set_topics(
  p_question uuid,
  p_expected_revision integer,
  p_topic_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  q public.knowledge_questions;
  v_enabled boolean := true;
  v_required boolean := false;
  v_max integer := 5;
  v_old uuid[] := '{}';
  v_new uuid[] := '{}';
  v_names text;
BEGIN
  SELECT * INTO q
  FROM public.knowledge_questions
  WHERE id = p_question
  FOR UPDATE;

  IF NOT FOUND
     OR NOT public.knowledge_qa_can_access(q.tenant_id, 'knowledge.write') THEN
    RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE = '42501';
  END IF;
  IF q.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'Die Frage wurde inzwischen geändert.' USING ERRCODE = '40001';
  END IF;
  IF q.answered_at IS NULL OR q.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Themen werden an aktiven Antworten vergeben.' USING ERRCODE = '22023';
  END IF;

  SELECT
    coalesce(s.is_enabled, true),
    coalesce(s.requirement, 'optional') = 'required',
    coalesce(s.max_topics, 5)
  INTO v_enabled, v_required, v_max
  FROM (SELECT 1) dummy
  LEFT JOIN public.topic_module_settings s
    ON s.tenant_id = q.tenant_id AND s.module = 'knowledge_questions';

  IF NOT v_enabled THEN
    RAISE EXCEPTION 'Themen sind für Wissensfragen deaktiviert.' USING ERRCODE = '22023';
  END IF;
  IF p_topic_ids IS NULL
     OR coalesce(array_ndims(p_topic_ids), 1) <> 1 THEN
    RAISE EXCEPTION 'Ungültige Themenauswahl.' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_topic_ids) > v_max THEN
    RAISE EXCEPTION 'Höchstens % Themen pro Frage.', v_max USING ERRCODE = '22023';
  END IF;
  IF v_required AND cardinality(p_topic_ids) = 0 THEN
    RAISE EXCEPTION 'Mindestens ein Thema ist erforderlich.' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_topic_ids) <>
     (SELECT count(DISTINCT id) FROM unnest(p_topic_ids) AS input(id)) THEN
    RAISE EXCEPTION 'Themen dürfen nicht doppelt vorkommen.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_topic_ids) AS input(id)
    LEFT JOIN public.topics t
      ON t.id = input.id AND t.tenant_id = q.tenant_id
    WHERE t.id IS NULL OR NOT t.is_active
  ) THEN
    RAISE EXCEPTION 'Ungültiges oder inaktives Thema.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(DISTINCT coalesce(t.merged_into, t.id) ORDER BY coalesce(t.merged_into, t.id)), '{}')
  INTO v_new
  FROM unnest(p_topic_ids) AS input(id)
  JOIN public.topics t ON t.id = input.id AND t.tenant_id = q.tenant_id;

  IF cardinality(v_new) <> cardinality(p_topic_ids) THEN
    RAISE EXCEPTION 'Themen verweisen auf dasselbe zusammengeführte Ziel.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(topic_id ORDER BY topic_id), '{}')
  INTO v_old
  FROM public.knowledge_question_topics
  WHERE question_id = q.id AND tenant_id = q.tenant_id;

  IF v_old IS NOT DISTINCT FROM v_new THEN
    RETURN;
  END IF;

  DELETE FROM public.knowledge_question_topics
  WHERE question_id = q.id AND tenant_id = q.tenant_id;

  INSERT INTO public.knowledge_question_topics (tenant_id, question_id, topic_id)
  SELECT q.tenant_id, q.id, input.topic_id
  FROM unnest(v_new) AS input(topic_id)
  ON CONFLICT DO NOTHING;

  SELECT string_agg(t.label, ' ' ORDER BY lower(t.label), t.id)
  INTO v_names
  FROM public.topics t
  WHERE t.id = ANY (v_new);

  UPDATE public.knowledge_questions
  SET tag_search_text = coalesce(v_names, ''),
      revision = revision + 1,
      metadata_revision = metadata_revision + 1,
      metadata_event = 'topics_changed',
      metadata_note = NULL,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = q.id;
END $$;

REVOKE ALL ON FUNCTION public.knowledge_qa_set_topics(uuid, integer, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_set_topics(uuid, integer, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.knowledge_qa_topic_counts(p_tenant uuid)
RETURNS TABLE(id uuid, name text, count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT t.id, t.label AS name, count(*)::bigint
  FROM public.knowledge_question_topics qt
  JOIN public.topics t
    ON t.id = qt.topic_id AND t.tenant_id = qt.tenant_id
  JOIN public.knowledge_questions q
    ON q.id = qt.question_id AND q.tenant_id = qt.tenant_id
  WHERE t.tenant_id = p_tenant AND q.archived_at IS NULL
  GROUP BY t.id, t.label
  ORDER BY count(*) DESC, lower(t.label), t.id
  LIMIT 6;
$$;

REVOKE ALL ON FUNCTION public.knowledge_qa_topic_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_topic_counts(uuid) TO authenticated;

-- Die Signatur bleibt kompatibel; p_tag trägt ab jetzt eine Themen-ID.
CREATE OR REPLACE FUNCTION public.knowledge_qa_list(
  p_tenant uuid,
  p_query text DEFAULT '',
  p_view text DEFAULT 'answers',
  p_limit integer DEFAULT 20,
  p_cursor jsonb DEFAULT NULL,
  p_status text DEFAULT '',
  p_assignee text DEFAULT '',
  p_sort text DEFAULT 'updated',
  p_tag text DEFAULT '',
  p_quick text DEFAULT ''
)
RETURNS TABLE(items jsonb, total_count bigint, next_cursor jsonb, counts jsonb, topics jsonb)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  term tsquery;
  expression text;
  normalized text := public.knowledge_qa_normalize(btrim(p_query));
  browsing boolean := btrim(coalesce(p_query, '')) = '';
  fuzzy boolean := false;
  predicate text;
  source text;
  ordering text;
  boundary text;
BEGIN
  IF p_view IS NULL OR p_view NOT IN ('answers', 'open', 'mine', 'assigned', 'review')
     OR length(coalesce(p_query, '')) > 300
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Ungültige Suchanfrage' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('', 'open', 'unverified', 'verified', 'needs_review')
     OR p_sort IS NULL OR p_sort NOT IN ('updated', 'oldest')
     OR p_assignee IS NULL
     OR (p_assignee NOT IN ('', 'unassigned')
         AND p_assignee !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'Ungültiger Filter' USING ERRCODE = '22023';
  END IF;
  IF p_quick IS NULL OR p_quick NOT IN ('', 'open', 'assigned', 'review')
     OR p_tag IS NULL
     OR (p_tag <> '' AND p_tag !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'Ungültiger Schnell- oder Themenfilter' USING ERRCODE = '22023';
  END IF;
  IF p_tag <> ''
     AND NOT EXISTS (
       SELECT 1 FROM public.topics
       WHERE id = p_tag::uuid AND tenant_id = p_tenant
     ) THEN
    RAISE EXCEPTION 'Ungültiger Themenfilter' USING ERRCODE = '22023';
  END IF;
  IF ((p_view = 'review' AND p_quick = '') OR p_quick = 'review')
     AND NOT public.knowledge_qa_can_access(p_tenant, 'knowledge.verify') THEN
    RAISE EXCEPTION 'Keine Prüfberechtigung' USING ERRCODE = '42501';
  END IF;
  IF p_cursor IS NOT NULL
     AND (jsonb_typeof(p_cursor) <> 'object'
          OR NOT p_cursor ?& ARRAY['id', 'updated_at', 'rank']) THEN
    RAISE EXCEPTION 'Ungültiger Cursor' USING ERRCODE = '22023';
  END IF;

  predicate := $filter$
    q.tenant_id = $1 AND q.archived_at IS NULL
    AND CASE WHEN $12 <> '' THEN true ELSE CASE $3
      WHEN 'answers' THEN q.answered_at IS NOT NULL
      WHEN 'open' THEN q.answered_at IS NULL
      WHEN 'assigned' THEN q.assigned_to = auth.uid()
      WHEN 'review' THEN q.answered_at IS NOT NULL
        AND (q.review_status = 'needs_review' OR q.review_due_at <= now())
      ELSE q.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM knowledge_question_events e
          WHERE e.tenant_id = $1 AND e.question_id = q.id
            AND e.actor_id = auth.uid() AND e.event_type = 'answer_changed'
        )
    END END
    AND ($9 = '' OR CASE WHEN $9 = 'open' THEN q.answered_at IS NULL
      ELSE q.answered_at IS NOT NULL
        AND CASE WHEN q.review_status = 'needs_review' OR q.review_due_at <= now()
          THEN 'needs_review' ELSE q.review_status END = $9 END)
    AND ($10 = '' OR CASE WHEN $10 = 'unassigned' THEN q.assigned_to IS NULL
      ELSE q.assigned_to = nullif(nullif($10, ''), 'unassigned')::uuid END)
    AND ($11 = '' OR EXISTS (
      SELECT 1 FROM knowledge_question_topics qt
      WHERE qt.question_id = q.id AND qt.tenant_id = q.tenant_id
        AND qt.topic_id = nullif($11, '')::uuid
    ))
    AND CASE $12
      WHEN 'open' THEN q.answered_at IS NULL
      WHEN 'assigned' THEN q.assigned_to = auth.uid()
      WHEN 'review' THEN q.answered_at IS NOT NULL
        AND (q.review_status = 'needs_review' OR q.review_due_at <= now())
      ELSE true END
  $filter$;

  IF browsing THEN
    source := 'SELECT q.id,q.updated_at,0::double precision AS rank FROM knowledge_questions q WHERE ' || predicate;
    ordering := CASE WHEN p_sort = 'oldest' THEN 'updated_at ASC,id' ELSE 'updated_at DESC,id' END;
    boundary := 'updated_at' || CASE WHEN p_sort = 'oldest' THEN '>' ELSE '<' END
      || '($5->>''updated_at'')::timestamptz OR (updated_at=($5->>''updated_at'')::timestamptz AND id>($5->>''id'')::uuid)';
  ELSE
    SELECT string_agg(quote_literal(word) || ':*', ' & ')
    INTO expression
    FROM unnest(tsvector_to_array(to_tsvector('german', normalized))) word;
    term := CASE WHEN expression IS NOT NULL
      THEN to_tsquery('german', expression)
      ELSE plainto_tsquery('german', normalized) END;
    EXECUTE 'SELECT NOT EXISTS(SELECT 1 FROM knowledge_questions q WHERE ' || predicate || ' AND q.search_vector @@ $2)'
      INTO fuzzy
      USING p_tenant, term, p_view, p_limit, p_cursor, normalized, browsing, fuzzy, p_status, p_assignee, p_tag, p_quick;
    IF fuzzy THEN
      source := 'SELECT q.id,q.updated_at,greatest(similarity(knowledge_qa_normalize(q.title),$6),word_similarity($6,knowledge_qa_normalize(q.title)))::double precision AS rank FROM knowledge_questions q WHERE ' || predicate || ' AND word_similarity($6,knowledge_qa_normalize(q.title)) >= 0.35';
    ELSE
      source := 'SELECT q.id,q.updated_at,(CASE WHEN q.title_search_vector @@ $2 THEN 1 ELSE 0 END + ts_rank_cd(q.search_vector,$2,32))::double precision AS rank FROM knowledge_questions q WHERE ' || predicate || ' AND q.search_vector @@ $2';
    END IF;
    ordering := 'rank DESC,id';
    boundary := 'rank<($5->>''rank'')::double precision OR (rank=($5->>''rank'')::double precision AND id>($5->>''id'')::uuid)';
  END IF;

  RETURN QUERY EXECUTE format($sql$
    WITH matches AS NOT MATERIALIZED (%s), candidates AS (
      SELECT * FROM matches WHERE $5 IS NULL OR (%s) ORDER BY %s LIMIT $4+1
    ), numbered AS (
      SELECT *,row_number() OVER (ORDER BY %s) AS n FROM candidates
    ), page AS (
      SELECT s.*,n.n,n.rank FROM numbered n JOIN knowledge_question_summaries s ON s.id=n.id WHERE n.n<=$4
    )
    SELECT coalesce(jsonb_agg(
      (to_jsonb(page)-'n'-'rank') || jsonb_build_object(
        'answer_excerpt',
        CASE WHEN $7 OR $8 THEN page.answer_excerpt
          ELSE left(ts_headline('german',q.answer_text,$2,'StartSel=,StopSel=,MaxWords=35,MinWords=15,MaxFragments=1'),220) END,
        'topics',
        (SELECT coalesce(jsonb_agg(jsonb_build_object('id',topic.id,'name',topic.label) ORDER BY lower(topic.label),topic.id),'[]'::jsonb)
         FROM knowledge_question_topics qt
         JOIN topics topic ON topic.id=qt.topic_id AND topic.tenant_id=qt.tenant_id
         WHERE qt.question_id=page.id AND qt.tenant_id=page.tenant_id)
      ) ORDER BY n),'[]'),
    (SELECT count(*) FROM matches),
    CASE WHEN (SELECT count(*) FROM numbered)>$4 THEN
      (SELECT jsonb_build_object('id',p.id,'updated_at',p.updated_at,'rank',p.rank) FROM page p ORDER BY p.n DESC LIMIT 1)
    END,
    (SELECT to_jsonb(c) FROM knowledge_qa_counts($1) c),
    (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM knowledge_qa_topic_counts($1) t)
    FROM page JOIN knowledge_questions q ON q.id=page.id
  $sql$, source, boundary, ordering, ordering)
  USING p_tenant, term, p_view, p_limit, p_cursor, normalized, browsing, fuzzy, p_status, p_assignee, p_tag, p_quick;
END $$;

REVOKE ALL ON FUNCTION public.knowledge_qa_list(uuid, text, text, integer, jsonb, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_list(uuid, text, text, integer, jsonb, text, text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
