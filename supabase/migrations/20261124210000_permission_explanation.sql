-- Rechte-Explorer: Entscheidung und Begründung für Module, Aktionen und Felder.
--
-- Die booleschen Funktionen (is_action_allowed, can_read_field, can_write_field,
-- is_feature_enabled) bleiben unverändert, weil Policies, Trigger und Geschäfts-RPCs
-- auf ihnen aufbauen und ihr Rückgabetyp nicht in place geändert werden kann.
-- Die explain_*-Funktionen sind die begründenden Gegenstücke: Sie liefern dieselbe
-- Entscheidung und zusätzlich Quelle, Rolle und Klartext-Begründung. Der Explorer
-- liest ausschließlich diese Funktionen und schreibt nichts.

CREATE OR REPLACE FUNCTION public.permission_role_label(_role text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = 'public' AS $$
  SELECT CASE _role
    WHEN 'abgeordneter' THEN 'Abgeordneter'
    WHEN 'bueroleitung' THEN 'Büroleitung'
    WHEN 'mitarbeiter' THEN 'Mitarbeiter'
    WHEN 'praktikant' THEN 'Praktikant'
    ELSE COALESCE(NULLIF(_role, ''), 'ohne Rolle')
  END
$$;

-- Nur Büro-Administratoren und Plattform-Administratoren dürfen fremde Rechte
-- erklären. Die Prüfung liegt in jeder Funktion, damit kein Aufruf sie umgeht.
CREATE OR REPLACE FUNCTION public.explain_action_permission(
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

CREATE OR REPLACE FUNCTION public.explain_field_permission(
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

-- Feature-Flags gelten büroweit, nicht pro Person. Die Funktion nennt das ausdrücklich,
-- damit die Anzeige im Explorer nicht als Personenrecht missverstanden wird.
CREATE OR REPLACE FUNCTION public.explain_feature_flag(
  _user_id uuid,
  _tenant_id uuid,
  _feature_key text
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  enabled boolean;
  member_role text;
BEGIN
  IF _tenant_id IS NULL OR _feature_key IS NULL OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Person, Büro und Modul sind erforderlich' USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NULL
     OR NOT (public.is_tenant_admin(auth.uid(), _tenant_id) OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Keine Berechtigung für den Rechte-Explorer dieses Büros' USING ERRCODE = '42501';
  END IF;

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

-- Sammelabfrage für die Seite: eine Berechtigungsprüfung, ein Ergebnis, keine N+1-Aufrufe.
CREATE OR REPLACE FUNCTION public.explain_permissions(
  _user_id uuid,
  _tenant_id uuid,
  _actions text[] DEFAULT '{}',
  _features text[] DEFAULT '{}',
  _fields jsonb DEFAULT '[]',
  _simulate_role text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  member_role text;
  member boolean := false;
  platform boolean := false;
  action_rows jsonb := '[]'::jsonb;
  feature_rows jsonb := '[]'::jsonb;
  field_rows jsonb := '[]'::jsonb;
  element jsonb;
  target jsonb;
BEGIN
  IF _tenant_id IS NULL OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Person und Büro sind erforderlich' USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NULL
     OR NOT (public.is_tenant_admin(auth.uid(), _tenant_id) OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Keine Berechtigung für den Rechte-Explorer dieses Büros' USING ERRCODE = '42501';
  END IF;
  IF _simulate_role IS NOT NULL
     AND _simulate_role NOT IN ('abgeordneter', 'bueroleitung', 'mitarbeiter', 'praktikant') THEN
    RAISE EXCEPTION 'Unbekannte Rolle für die Simulation' USING ERRCODE = '22023';
  END IF;

  SELECT m.role::text INTO member_role
  FROM public.user_tenant_memberships m
  WHERE m.user_id = _user_id AND m.tenant_id = _tenant_id AND m.is_active;
  member := FOUND;
  platform := public.is_superadmin(_user_id);

  IF NOT member AND NOT platform AND _simulate_role IS NULL THEN
    RETURN jsonb_build_object(
      'member', false, 'role', NULL, 'simulated_role', NULL, 'is_superadmin', false,
      'actions', '[]'::jsonb, 'features', '[]'::jsonb, 'fields', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(
           public.explain_action_permission(_user_id, _tenant_id, q.key, _simulate_role)
           || jsonb_build_object('key', q.key) ORDER BY q.ord), '[]'::jsonb)
  INTO action_rows
  FROM (SELECT key, ord FROM unnest(COALESCE(_actions, '{}'::text[])) WITH ORDINALITY AS t(key, ord)) AS q;

  SELECT COALESCE(jsonb_agg(
           public.explain_feature_flag(_user_id, _tenant_id, q.key)
           || jsonb_build_object('key', q.key) ORDER BY q.ord), '[]'::jsonb)
  INTO feature_rows
  FROM (SELECT key, ord FROM unnest(COALESCE(_features, '{}'::text[])) WITH ORDINALITY AS t(key, ord)) AS q;

  FOR element IN SELECT value FROM jsonb_array_elements(COALESCE(_fields, '[]'::jsonb)) AS value LOOP
    IF element ? 'table' AND element ? 'column' THEN
      target := public.explain_field_permission(
        _user_id, _tenant_id, element->>'table', element->>'column', _simulate_role);
      field_rows := field_rows || jsonb_build_array(
        target || jsonb_build_object('table', element->>'table', 'column', element->>'column'));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'member', member,
    'role', member_role,
    'simulated_role', _simulate_role,
    'is_superadmin', platform,
    'actions', action_rows,
    'features', feature_rows,
    'fields', field_rows);
END $$;

REVOKE ALL ON FUNCTION public.permission_role_label(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.explain_action_permission(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.explain_field_permission(uuid, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.explain_feature_flag(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.explain_permissions(uuid, uuid, text[], text[], jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permission_role_label(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.explain_action_permission(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.explain_field_permission(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.explain_feature_flag(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.explain_permissions(uuid, uuid, text[], text[], jsonb, text) TO authenticated;
