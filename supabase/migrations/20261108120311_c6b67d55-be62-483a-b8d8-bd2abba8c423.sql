CREATE OR REPLACE FUNCTION public.guard_meeting_decision_documentation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL AND OLD.created_by IS DISTINCT FROM auth.uid() THEN
   IF (to_jsonb(NEW)-ARRAY['meeting_result','meeting_id','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['meeting_result','meeting_id','updated_at']) THEN
     RAISE EXCEPTION 'Nur das Jour-Fixe-Ergebnis darf geändert werden' USING ERRCODE='42501';
   END IF;
   IF NEW.meeting_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.meetings m WHERE m.id=NEW.meeting_id AND m.tenant_id=NEW.tenant_id AND m.status<>'archived' AND m.tenant_id=ANY(public.get_user_tenant_ids(auth.uid())) AND (m.user_id=auth.uid() OR public.has_active_tenant_role(auth.uid(),m.tenant_id,ARRAY['abgeordneter','bueroleitung']) OR EXISTS(SELECT 1 FROM public.meeting_participants p WHERE p.meeting_id=m.id AND p.user_id=auth.uid()))) THEN RAISE EXCEPTION 'Keine Sitzungsberechtigung'; END IF;
 END IF;
 RETURN NEW;
END $$;