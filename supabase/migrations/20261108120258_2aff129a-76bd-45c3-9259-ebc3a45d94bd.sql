ALTER FUNCTION public.document_meeting_decision(uuid,uuid,text) SECURITY INVOKER;
CREATE POLICY "Meeting attendees document accessible decisions" ON public.task_decisions FOR UPDATE TO authenticated
USING (tenant_id=ANY(public.get_user_tenant_ids(auth.uid())) AND public.can_access_decision(id,auth.uid()) AND EXISTS (
 SELECT 1 FROM public.meeting_agenda_items ai JOIN public.meetings m ON m.id=ai.meeting_id
 WHERE ai.system_type='decisions' AND m.tenant_id=task_decisions.tenant_id AND m.status<>'archived'
 AND (m.user_id=auth.uid() OR public.has_active_tenant_role(auth.uid(),m.tenant_id,ARRAY['abgeordneter','bueroleitung']) OR EXISTS(SELECT 1 FROM public.meeting_participants p WHERE p.meeting_id=m.id AND p.user_id=auth.uid()))
 AND ai.result_text LIKE '%'||task_decisions.id::text||'%'
)) WITH CHECK (tenant_id=ANY(public.get_user_tenant_ids(auth.uid())));
CREATE OR REPLACE FUNCTION public.guard_meeting_decision_documentation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND OLD.created_by IS DISTINCT FROM auth.uid() THEN
   IF (to_jsonb(NEW)-ARRAY['meeting_result','meeting_id','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['meeting_result','meeting_id','updated_at']) THEN
     RAISE EXCEPTION 'Nur das Jour-Fixe-Ergebnis darf geändert werden' USING ERRCODE='42501';
   END IF;
   IF NEW.meeting_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.meetings m WHERE m.id=NEW.meeting_id AND m.tenant_id=NEW.tenant_id AND m.status<>'archived' AND m.tenant_id=ANY(public.get_user_tenant_ids(auth.uid())) AND (m.user_id=auth.uid() OR public.has_active_tenant_role(auth.uid(),m.tenant_id,ARRAY['abgeordneter','bueroleitung']) OR EXISTS(SELECT 1 FROM public.meeting_participants p WHERE p.meeting_id=m.id AND p.user_id=auth.uid()))) THEN RAISE EXCEPTION 'Keine Sitzungsberechtigung'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_meeting_decision_documentation() FROM PUBLIC,anon;
CREATE TRIGGER guard_meeting_decision_documentation BEFORE UPDATE ON public.task_decisions FOR EACH ROW EXECUTE FUNCTION public.guard_meeting_decision_documentation();