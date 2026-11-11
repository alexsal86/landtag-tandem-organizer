-- Membership roles are text; action_permissions.allowed_roles is app_role[].
-- PostgreSQL resolves every UNION branch, including the outdated-report branch,
-- when a review request dispatches notifications. Compare text to text rather
-- than text to app_role so the entire review transaction can complete.
CREATE OR REPLACE FUNCTION public.knowledge_qa_notify_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE previous jsonb; target uuid; recipient uuid; type_name text; suffix text; allowed app_role[];
BEGIN
 SELECT snapshot INTO previous FROM knowledge_question_events WHERE question_id=NEW.question_id AND revision=NEW.revision-1;
 target:=(NEW.snapshot->>'assigned_to')::uuid;
 IF target IS NOT NULL AND target IS DISTINCT FROM (previous->>'assigned_to')::uuid THEN
 PERFORM knowledge_qa_notify(NEW.tenant_id,target,'knowledge_qa_assigned',NEW.id::text||':assigned',NEW.question_id,NEW.snapshot->>'title'); END IF;
 IF NEW.event_type='comment_added' THEN
 FOR recipient IN SELECT DISTINCT id FROM unnest(ARRAY[target,(NEW.snapshot->>'created_by')::uuid]) id WHERE id IS NOT NULL LOOP
 PERFORM knowledge_qa_notify(NEW.tenant_id,recipient,'knowledge_qa_comment',NEW.id::text||':comment',NEW.question_id,NEW.snapshot->>'title'); END LOOP;
 ELSIF NEW.event_type='answer_changed' OR NEW.event_type IN ('verified','review_requested','outdated_reported') OR (previous IS NOT NULL AND NEW.snapshot->>'review_status' IS DISTINCT FROM previous->>'review_status') THEN
 type_name:=CASE WHEN NEW.event_type='answer_changed' THEN 'knowledge_qa_answered' ELSE 'knowledge_qa_review_requested' END;
 suffix:=CASE WHEN NEW.event_type='answer_changed' THEN ':answered' ELSE ':review' END;
 SELECT allowed_roles INTO allowed FROM action_permissions WHERE tenant_id=NEW.tenant_id AND action_key='knowledge.verify';
 FOR recipient IN
 SELECT user_id FROM knowledge_question_followers WHERE question_id=NEW.question_id
 UNION SELECT (NEW.snapshot->>'created_by')::uuid WHERE NEW.event_type='answer_changed' AND previous->>'answered_at' IS NULL
 UNION SELECT target WHERE NEW.event_type<>'answer_changed' AND target IS NOT NULL
 UNION SELECT auth.uid() WHERE NEW.event_type IN ('answer_changed','verified')
 UNION SELECT m.user_id FROM user_tenant_memberships m WHERE NEW.event_type='outdated_reported' AND m.tenant_id=NEW.tenant_id AND m.is_active AND (allowed IS NULL OR m.role=ANY(allowed::text[]) OR is_superadmin(m.user_id))
 LOOP
 PERFORM knowledge_qa_notify(NEW.tenant_id,recipient,type_name,NEW.id::text||suffix,NEW.question_id,NEW.snapshot->>'title');
 END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.knowledge_qa_notify_event() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst, 'reload schema';
