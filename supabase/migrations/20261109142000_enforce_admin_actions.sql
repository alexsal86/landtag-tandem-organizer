UPDATE public.field_permissions SET can_write=false WHERE NOT can_read;
ALTER TABLE public.field_permissions ADD CONSTRAINT field_permissions_write_requires_read CHECK(can_read OR NOT can_write);

CREATE OR REPLACE FUNCTION public.is_tenant_action_allowed(_user_id uuid,_tenant_id uuid,_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE member_role text; allowed app_role[];
BEGIN
  IF _user_id IS NULL OR (_user_id IS DISTINCT FROM auth.uid() AND coalesce(auth.role(),'')<>'service_role') THEN RETURN false; END IF;
  IF is_superadmin(_user_id) THEN RETURN true; END IF;
  SELECT role INTO member_role FROM user_tenant_memberships WHERE user_id=_user_id AND tenant_id=_tenant_id AND is_active;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT allowed_roles INTO allowed FROM action_permissions WHERE tenant_id=_tenant_id AND action_key=_action;
  RETURN allowed IS NULL OR member_role=ANY(allowed::text[]);
END $$;
REVOKE ALL ON FUNCTION public.is_tenant_action_allowed(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_action_allowed(uuid,uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.enforce_configured_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE action_key text; office uuid; previous jsonb:=to_jsonb(OLD); following jsonb:=to_jsonb(NEW);
BEGIN
  IF coalesce(auth.role(),'')='service_role' OR (auth.uid() IS NULL AND session_user IN ('postgres','supabase_admin')) THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  office:=coalesce((previous->>'tenant_id')::uuid,(following->>'tenant_id')::uuid);
  IF TG_TABLE_NAME='contacts' AND TG_OP='DELETE' THEN action_key:='contact.delete';
  ELSIF TG_TABLE_NAME='letters' AND TG_OP='DELETE' THEN action_key:='letter.delete';
  ELSIF TG_TABLE_NAME='letters' AND ((following->>'status'='sent' AND previous->>'status' IS DISTINCT FROM 'sent') OR (following->>'sent_at' IS NOT NULL AND previous->>'sent_at' IS NULL)) THEN action_key:='letter.send';
  ELSIF TG_TABLE_NAME='task_decisions' AND following->>'status'='archived' AND previous->>'status' IS DISTINCT FROM 'archived' THEN action_key:='decision.archive';
  ELSIF TG_TABLE_NAME='case_files' AND following->>'status' IN ('completed','closed','archived') AND previous->>'status' IS DISTINCT FROM following->>'status' THEN action_key:='case.close';
  END IF;
  IF action_key IS NOT NULL AND NOT is_tenant_action_allowed(auth.uid(),office,action_key) THEN RAISE EXCEPTION 'Aktion % ist für Ihre Bürorolle gesperrt',action_key USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER configured_contact_actions BEFORE DELETE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.enforce_configured_action();
CREATE TRIGGER configured_letter_actions BEFORE INSERT OR UPDATE OR DELETE ON public.letters FOR EACH ROW EXECUTE FUNCTION public.enforce_configured_action();
CREATE TRIGGER configured_decision_actions BEFORE INSERT OR UPDATE ON public.task_decisions FOR EACH ROW EXECUTE FUNCTION public.enforce_configured_action();
CREATE TRIGGER configured_case_actions BEFORE INSERT OR UPDATE ON public.case_files FOR EACH ROW EXECUTE FUNCTION public.enforce_configured_action();

-- Real fields only. The existing schema has no employees.salary or letters.draft_content.
CREATE OR REPLACE FUNCTION public.enforce_configured_field_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE permission record; member_role text; before_row jsonb:=to_jsonb(OLD); after_row jsonb:=to_jsonb(NEW);
BEGIN
  IF coalesce(auth.role(),'')='service_role' OR (auth.uid() IS NULL AND session_user IN ('postgres','supabase_admin')) OR is_superadmin(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND before_row->'tenant_id' IS DISTINCT FROM after_row->'tenant_id' THEN RAISE EXCEPTION 'Bürozuordnung darf nicht geändert werden' USING ERRCODE='42501'; END IF;
  SELECT role INTO member_role FROM user_tenant_memberships WHERE user_id=auth.uid() AND tenant_id=(after_row->>'tenant_id')::uuid AND is_active;
  FOR permission IN SELECT column_name FROM field_permissions WHERE tenant_id=(after_row->>'tenant_id')::uuid AND role::text=member_role AND table_name=TG_TABLE_NAME AND NOT can_write LOOP
    IF permission.column_name IN ('phone','email','notes','email_2','email_3','mobile_phone','business_phone','content','content_html') AND after_row->permission.column_name IS DISTINCT FROM before_row->permission.column_name THEN
      IF TG_OP='INSERT' AND coalesce(after_row->>permission.column_name,'')='' THEN CONTINUE; END IF;
      RAISE EXCEPTION 'Schreibzugriff auf dieses Feld ist gesperrt' USING ERRCODE='42501';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER configured_contact_fields BEFORE INSERT OR UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.enforce_configured_field_writes();
CREATE TRIGGER configured_letter_fields BEFORE INSERT OR UPDATE ON public.letters FOR EACH ROW EXECUTE FUNCTION public.enforce_configured_field_writes();

-- Historical contact changes include before-values: expose them only to the actor/admin.
DROP POLICY IF EXISTS bulk_audit_select ON public.bulk_action_audit;
CREATE POLICY bulk_audit_select ON public.bulk_action_audit FOR SELECT TO authenticated USING (
  is_tenant_admin(auth.uid(),tenant_id) OR is_superadmin(auth.uid()) OR (actor_id=auth.uid() AND is_tenant_member(tenant_id,auth.uid()))
);
