-- Canonical tenant tags with relational assignment; writes only through checked RPCs.
CREATE TABLE IF NOT EXISTS public.knowledge_tags(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 name text NOT NULL CHECK(name=btrim(name) AND length(name) BETWEEN 2 AND 30 AND name !~ '[[:cntrl:]]'),UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_tags_name ON public.knowledge_tags(tenant_id,lower(name));
CREATE TABLE IF NOT EXISTS public.knowledge_question_tags(
 tenant_id uuid NOT NULL,question_id uuid NOT NULL,tag_id uuid NOT NULL,
 PRIMARY KEY(question_id,tag_id),
 FOREIGN KEY(tenant_id,question_id) REFERENCES knowledge_questions(tenant_id,id),
 FOREIGN KEY(tenant_id,tag_id) REFERENCES knowledge_tags(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS knowledge_question_tags_tag ON public.knowledge_question_tags(tenant_id,tag_id,question_id);
ALTER TABLE public.knowledge_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_question_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_tags_read ON public.knowledge_tags;
CREATE POLICY knowledge_tags_read ON public.knowledge_tags FOR SELECT TO authenticated USING(knowledge_qa_can_access(tenant_id));
DROP POLICY IF EXISTS knowledge_question_tags_read ON public.knowledge_question_tags;
CREATE POLICY knowledge_question_tags_read ON public.knowledge_question_tags FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM knowledge_questions q WHERE q.id=question_id AND q.tenant_id=knowledge_question_tags.tenant_id));
REVOKE ALL ON public.knowledge_tags,public.knowledge_question_tags FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.knowledge_tags,public.knowledge_question_tags TO authenticated;
ALTER TABLE public.knowledge_questions ADD COLUMN IF NOT EXISTS tag_search_text text NOT NULL DEFAULT '';
ALTER TABLE public.knowledge_questions ADD COLUMN IF NOT EXISTS metadata_revision integer NOT NULL DEFAULT 0;
ALTER TABLE public.knowledge_questions ADD COLUMN IF NOT EXISTS metadata_event text;
ALTER TABLE public.knowledge_questions ADD COLUMN IF NOT EXISTS metadata_note text;
-- A stored vector maintained on writes can include relational tags without a
-- subquery in a generated expression. Existing vectors already match empty tags.
ALTER TABLE public.knowledge_questions ALTER COLUMN search_vector DROP EXPRESSION IF EXISTS;
CREATE OR REPLACE FUNCTION public.knowledge_qa_update_search() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 NEW.search_vector:=setweight(to_tsvector('german',knowledge_qa_normalize(NEW.title)),'A') ||
 setweight(to_tsvector('german',knowledge_qa_normalize(NEW.description||' '||NEW.tag_search_text)),'B') ||
 setweight(to_tsvector('german',knowledge_qa_normalize(NEW.answer_text)),'C'); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_update_search() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS knowledge_qa_search_update ON public.knowledge_questions;
CREATE TRIGGER knowledge_qa_search_update BEFORE INSERT OR UPDATE ON public.knowledge_questions FOR EACH ROW EXECUTE FUNCTION public.knowledge_qa_update_search();
CREATE OR REPLACE FUNCTION public.knowledge_qa_refresh_tags(p_question uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE names text;
BEGIN
 SELECT coalesce(string_agg(t.name,' ' ORDER BY lower(t.name),t.id),'') INTO names FROM knowledge_question_tags qt JOIN knowledge_tags t ON t.id=qt.tag_id AND t.tenant_id=qt.tenant_id WHERE qt.question_id=p_question;
 UPDATE knowledge_questions SET tag_search_text=names,revision=revision+1,metadata_revision=metadata_revision+1,metadata_event='tags_changed',metadata_note=NULL,updated_at=now(),updated_by=auth.uid()
 WHERE id=p_question AND tag_search_text IS DISTINCT FROM names;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_refresh_tags(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.knowledge_qa_set_tags(p_question uuid,p_expected_revision integer,p_names text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; tag_name text; tag uuid; selected uuid[]:='{}';
BEGIN
 SELECT * INTO q FROM knowledge_questions WHERE id=p_question FOR UPDATE;
 IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
 IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Frage wurde inzwischen geändert.' USING ERRCODE='40001'; END IF;
 IF q.answered_at IS NULL OR q.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Tags werden an aktiven Antworten vergeben.' USING ERRCODE='22023'; END IF;
 IF p_names IS NULL OR cardinality(p_names)>5 OR coalesce(array_ndims(p_names),1)<>1 THEN RAISE EXCEPTION 'Höchstens fünf Tags pro Frage.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_names) n WHERE n IS NULL OR length(btrim(n)) NOT BETWEEN 2 AND 30) OR
 (SELECT count(DISTINCT lower(btrim(n))) FROM unnest(p_names) n)<>cardinality(p_names) THEN RAISE EXCEPTION 'Tags müssen eindeutig und 2–30 Zeichen lang sein.' USING ERRCODE='22023'; END IF;
 FOREACH tag_name IN ARRAY p_names LOOP
  INSERT INTO knowledge_tags(tenant_id,name) VALUES(q.tenant_id,btrim(tag_name)) ON CONFLICT(tenant_id,lower(name)) DO UPDATE SET name=knowledge_tags.name RETURNING id INTO tag;
  selected:=array_append(selected,tag);
 END LOOP;
 DELETE FROM knowledge_question_tags WHERE question_id=q.id AND NOT(tag_id=ANY(selected));
 INSERT INTO knowledge_question_tags(tenant_id,question_id,tag_id) SELECT q.tenant_id,q.id,unnest(selected) ON CONFLICT DO NOTHING;
 PERFORM knowledge_qa_refresh_tags(q.id);
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_set_tags(uuid,integer,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_set_tags(uuid,integer,text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.knowledge_qa_manage_tag(p_tag uuid,p_name text DEFAULT NULL,p_merge_into uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE source knowledge_tags; target knowledge_tags; affected uuid[]; question uuid;
BEGIN
 PERFORM 1 FROM knowledge_tags WHERE id=p_tag OR id=p_merge_into ORDER BY id FOR UPDATE;
 SELECT * INTO source FROM knowledge_tags WHERE id=p_tag;
 IF NOT FOUND OR NOT knowledge_qa_can_access(source.tenant_id,'knowledge.manage') THEN RAISE EXCEPTION 'Keine Pflegeberechtigung' USING ERRCODE='42501'; END IF;
 SELECT array_agg(q.id ORDER BY q.id) INTO affected FROM knowledge_questions q WHERE EXISTS(SELECT 1 FROM knowledge_question_tags qt WHERE qt.question_id=q.id AND qt.tag_id=p_tag);
 PERFORM 1 FROM knowledge_questions WHERE id=ANY(coalesce(affected,'{}')) ORDER BY id FOR UPDATE;
 IF p_merge_into IS NOT NULL THEN
  SELECT * INTO target FROM knowledge_tags WHERE id=p_merge_into AND tenant_id=source.tenant_id AND id<>source.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ungültiger Ziel-Tag' USING ERRCODE='22023'; END IF;
  INSERT INTO knowledge_question_tags(tenant_id,question_id,tag_id) SELECT source.tenant_id,question_id,target.id FROM knowledge_question_tags WHERE tag_id=source.id ON CONFLICT DO NOTHING;
  DELETE FROM knowledge_tags WHERE id=source.id;
 ELSE
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 30 THEN RAISE EXCEPTION 'Tagname muss 2–30 Zeichen lang sein.' USING ERRCODE='22023'; END IF;
  UPDATE knowledge_tags SET name=btrim(p_name) WHERE id=source.id;
 END IF;
 FOREACH question IN ARRAY coalesce(affected,'{}') LOOP PERFORM knowledge_qa_refresh_tags(question); END LOOP;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Dieser Tagname existiert bereits.' USING ERRCODE='22023';
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_manage_tag(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_manage_tag(uuid,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.knowledge_qa_guard_archived() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.archived_at IS NOT NULL AND NOT (
 NEW.metadata_event='tags_changed' AND NEW.metadata_revision=OLD.metadata_revision+1 AND knowledge_qa_can_access(OLD.tenant_id,'knowledge.manage') AND
 (to_jsonb(NEW)-ARRAY['tag_search_text','search_vector','title_search_vector','revision','metadata_revision','metadata_event','metadata_note','updated_at','updated_by']) IS NOT DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['tag_search_text','search_vector','title_search_vector','revision','metadata_revision','metadata_event','metadata_note','updated_at','updated_by'])
 ) THEN RAISE EXCEPTION 'Geschlossene Fragen können nicht geändert werden' USING ERRCODE='22023'; END IF; RETURN NEW;
END $$;
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
    (to_jsonb(NEW)-'search_vector'-'title_search_vector'-'tag_search_text') || jsonb_build_object('attachments',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'file_size',a.file_size)), '[]'::jsonb)
       FROM knowledge_question_attachments a WHERE a.question_id=NEW.id AND a.state='ready')));
  RETURN NEW;
END $$;
CREATE OR REPLACE VIEW public.knowledge_question_summaries WITH (security_invoker=true) AS
SELECT q.id,q.tenant_id,q.title,left(q.description,300) AS description,
 left(q.answer_text,200) AS answer_excerpt,q.answered_at,q.review_status,
 CASE WHEN q.review_status='needs_review' OR q.review_due_at<=now() THEN 'needs_review' ELSE q.review_status END AS effective_review_status,
 q.review_due_at,q.assigned_to,q.created_by,q.created_at,q.updated_at,q.answer_updated_at,q.revision,now() AS server_now,
 jsonb_build_object('user_id',q.created_by,'display_name',creator.display_name,'avatar_url',creator.avatar_url) AS created_by_person,
 CASE WHEN q.assigned_to IS NOT NULL THEN jsonb_build_object('user_id',q.assigned_to,'display_name',assignee.display_name,'avatar_url',assignee.avatar_url) END AS assigned_to_person,
 CASE WHEN q.verified_by IS NOT NULL THEN jsonb_build_object('user_id',q.verified_by,'display_name',verifier.display_name,'avatar_url',verifier.avatar_url) END AS verified_by_person,
 q.verified_at,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) ORDER BY lower(t.name),t.id),'[]'::jsonb) FROM public.knowledge_question_tags qt JOIN public.knowledge_tags t ON t.id=qt.tag_id AND t.tenant_id=qt.tenant_id WHERE qt.question_id=q.id) AS tags
FROM public.knowledge_questions q
LEFT JOIN public.profiles creator ON creator.user_id=q.created_by AND creator.tenant_id=q.tenant_id
LEFT JOIN public.profiles assignee ON assignee.user_id=q.assigned_to AND assignee.tenant_id=q.tenant_id
LEFT JOIN public.profiles verifier ON verifier.user_id=q.verified_by AND verifier.tenant_id=q.tenant_id;

-- Preserve view-column order, including installations with rebuilt vectors.
DO $$ DECLARE columns text; BEGIN
 SELECT string_agg(CASE attname
  WHEN 'effective_review_status' THEN 'CASE WHEN q.review_status=''needs_review'' OR q.review_due_at<=now() THEN ''needs_review'' ELSE q.review_status END'
  WHEN 'server_now' THEN 'now()'
  ELSE 'q.'||quote_ident(attname) END || ' AS ' ||quote_ident(attname),',' ORDER BY attnum)
 INTO columns FROM pg_attribute
 WHERE attrelid='public.knowledge_question_cards'::regclass AND attnum>0 AND NOT attisdropped
 AND attname NOT IN ('created_by_person','assigned_to_person','verified_by_person','tags');
 EXECUTE 'CREATE OR REPLACE VIEW public.knowledge_question_cards WITH (security_invoker=true) AS SELECT '||columns||
 ',jsonb_build_object(''user_id'',q.created_by,''display_name'',creator.display_name,''avatar_url'',creator.avatar_url) AS created_by_person,
 CASE WHEN q.assigned_to IS NOT NULL THEN jsonb_build_object(''user_id'',q.assigned_to,''display_name'',assignee.display_name,''avatar_url'',assignee.avatar_url) END AS assigned_to_person,
 CASE WHEN q.verified_by IS NOT NULL THEN jsonb_build_object(''user_id'',q.verified_by,''display_name'',verifier.display_name,''avatar_url'',verifier.avatar_url) END AS verified_by_person,
 (SELECT coalesce(jsonb_agg(jsonb_build_object(''id'',t.id,''name'',t.name) ORDER BY lower(t.name),t.id),''[]''::jsonb) FROM public.knowledge_question_tags qt JOIN public.knowledge_tags t ON t.id=qt.tag_id AND t.tenant_id=qt.tenant_id WHERE qt.question_id=q.id) AS tags
 FROM public.knowledge_questions q
 LEFT JOIN public.profiles creator ON creator.user_id=q.created_by AND creator.tenant_id=q.tenant_id
 LEFT JOIN public.profiles assignee ON assignee.user_id=q.assigned_to AND assignee.tenant_id=q.tenant_id
 LEFT JOIN public.profiles verifier ON verifier.user_id=q.verified_by AND verifier.tenant_id=q.tenant_id';
END $$;

CREATE OR REPLACE FUNCTION public.knowledge_qa_tag_topics(p_tenant uuid)
RETURNS TABLE(id uuid,name text,count bigint) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT t.id,t.name,count(*) FROM knowledge_tags t JOIN knowledge_question_tags qt ON qt.tag_id=t.id AND qt.tenant_id=t.tenant_id
 JOIN knowledge_questions q ON q.id=qt.question_id AND q.tenant_id=t.tenant_id
 WHERE t.tenant_id=p_tenant AND q.archived_at IS NULL GROUP BY t.id,t.name ORDER BY count(*) DESC,lower(t.name),t.id LIMIT 6;
$$;
REVOKE ALL ON FUNCTION public.knowledge_qa_tag_topics(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_tag_topics(uuid) TO authenticated;
DROP FUNCTION IF EXISTS public.knowledge_qa_list(uuid,text,text,integer,jsonb,text,text,text);
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
 IF (p_view='review' OR p_quick='review') AND NOT knowledge_qa_can_access(p_tenant,'knowledge.verify') THEN
 RAISE EXCEPTION 'Keine Prüfberechtigung' USING ERRCODE='42501'; END IF;
 IF p_cursor IS NOT NULL AND (jsonb_typeof(p_cursor)<>'object' OR NOT p_cursor ?& ARRAY['id','updated_at','rank']) THEN
 RAISE EXCEPTION 'Ungültiger Cursor' USING ERRCODE='22023'; END IF;
 predicate:=$filter$ q.tenant_id=$1 AND q.archived_at IS NULL AND CASE $3 WHEN 'answers' THEN q.answered_at IS NOT NULL WHEN 'open' THEN q.answered_at IS NULL
 WHEN 'assigned' THEN q.assigned_to=auth.uid()
 WHEN 'review' THEN q.answered_at IS NOT NULL AND (q.review_status='needs_review' OR q.review_due_at<=now())
 ELSE q.created_by=auth.uid() OR EXISTS(SELECT 1 FROM knowledge_question_events e WHERE e.tenant_id=$1 AND e.question_id=q.id AND e.actor_id=auth.uid() AND e.event_type='answer_changed') END
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


