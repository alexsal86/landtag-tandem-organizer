CREATE OR REPLACE FUNCTION public.document_meeting_decision(_meeting uuid, _decision uuid, _result text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.meetings; d public.task_decisions; me uuid:=auth.uid();
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.meetings WHERE id=_meeting;
 IF NOT FOUND OR NOT coalesce(m.tenant_id=ANY(public.get_user_tenant_ids(me)),false) OR m.status='archived' THEN RAISE EXCEPTION 'Besprechung nicht zugänglich'; END IF;
 IF m.user_id IS DISTINCT FROM me AND NOT public.has_active_tenant_role(me,m.tenant_id,ARRAY['abgeordneter','bueroleitung']) AND NOT EXISTS(SELECT 1 FROM public.meeting_participants WHERE meeting_id=m.id AND user_id=me) THEN RAISE EXCEPTION 'Keine Sitzungsberechtigung'; END IF;
 SELECT * INTO d FROM public.task_decisions WHERE id=_decision AND tenant_id=m.tenant_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_access_decision(_decision,me) THEN RAISE EXCEPTION 'Entscheidung nicht zugänglich'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meeting_agenda_items WHERE meeting_id=m.id AND system_type='decisions' AND result_text IS NOT NULL AND CASE WHEN result_text ~ '^\s*\{' THEN result_text::jsonb ? d.id::text ELSE false END) THEN RAISE EXCEPTION 'Entscheidung ist nicht in der Tagesordnung'; END IF;
 UPDATE public.task_decisions SET meeting_result=_result,meeting_id=m.id WHERE id=d.id AND tenant_id=m.tenant_id;
END $$;
REVOKE ALL ON FUNCTION public.document_meeting_decision(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.document_meeting_decision(uuid,uuid,text) TO authenticated,service_role;
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.archive_meeting_with_stafette(uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,$old$          UPDATE public.task_decisions SET meeting_result=body, meeting_id=m.id WHERE id=d.id AND tenant_id=m.tenant_id;
          IF NOT FOUND THEN RAISE EXCEPTION 'Keine Berechtigung zum Dokumentieren dieser Entscheidung'; END IF;$old$,$new$          PERFORM public.document_meeting_decision(m.id,d.id,body);$new$);
 EXECUTE definition;
END $$;