DROP POLICY "Admins can manage annual tasks" ON public.annual_tasks;
CREATE POLICY "Tenant admins manage annual routines" ON public.annual_tasks FOR ALL TO authenticated USING (public.is_tenant_admin(auth.uid(),tenant_id)) WITH CHECK(public.is_tenant_admin(auth.uid(),tenant_id));
CREATE OR REPLACE FUNCTION public.guard_linked_annual_routine() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF pg_trigger_depth()<=1 AND auth.role() IS DISTINCT FROM 'service_role' THEN
   IF TG_OP='INSERT' THEN
     IF NEW.automation_rule_id IS NOT NULL OR NEW.execute_function IS NOT NULL OR NEW.is_system_task THEN RAISE EXCEPTION 'Systemaktionen nur über den Regel-Assistenten anlegen'; END IF;
   ELSIF OLD.automation_rule_id IS NOT NULL THEN RAISE EXCEPTION 'Verknüpfte Jahresroutinen nur über den Regel-Assistenten ändern'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_linked_annual_routine BEFORE INSERT OR UPDATE OR DELETE ON public.annual_tasks FOR EACH ROW EXECUTE FUNCTION public.guard_linked_annual_routine();
CREATE OR REPLACE FUNCTION public.validate_annual_rule_action() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE action jsonb; assignee uuid;
BEGIN
 SELECT x INTO action FROM jsonb_array_elements(NEW.actions) x WHERE x->>'type'='run_annual_routine' LIMIT 1;
 IF action IS NULL THEN
   UPDATE public.annual_tasks SET auto_execute=false WHERE automation_rule_id=NEW.id;
   RETURN NEW;
 END IF;
 IF NEW.trigger_config->>'timezone' IS DISTINCT FROM 'Europe/Berlin' OR (NEW.trigger_config->>'hour') IS NULL OR (NEW.trigger_config->>'hour')::integer NOT BETWEEN 0 AND 23 OR NEW.trigger_config->>'month_end' NOT IN ('true','false') THEN RAISE EXCEPTION 'Ungültiger Berliner Jahreszeitplan'; END IF;
 IF COALESCE(NULLIF(action->'payload'->>'routine_category',''),'admin') NOT IN ('admin','employee','calendar','system') THEN RAISE EXCEPTION 'Ungültige Kategorie'; END IF;
 IF NULLIF(action->'payload'->>'system_function','') IS NULL THEN
   assignee:=NULLIF(action->'payload'->>'assigned_to','')::uuid;
   IF assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_tenant_memberships WHERE tenant_id=NEW.tenant_id AND user_id=assignee AND is_active) THEN RAISE EXCEPTION 'Person gehört nicht zum Büro'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_annual_rule_action BEFORE INSERT OR UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.validate_annual_rule_action();
REVOKE ALL ON FUNCTION public.guard_linked_annual_routine() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.validate_annual_rule_action() FROM PUBLIC,anon,authenticated;