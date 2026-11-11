-- Add only presentation metadata to existing bounded, invoker-RLS read paths.
-- Profiles are joined within the question's tenant; missing/hidden profiles do
-- not hide questions or expose data from another office. Existing RPCs serialize
-- summary columns, so no answer payload or extra per-card request is added.
CREATE OR REPLACE VIEW public.knowledge_question_summaries WITH (security_invoker=true) AS
SELECT q.id,q.tenant_id,q.title,left(q.description,300) AS description,
 left(q.answer_text,200) AS answer_excerpt,q.answered_at,q.review_status,
 CASE WHEN q.review_status='needs_review' OR q.review_due_at<=now() THEN 'needs_review' ELSE q.review_status END AS effective_review_status,
 q.review_due_at,q.assigned_to,q.created_by,q.created_at,q.updated_at,q.answer_updated_at,q.revision,now() AS server_now,
 jsonb_build_object('user_id',q.created_by,'display_name',creator.display_name,'avatar_url',creator.avatar_url) AS created_by_person,
 CASE WHEN q.assigned_to IS NOT NULL THEN jsonb_build_object('user_id',q.assigned_to,'display_name',assignee.display_name,'avatar_url',assignee.avatar_url) END AS assigned_to_person,
 CASE WHEN q.verified_by IS NOT NULL THEN jsonb_build_object('user_id',q.verified_by,'display_name',verifier.display_name,'avatar_url',verifier.avatar_url) END AS verified_by_person,
 q.verified_at
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
 AND attname NOT IN ('created_by_person','assigned_to_person','verified_by_person');
 EXECUTE 'CREATE OR REPLACE VIEW public.knowledge_question_cards WITH (security_invoker=true) AS SELECT '||columns||
 ',jsonb_build_object(''user_id'',q.created_by,''display_name'',creator.display_name,''avatar_url'',creator.avatar_url) AS created_by_person,
 CASE WHEN q.assigned_to IS NOT NULL THEN jsonb_build_object(''user_id'',q.assigned_to,''display_name'',assignee.display_name,''avatar_url'',assignee.avatar_url) END AS assigned_to_person,
 CASE WHEN q.verified_by IS NOT NULL THEN jsonb_build_object(''user_id'',q.verified_by,''display_name'',verifier.display_name,''avatar_url'',verifier.avatar_url) END AS verified_by_person
 FROM public.knowledge_questions q
 LEFT JOIN public.profiles creator ON creator.user_id=q.created_by AND creator.tenant_id=q.tenant_id
 LEFT JOIN public.profiles assignee ON assignee.user_id=q.assigned_to AND assignee.tenant_id=q.tenant_id
 LEFT JOIN public.profiles verifier ON verifier.user_id=q.verified_by AND verifier.tenant_id=q.tenant_id';
END $$;
