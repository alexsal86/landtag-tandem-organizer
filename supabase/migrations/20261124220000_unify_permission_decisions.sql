-- Rechteauskunft und Durchsetzung teilen ab jetzt dieselbe Entscheidungslogik.
--
-- Die booleschen Funktionen (is_tenant_action_allowed, is_action_allowed,
-- can_read_field, can_write_field, is_feature_enabled) behalten ihren Rückgabetyp,
-- weil Policies, Trigger und Geschäfts-RPCs darauf aufbauen. Sie enthalten aber
-- keine eigene Regel mehr, sondern sind nur noch Hüllen um
-- permission_action_decision, permission_field_decision und
-- permission_feature_decision. Die explain_*-Funktionen rufen dieselben Kerne auf
-- und ergänzen ausschließlich Zugriffsschutz, Argumentprüfung und Begründung.
-- Eine geänderte Regel wirkt damit gleichzeitig auf Auskunft und Durchsetzung.
--
-- Die Kerne sind reine Entscheidungsprozeduren ohne Aufruferprüfung: Sie werden
-- von den explain_*-Funktionen (Büro-/Plattform-Administrator) und von den
-- booleschen Hüllen (eigene Person bzw. service_role) genutzt. Direkt ausführbar
-- sind sie für Client-Rollen nicht, sonst ließe sich der Adminschutz umgehen.

CREATE OR REPLACE FUNCTION public.permission_action_decision(
  _user_id uuid,
  _tenant_id uuid,
  _action_key text,
  _simulate_role text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  member_role text;
  allowed app_role[];
BEGIN
  IF _simulate_role IS NULL THEN
    SELECT m.role::text INTO member_role
    FROM public.user_tenant_memberships m
    WHERE m.user_id = _user_id AND m.tenant_id = _tenant_id AND m.is_active;

    IF NOT FOUND THEN
      IF public.is_superadmin(_user_id) THEN
        RETURN jsonb_build_object(
          'allowed', true, 'source', 'platform', 'role', NULL, 'allowed_roles', NULL,
          'reason', 'Plattform-Administrator: Bürorechte gelten nicht.');
      END IF;
      RETURN jsonb_build_object(
        'allowed', false, 'source', 'membership', 'role', NULL, 'allowed_roles', NULL,
        'reason', 'Keine aktive Mitgliedschaft in diesem Büro.');
    END IF;

    IF public.is_superadmin(_user_id) THEN
      RETURN jsonb_build_object(
        'allowed', true, 'source', 'platform', 'role', member_role, 'allowed_roles', NULL,
        'reason', 'Plattform-Administrator: Bürorechte gelten nicht.');
    END IF;
  ELSE
    member_role := _simulate_role;
  END IF;

  SELECT p.allowed_roles INTO allowed
  FROM public.action_permissions p
  WHERE p.tenant_id = _tenant_id AND p.action_key = _action_key;

  IF allowed IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true, 'source', 'default', 'role', member_role, 'allowed_roles', NULL,
      'reason', format('Keine Regel gespeichert – der Standard erlaubt die Aktion für %s.',
                       public.permission_role_label(member_role)));
  END IF;

  IF member_role = ANY (allowed::text[]) THEN
    RETURN jsonb_build_object(
      'allowed', true, 'source', 'rule', 'role', member_role, 'allowed_roles', to_jsonb(allowed),
      'reason', format('Rolle %s ist für diese Aktion freigegeben.',
                       public.permission_role_label(member_role)));
  END IF;

  RETURN jsonb_build_object(
    'allowed', false, 'source', 'rule', 'role', member_role, 'allowed_roles', to_jsonb(allowed),
    'reason', format('Rolle %s ist nicht freigegeben. Erlaubt: %s.',
                     public.permission_role_label(member_role),
                     COALESCE((SELECT string_agg(public.permission_role_label(r), ', ')
                               FROM unnest(allowed::text[]) AS r), 'niemand')));
END $$;

CREATE OR REPLACE FUNCTION public.permission_field_decision(
  _user_id uuid,
  _tenant_id uuid,
  _table_name text,
  _column_name text,
  _simulate_role text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  member_role text;
  permission_row record;
  mode text;
BEGIN
  IF _simulate_role IS NULL THEN
    SELECT m.role::text INTO member_role
    FROM public.user_tenant_memberships m
    WHERE m.user_id = _user_id AND m.tenant_id = _tenant_id AND m.is_active;

    IF NOT FOUND THEN
      IF public.is_superadmin(_user_id) THEN
        RETURN jsonb_build_object(
          'can_read', true, 'can_write', true, 'read_mode', NULL, 'source', 'platform', 'role', NULL,
          'reason', 'Plattform-Administrator: Feldregeln gelten nicht.');
      END IF;
      RETURN jsonb_build_object(
        'can_read', false, 'can_write', false, 'read_mode', NULL, 'source', 'membership', 'role', NULL,
        'reason', 'Keine aktive Mitgliedschaft in diesem Büro.');
    END IF;

    IF public.is_superadmin(_user_id) THEN
      RETURN jsonb_build_object(
        'can_read', true, 'can_write', true, 'read_mode', NULL, 'source', 'platform', 'role', member_role,
        'reason', 'Plattform-Administrator: Feldregeln gelten nicht.');
    END IF;
  ELSE
    member_role := _simulate_role;
  END IF;

  SELECT p.can_read, p.can_write, p.read_mode INTO permission_row
  FROM public.field_permissions p
  WHERE p.tenant_id = _tenant_id
    AND p.table_name = _table_name
    AND p.column_name = _column_name
    AND p.role::text = member_role;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_read', true, 'can_write', true, 'read_mode', NULL, 'source', 'default', 'role', member_role,
      'reason', format('Keine Feldregel – Standard erlaubt Lesen und Schreiben für %s.',
                       public.permission_role_label(member_role)));
  END IF;

  mode := COALESCE(permission_row.read_mode, 'mask');

  IF NOT permission_row.can_read THEN
    RETURN jsonb_build_object(
      'can_read', false, 'can_write', false, 'read_mode', mode, 'source', 'field_rule', 'role', member_role,
      'reason', format('Feld ist für %s gesperrt (%s).',
                       public.permission_role_label(member_role),
                       CASE WHEN mode = 'record' THEN 'gesamter Datensatz gesperrt' ELSE 'Feld wird ausgeblendet' END));
  END IF;

  IF NOT permission_row.can_write THEN
    RETURN jsonb_build_object(
      'can_read', true, 'can_write', false, 'read_mode', mode, 'source', 'field_rule', 'role', member_role,
      'reason', format('Feld ist für %s lesbar, aber schreibgeschützt.',
                       public.permission_role_label(member_role)));
  END IF;

  RETURN jsonb_build_object(
    'can_read', true, 'can_write', true, 'read_mode', mode, 'source', 'field_rule', 'role', member_role,
    'reason', format('Feld ist für %s lesbar und schreibbar.',
                     public.permission_role_label(member_role)));
END $$;

CREATE OR REPLACE FUNCTION public.permission_feature_decision(
  _tenant_id uuid,
  _feature_key text,
  _user_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  enabled boolean;
  member_role text;
BEGIN
  SELECT m.role::text INTO member_role
  FROM public.user_tenant_memberships m
  WHERE m.user_id = _user_id AND m.tenant_id = _tenant_id AND m.is_active;

  SELECT f.enabled INTO enabled
  FROM public.tenant_feature_flags f
  WHERE f.tenant_id = _tenant_id AND f.feature_key = _feature_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'enabled', true, 'source', 'default', 'role', member_role,
      'reason', 'Kein Eintrag vorhanden – Module sind standardmäßig aktiv (gilt büroweit).');
  END IF;

  RETURN jsonb_build_object(
    'enabled', enabled, 'source', 'tenant', 'role', member_role,
    'reason', CASE WHEN enabled
      THEN 'Modul ist für dieses Büro aktiviert (gilt büroweit).'
      ELSE 'Modul ist für dieses Büro ausgeschaltet (gilt büroweit).' END);
END $$;

-- Auskunft: Zugriffsschutz bleibt ausschließlich hier, die Kerne prüfen nichts.
CREATE OR REPLACE FUNCTION public.explain_action_permission(
  _user_id uuid,
  _tenant_id uuid,
  _action_key text,
  _simulate_role text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF _tenant_id IS NULL OR _action_key IS NULL OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Person, Büro und Aktion sind erforderlich' USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NULL
     OR NOT (public.is_tenant_admin(auth.uid(), _tenant_id) OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Keine Berechtigung für den Rechte-Explorer dieses Büros' USING ERRCODE = '42501';
  END IF;
  IF _simulate_role IS NOT NULL
     AND _simulate_role NOT IN ('abgeordneter', 'bueroleitung', 'mitarbeiter', 'praktikant') THEN
    RAISE EXCEPTION 'Unbekannte Rolle für die Simulation' USING ERRCODE = '22023';
  END IF;

  RETURN public.permission_action_decision(_user_id, _tenant_id, _action_key, _simulate_role);
END $$;

CREATE OR REPLACE FUNCTION public.explain_field_permission(
  _user_id uuid,
  _tenant_id uuid,
  _table_name text,
  _column_name text,
  _simulate_role text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF _tenant_id IS NULL OR _table_name IS NULL OR _column_name IS NULL OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Person, Büro, Tabelle und Spalte sind erforderlich' USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NULL
     OR NOT (public.is_tenant_admin(auth.uid(), _tenant_id) OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Keine Berechtigung für den Rechte-Explorer dieses Büros' USING ERRCODE = '42501';
  END IF;
  IF _simulate_role IS NOT NULL
     AND _simulate_role NOT IN ('abgeordneter', 'bueroleitung', 'mitarbeiter', 'praktikant') THEN
    RAISE EXCEPTION 'Unbekannte Rolle für die Simulation' USING ERRCODE = '22023';
  END IF;

  RETURN public.permission_field_decision(_user_id, _tenant_id, _table_name, _column_name, _simulate_role);
END $$;

CREATE OR REPLACE FUNCTION public.explain_feature_flag(
  _user_id uuid,
  _tenant_id uuid,
  _feature_key text
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF _tenant_id IS NULL OR _feature_key IS NULL OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Person, Büro und Modul sind erforderlich' USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NULL
     OR NOT (public.is_tenant_admin(auth.uid(), _tenant_id) OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Keine Berechtigung für den Rechte-Explorer dieses Büros' USING ERRCODE = '42501';
  END IF;

  RETURN public.permission_feature_decision(_tenant_id, _feature_key, _user_id);
END $$;

-- Durchsetzung: gleiche Kerne, unveränderter boolescher Rückgabetyp.
CREATE OR REPLACE FUNCTION public.is_tenant_action_allowed(_user_id uuid, _tenant_id uuid, _action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF _user_id IS NULL
     OR (_user_id IS DISTINCT FROM auth.uid() AND coalesce(auth.role(), '') <> 'service_role') THEN
    RETURN false;
  END IF;
  RETURN coalesce((public.permission_action_decision(_user_id, _tenant_id, _action, NULL)->>'allowed')::boolean, false);
END $$;

CREATE OR REPLACE FUNCTION public.is_action_allowed(_user_id uuid, _action_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  office uuid;
BEGIN
  IF _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.user_tenant_memberships
      WHERE user_id = _user_id AND is_active) <> 1 THEN
    RETURN false;
  END IF;
  SELECT tenant_id INTO office FROM public.user_tenant_memberships
  WHERE user_id = _user_id AND is_active;
  RETURN coalesce((public.permission_action_decision(_user_id, office, _action_key, NULL)->>'allowed')::boolean, false);
END $$;

CREATE OR REPLACE FUNCTION public.can_read_field(_user_id uuid, _table text, _column text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  office uuid;
BEGIN
  IF _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.user_tenant_memberships
      WHERE user_id = _user_id AND is_active) <> 1 THEN
    RETURN false;
  END IF;
  SELECT tenant_id INTO office FROM public.user_tenant_memberships
  WHERE user_id = _user_id AND is_active;
  RETURN coalesce((public.permission_field_decision(_user_id, office, _table, _column, NULL)->>'can_read')::boolean, false);
END $$;

CREATE OR REPLACE FUNCTION public.can_write_field(_user_id uuid, _table text, _column text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  office uuid;
BEGIN
  IF _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.user_tenant_memberships
      WHERE user_id = _user_id AND is_active) <> 1 THEN
    RETURN false;
  END IF;
  SELECT tenant_id INTO office FROM public.user_tenant_memberships
  WHERE user_id = _user_id AND is_active;
  RETURN coalesce((public.permission_field_decision(_user_id, office, _table, _column, NULL)->>'can_write')::boolean, false);
END $$;

CREATE OR REPLACE FUNCTION public.is_feature_enabled(_tenant_id uuid, _feature_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT coalesce((public.permission_feature_decision(_tenant_id, _feature_key, NULL)->>'enabled')::boolean, true);
$$;

-- Kerne sind reine Entscheidungslogik: kein direkter Aufruf durch Clients,
-- sonst ließe sich die Administratorprüfung der explain_*-Funktionen umgehen.
REVOKE ALL ON FUNCTION public.permission_action_decision(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.permission_field_decision(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.permission_feature_decision(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_tenant_action_allowed(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_action_allowed(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_field(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_field(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_feature_enabled(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_action_allowed(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_action_allowed(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_field(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_field(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(uuid, text) TO authenticated;
