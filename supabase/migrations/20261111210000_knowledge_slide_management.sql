-- Step 15: reversible archives and atomic, revision-checked duplicate merging.
-- No existing migration is rewritten. The added source enum value is not used
-- as an enum literal in this transaction; it becomes available after commit.
ALTER TYPE public.knowledge_source_kind ADD VALUE IF NOT EXISTS 'other';
ALTER TABLE public.knowledge_questions ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.knowledge_questions ADD COLUMN IF NOT EXISTS archived_by uuid;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='knowledge_archive_reason') THEN
 ALTER TABLE public.knowledge_questions ADD CONSTRAINT knowledge_archive_reason CHECK(archive_reason IS NULL OR archive_reason IN ('completed','obsolete','duplicate','other')); END IF;
END $$;
DROP FUNCTION IF EXISTS public.knowledge_qa_manage(uuid,integer,text,text,text,uuid,integer);
CREATE OR REPLACE FUNCTION public.knowledge_qa_manage(p_question uuid,p_expected_revision integer,p_action text,p_title text DEFAULT NULL,p_description text DEFAULT NULL,p_target uuid DEFAULT NULL,p_target_revision integer DEFAULT NULL,p_reason text DEFAULT NULL)
RETURNS public.knowledge_questions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; target knowledge_questions; office uuid; tag_count integer;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('edit','archive','merge','restore') THEN RAISE EXCEPTION 'Ungültige Pflegeaktion' USING ERRCODE='22023'; END IF;
 SELECT tenant_id INTO office FROM knowledge_questions WHERE id=p_question;
 IF NOT FOUND OR NOT knowledge_qa_can_access(office,'knowledge.manage') THEN RAISE EXCEPTION 'Keine Pflegeberechtigung' USING ERRCODE='42501'; END IF;
 -- Tag changes and tag administration take this same tenant lock before parent
 -- locks, preventing lock-order inversions while merging assignments.
 IF p_action='merge' THEN PERFORM pg_advisory_xact_lock(hashtextextended('knowledge-tags:'||office::text,0)); END IF;
 PERFORM 1 FROM knowledge_questions WHERE tenant_id=office AND (id=p_question OR (p_action='merge' AND id=p_target)) ORDER BY id FOR UPDATE;
 SELECT * INTO q FROM knowledge_questions WHERE id=p_question AND tenant_id=office;
 IF q.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Die Frage wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
 IF p_action='restore' THEN
  IF q.archived_at IS NULL THEN RAISE EXCEPTION 'Die Frage ist nicht archiviert.' USING ERRCODE='22023'; END IF;
  UPDATE knowledge_questions SET archived_at=NULL,archive_reason=NULL,archived_by=NULL,merged_into=NULL,revision=revision+1,
   metadata_revision=metadata_revision+1,metadata_event='question_restored',metadata_note=NULL,updated_at=now(),updated_by=auth.uid() WHERE id=q.id RETURNING * INTO q;
  RETURN q;
 END IF;
 IF q.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Bitte die Frage zunächst wiederherstellen.' USING ERRCODE='22023'; END IF;
 IF p_action='edit' THEN
  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 300 OR p_description IS NULL OR length(p_description)>10000 THEN RAISE EXCEPTION 'Ungültiger Titel oder Beschreibung' USING ERRCODE='22023'; END IF;
  IF q.title=btrim(p_title) AND q.description=p_description THEN RETURN q; END IF;
  UPDATE knowledge_questions SET title=btrim(p_title),description=p_description,revision=revision+1,updated_at=now(),updated_by=auth.uid() WHERE id=q.id RETURNING * INTO q;
 ELSE
  IF p_action='merge' THEN
   SELECT * INTO target FROM knowledge_questions WHERE id=p_target AND tenant_id=office;
   IF NOT FOUND OR target.id=q.id OR target.archived_at IS NOT NULL OR target.merged_into IS NOT NULL THEN RAISE EXCEPTION 'Ungültige Zielfrage' USING ERRCODE='22023'; END IF;
   IF target.revision IS DISTINCT FROM p_target_revision THEN RAISE EXCEPTION 'Die Zielfrage wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
   SELECT count(DISTINCT tag_id) INTO tag_count FROM knowledge_question_tags WHERE question_id IN (q.id,target.id);
   IF tag_count>5 THEN RAISE EXCEPTION 'Die Vereinigung enthält mehr als fünf Themen. Bitte Themen vorher reduzieren.' USING ERRCODE='22023'; END IF;
   INSERT INTO knowledge_question_tags(tenant_id,question_id,tag_id) SELECT office,target.id,tag_id FROM knowledge_question_tags WHERE question_id=q.id ON CONFLICT DO NOTHING;
   PERFORM knowledge_qa_refresh_tags(target.id);
  ELSIF coalesce(p_reason,'completed') NOT IN ('completed','obsolete','duplicate','other') THEN
   RAISE EXCEPTION 'Bitte einen gültigen Archivierungsgrund wählen.' USING ERRCODE='22023';
  END IF;
  UPDATE knowledge_questions SET archived_at=now(),archive_reason=CASE WHEN p_action='merge' THEN 'duplicate' ELSE coalesce(p_reason,'completed') END,
   archived_by=auth.uid(),merged_into=CASE WHEN p_action='merge' THEN target.id END,revision=revision+1,
   metadata_revision=metadata_revision+1,metadata_event=CASE WHEN p_action='merge' THEN 'question_merged' ELSE 'question_archived' END,
   metadata_note=NULL,updated_at=now(),updated_by=auth.uid() WHERE id=q.id RETURNING * INTO q;
 END IF;
 RETURN q;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_manage(uuid,integer,text,text,text,uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_manage(uuid,integer,text,text,text,uuid,integer,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.knowledge_qa_guard_archived() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.archived_at IS NOT NULL AND NOT coalesce((
  knowledge_qa_can_access(OLD.tenant_id,'knowledge.manage') AND NEW.metadata_revision=OLD.metadata_revision+1 AND (
   (NEW.metadata_event='question_restored' AND NEW.archived_at IS NULL AND NEW.archive_reason IS NULL AND NEW.archived_by IS NULL AND NEW.merged_into IS NULL AND
    (to_jsonb(NEW)-ARRAY['archived_at','archive_reason','archived_by','merged_into','search_vector','title_search_vector','revision','metadata_revision','metadata_event','metadata_note','updated_at','updated_by']) IS NOT DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['archived_at','archive_reason','archived_by','merged_into','search_vector','title_search_vector','revision','metadata_revision','metadata_event','metadata_note','updated_at','updated_by'])) OR
   (NEW.metadata_event='tags_changed' AND
    (to_jsonb(NEW)-ARRAY['tag_search_text','search_vector','title_search_vector','revision','metadata_revision','metadata_event','metadata_note','updated_at','updated_by']) IS NOT DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['tag_search_text','search_vector','title_search_vector','revision','metadata_revision','metadata_event','metadata_note','updated_at','updated_by']))
  )
 ),false) THEN RAISE EXCEPTION 'Geschlossene Fragen können nicht geändert werden' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;

-- Append archive metadata without disturbing existing view column order/RLS.
DO $$ DECLARE columns text; BEGIN
 SELECT string_agg(CASE attname
 WHEN 'effective_review_status' THEN 'CASE WHEN q.review_status=''needs_review'' OR q.review_due_at<=now() THEN ''needs_review'' ELSE q.review_status END'
 WHEN 'server_now' THEN 'now()'
 WHEN 'created_by_person' THEN 'jsonb_build_object(''user_id'',q.created_by,''display_name'',creator.display_name,''avatar_url'',creator.avatar_url)'
 WHEN 'assigned_to_person' THEN 'CASE WHEN q.assigned_to IS NOT NULL THEN jsonb_build_object(''user_id'',q.assigned_to,''display_name'',assignee.display_name,''avatar_url'',assignee.avatar_url) END'
 WHEN 'verified_by_person' THEN 'CASE WHEN q.verified_by IS NOT NULL THEN jsonb_build_object(''user_id'',q.verified_by,''display_name'',verifier.display_name,''avatar_url'',verifier.avatar_url) END'
 WHEN 'tags' THEN '(SELECT coalesce(jsonb_agg(jsonb_build_object(''id'',t.id,''name'',t.name) ORDER BY lower(t.name),t.id),''[]''::jsonb) FROM knowledge_question_tags qt JOIN knowledge_tags t ON t.id=qt.tag_id AND t.tenant_id=qt.tenant_id WHERE qt.question_id=q.id)'
 ELSE 'q.'||quote_ident(attname) END || ' AS '||quote_ident(attname),',' ORDER BY attnum)
 INTO columns FROM pg_attribute WHERE attrelid='public.knowledge_question_cards'::regclass AND attnum>0 AND NOT attisdropped AND attname NOT IN ('archive_reason','archived_by');
 EXECUTE 'CREATE OR REPLACE VIEW public.knowledge_question_cards WITH(security_invoker=true) AS SELECT '||columns||',q.archive_reason,q.archived_by FROM knowledge_questions q
 LEFT JOIN profiles creator ON creator.user_id=q.created_by AND creator.tenant_id=q.tenant_id
 LEFT JOIN profiles assignee ON assignee.user_id=q.assigned_to AND assignee.tenant_id=q.tenant_id
 LEFT JOIN profiles verifier ON verifier.user_id=q.verified_by AND verifier.tenant_id=q.tenant_id';
END $$;
CREATE OR REPLACE FUNCTION public.knowledge_qa_set_tags(p_question uuid,p_expected_revision integer,p_names text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q knowledge_questions; tag_name text; tag uuid; selected uuid[]:='{}';
BEGIN
 SELECT * INTO q FROM knowledge_questions WHERE id=p_question;
 IF NOT FOUND OR NOT knowledge_qa_can_access(q.tenant_id,'knowledge.write') THEN RAISE EXCEPTION 'Keine Schreibberechtigung' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('knowledge-tags:'||q.tenant_id::text,0));
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
 SELECT * INTO source FROM knowledge_tags WHERE id=p_tag;
 IF NOT FOUND OR NOT knowledge_qa_can_access(source.tenant_id,'knowledge.manage') THEN RAISE EXCEPTION 'Keine Pflegeberechtigung' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('knowledge-tags:'||source.tenant_id::text,0));
 PERFORM 1 FROM knowledge_tags WHERE tenant_id=source.tenant_id AND (id=p_tag OR id=p_merge_into) ORDER BY id FOR UPDATE;
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

-- Search canonical knowledge tags and existing platform topics in one bounded,
-- invoker-RLS query. The count is exact before the eight-item display limit.
CREATE OR REPLACE FUNCTION public.knowledge_qa_tag_suggestions(p_tenant uuid,p_query text DEFAULT '',p_exclude_names text[] DEFAULT '{}')
RETURNS TABLE(items jsonb,total_count bigint,exact_match boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT knowledge_qa_can_access(p_tenant) THEN RAISE EXCEPTION 'Keine Leseberechtigung' USING ERRCODE='42501'; END IF;
 IF p_query IS NULL OR length(p_query)>30 OR p_exclude_names IS NULL OR cardinality(p_exclude_names)>5 THEN RAISE EXCEPTION 'Ungültige Themenabfrage' USING ERRCODE='22023'; END IF;
 RETURN QUERY WITH available AS (
  SELECT k.id,k.name,0 AS priority FROM knowledge_tags k WHERE k.tenant_id=p_tenant
  UNION ALL SELECT t.id,t.label,1 FROM topics t WHERE t.tenant_id=p_tenant AND t.is_active AND length(btrim(t.label)) BETWEEN 2 AND 30
 ), canonical AS (
  SELECT DISTINCT ON(lower(a.name)) a.id,a.name FROM available a
  WHERE NOT EXISTS(SELECT 1 FROM unnest(p_exclude_names) n WHERE lower(btrim(n))=lower(a.name))
  ORDER BY lower(a.name),a.priority,a.id
 ), matches AS (
  SELECT c.* FROM canonical c WHERE position(lower(btrim(p_query)) IN lower(c.name))>0
 ), page AS (
  SELECT m.* FROM matches m ORDER BY (lower(m.name)=lower(btrim(p_query))) DESC,lower(m.name),m.id LIMIT 8
 )
 SELECT coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY (lower(p.name)=lower(btrim(p_query))) DESC,lower(p.name),p.id) FROM page p),'[]'::jsonb),
 (SELECT count(*) FROM matches),(SELECT EXISTS(SELECT 1 FROM canonical c WHERE lower(c.name)=lower(btrim(p_query))));
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_tag_suggestions(uuid,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.knowledge_qa_tag_suggestions(uuid,text,text[]) TO authenticated;
NOTIFY pgrst, 'reload schema';
