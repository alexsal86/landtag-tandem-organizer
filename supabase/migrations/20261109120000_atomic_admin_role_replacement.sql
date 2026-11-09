-- Legacy global roles must be replaced in one transaction. Membership consistency
-- guards remain authoritative: a conflicting replacement rolls back the deletion.
CREATE OR REPLACE FUNCTION public.replace_user_role(
  _tenant_id uuid, _user_id uuid, _role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Nur Plattformadministratoren dürfen globale Rollen ändern' USING ERRCODE = '42501';
  END IF;
  IF _role IS NOT NULL AND _role NOT IN ('abgeordneter', 'bueroleitung', 'mitarbeiter', 'praktikant') THEN
    RAISE EXCEPTION 'Ungültige Rolle' USING ERRCODE = '22023';
  END IF;

  -- Serialize replacements even when no global role exists yet.
  PERFORM 1 FROM auth.users WHERE id = _user_id FOR UPDATE;
  PERFORM 1 FROM public.user_tenant_memberships
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND is_active
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Keine aktive Mitgliedschaft im ausgewählten Büro' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  IF _role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, assigned_by)
    VALUES (_user_id, _role::public.app_role, auth.uid());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_user_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_user_role(uuid, uuid, text) TO authenticated;
