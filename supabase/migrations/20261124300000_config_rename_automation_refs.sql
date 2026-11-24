-- Umbenennen zieht Status- und Kategoriewerte in Automatisierung und Workflows mit.
--
-- automation_rules speichert Verweise dreifach als Text:
--   * trigger_config = {field: 'status'|'category'|..., value: '<name>'},
--   * conditions    = Baum aus {field, operator, value} (auch ältere flache Listen),
--   * actions[].payload = {table, category, status, ...}.
-- workflow_definitions speichert dieselben Formen ohne Modulspalte.
--
-- Ohne Migration blieben diese Werte auf dem alten Namen stehen: eine Regel, die
-- auf "offen" prüft, matcht nach dem Umbenennen still nicht mehr. Die Regeln
-- werden deshalb im selben Aufruf fortgeschrieben und im Ergebnis ausgewiesen.
--
-- Zuordnung erfolgt über Feldname + Modul (nicht über bloßen Textvergleich):
-- eine Kontaktregel mit field='status' bleibt unangetastet, wenn ein Aufgaben-
-- status umbenannt wird. Actions werden zusätzlich über payload.table geprüft,
-- damit ein Status auf "decisions" nicht mitwandert.

CREATE OR REPLACE FUNCTION public.config_rename_conditions(_node jsonb, _fields text[], _old text[], _new text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = 'public' AS $$
DECLARE
  result jsonb;
BEGIN
  IF _node IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(_node) = 'array' THEN
    SELECT coalesce(jsonb_agg(public.config_rename_conditions(element, _fields, _old, _new) ORDER BY position), '[]'::jsonb)
      INTO result
      FROM jsonb_array_elements(_node) WITH ORDINALITY AS nodes(element, position);
    RETURN result;
  END IF;

  IF jsonb_typeof(_node) = 'object' THEN
    IF jsonb_typeof(_node->'field') = 'string'
       AND _node->>'field' = ANY (_fields)
       AND jsonb_typeof(_node->'value') = 'string'
       AND _node->>'value' = ANY (_old) THEN
      RETURN jsonb_set(_node, '{value}', to_jsonb(_new));
    END IF;

    SELECT coalesce(jsonb_object_agg(entry.key, public.config_rename_conditions(entry.value, _fields, _old, _new)), '{}'::jsonb)
      INTO result
      FROM jsonb_each(_node) AS entry;
    RETURN result;
  END IF;

  RETURN _node;
END $$;

CREATE OR REPLACE FUNCTION public.config_rename_action_field(
  _actions jsonb, _field text, _tables text[], _old text[], _new text
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = 'public' AS $$
  SELECT coalesce(jsonb_agg(
    CASE
      WHEN jsonb_typeof(action) = 'object'
       AND jsonb_typeof(action->'payload') = 'object'
       AND coalesce(action->'payload'->>'table', '') = ANY (_tables)
       AND jsonb_typeof(action->'payload'->_field) = 'string'
       AND action->'payload'->>_field = ANY (_old)
      THEN jsonb_set(action, ARRAY['payload', _field], to_jsonb(_new))
      ELSE action
    END
    ORDER BY position), '[]'::jsonb)
  FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(_actions) = 'array' THEN _actions ELSE '[]'::jsonb END
       ) WITH ORDINALITY AS rows(action, position)
$$;

-- Für Workflows ohne Modulspalte: ersetzt Zeichenketten unter bekannten Schlüsseln.
CREATE OR REPLACE FUNCTION public.config_rename_keys(_node jsonb, _fields text[], _old text[], _new text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = 'public' AS $$
DECLARE
  result jsonb;
BEGIN
  IF _node IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(_node) = 'array' THEN
    SELECT coalesce(jsonb_agg(public.config_rename_keys(element, _fields, _old, _new) ORDER BY position), '[]'::jsonb)
      INTO result
      FROM jsonb_array_elements(_node) WITH ORDINALITY AS nodes(element, position);
    RETURN result;
  END IF;

  IF jsonb_typeof(_node) = 'object' THEN
    SELECT coalesce(jsonb_object_agg(
             entry.key,
             CASE
               WHEN entry.key = ANY (_fields)
                AND jsonb_typeof(entry.value) = 'string'
                AND entry.value #>> '{}' = ANY (_old)
               THEN to_jsonb(_new)
               ELSE public.config_rename_keys(entry.value, _fields, _old, _new)
             END), '{}'::jsonb)
      INTO result
      FROM jsonb_each(_node) AS entry;
    RETURN result;
  END IF;

  RETURN _node;
END $$;

CREATE OR REPLACE FUNCTION public.rename_config_item(
  _table text,
  _id uuid,
  _label text,
  _color text DEFAULT NULL,
  _icon text DEFAULT NULL,
  _set_color boolean DEFAULT false,
  _set_icon boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  scope text;
  office uuid;
  old_name text;
  old_label text;
  new_name text;
  new_label text := btrim(_label);
  old_pairs text[];
  updated_refs jsonb := '[]'::jsonb;
  total integer := 0;
  hit integer;
  ref_fields text[];
  ref_modules text[];
  action_field text;
  action_tables text[];
  rule_hits integer;
  workflow_hits integer;
BEGIN
  IF _table IS NULL OR _id IS NULL OR new_label IS NULL OR new_label = '' THEN
    RAISE EXCEPTION 'Konfiguration, Eintrag und Bezeichnung sind erforderlich' USING ERRCODE = '22023';
  END IF;

  IF _table IN ('task_categories', 'case_file_types', 'document_categories',
                'appointment_categories', 'appointment_statuses', 'appointment_locations',
                'case_file_processing_statuses') THEN
    scope := 'tenant';
  ELSIF _table IN ('task_statuses', 'todo_categories') THEN
    scope := 'global';
  ELSE
    RAISE EXCEPTION 'Unbekannte Konfiguration: %', _table USING ERRCODE = '22023';
  END IF;

  IF scope = 'tenant' THEN
    EXECUTE format('SELECT tenant_id, name, label FROM public.%I WHERE id = $1', _table)
      INTO office, old_name, old_label USING _id;
    IF office IS NULL THEN
      RAISE EXCEPTION 'Eintrag nicht gefunden' USING ERRCODE = '22023';
    END IF;
    IF auth.uid() IS NULL
       OR NOT (public.is_tenant_admin(auth.uid(), office) OR public.is_superadmin(auth.uid())) THEN
      RAISE EXCEPTION 'Keine Berechtigung für diese Konfiguration' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF auth.uid() IS NULL OR NOT public.is_superadmin(auth.uid()) THEN
      RAISE EXCEPTION 'Plattformweite Konfiguration erfordert Plattformrechte' USING ERRCODE = '42501';
    END IF;
    EXECUTE format('SELECT name, label FROM public.%I WHERE id = $1', _table)
      INTO old_name, old_label USING _id;
    IF old_name IS NULL THEN
      RAISE EXCEPTION 'Eintrag nicht gefunden' USING ERRCODE = '22023';
    END IF;
  END IF;

  new_name := public.config_item_name(new_label);
  IF new_name IS NULL OR new_name = '' THEN
    RAISE EXCEPTION 'Bezeichnung enthält keine verwertbaren Zeichen' USING ERRCODE = '22023';
  END IF;
  old_pairs := ARRAY[old_name, old_label];

  -- Neue Bezeichnung muss im Geltungsbereich frei sein.
  IF scope = 'tenant' THEN
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE tenant_id = $1 AND id <> $2 AND (name = $3 OR label = $4)',
      _table
    ) INTO hit USING office, _id, new_name, new_label;
  ELSE
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE id <> $2 AND (name = $3 OR label = $4)',
      _table
    ) INTO hit USING office, _id, new_name, new_label;
  END IF;
  IF hit > 0 THEN
    RAISE EXCEPTION 'Ein anderer Eintrag verwendet diese Bezeichnung bereits' USING ERRCODE = '23505';
  END IF;

  -- Bisherige Bezeichnung muss eindeutig sein, sonst wären Verweise nicht zuordenbar.
  IF scope = 'tenant' THEN
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE tenant_id = $1 AND id <> $2 AND (name = $3 OR ($4 IS NOT NULL AND label = $4))',
      _table
    ) INTO hit USING office, _id, old_name, old_label;
  ELSE
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE id <> $2 AND (name = $3 OR ($4 IS NOT NULL AND label = $4))',
      _table
    ) INTO hit USING office, _id, old_name, old_label;
  END IF;
  IF hit > 0 THEN
    RAISE EXCEPTION 'Ein anderer Eintrag trägt denselben bisherigen Namen; Verweise wären nicht eindeutig. Bitte zuerst umbenennen.'
      USING ERRCODE = '23505';
  END IF;

  EXECUTE format('UPDATE public.%I SET name = $1, label = $2 WHERE id = $3', _table)
    USING new_name, new_label, _id;

  IF _set_color AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _table AND column_name = 'color'
  ) THEN
    EXECUTE format('UPDATE public.%I SET color = $1 WHERE id = $2', _table) USING _color, _id;
  END IF;

  IF _set_icon AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _table AND column_name = 'icon'
  ) THEN
    EXECUTE format('UPDATE public.%I SET icon = $1 WHERE id = $2', _table) USING _icon, _id;
  END IF;

  IF _table = 'task_categories' THEN
    UPDATE public.tasks SET category = new_name
    WHERE tenant_id = office AND category = ANY (old_pairs);
    GET DIAGNOSTICS hit = ROW_COUNT;

  ELSIF _table = 'task_statuses' THEN
    UPDATE public.tasks SET status = new_name
    WHERE status = ANY (old_pairs);
    GET DIAGNOSTICS hit = ROW_COUNT;

  ELSIF _table = 'todo_categories' THEN
    -- Verweise laufen über category_id, der Fremdschlüssel bleibt unverändert.
    hit := 0;

  ELSIF _table = 'case_file_types' THEN
    UPDATE public.case_files SET case_type = new_name
    WHERE tenant_id = office AND case_type = ANY (old_pairs);
    GET DIAGNOSTICS hit = ROW_COUNT;

  ELSIF _table = 'case_file_processing_statuses' THEN
    UPDATE public.case_files c
    SET processing_status = CASE
          WHEN c.processing_status = ANY (old_pairs) THEN new_name
          ELSE c.processing_status
        END,
        processing_statuses = CASE
          WHEN c.processing_statuses && old_pairs THEN (
            SELECT array_agg(value ORDER BY first_pos)
            FROM (
              SELECT value, min(pos) AS first_pos
              FROM unnest(ARRAY(
                     SELECT CASE WHEN element = ANY (old_pairs) THEN new_name ELSE element END
                     FROM unnest(c.processing_statuses) WITH ORDINALITY AS u(element, pos)
                     ORDER BY pos
                   )) WITH ORDINALITY AS v(value, pos)
              GROUP BY value
            ) dedup
          )
          ELSE c.processing_statuses
        END
    WHERE c.tenant_id = office
      AND (c.processing_status = ANY (old_pairs) OR c.processing_statuses && old_pairs);
    GET DIAGNOSTICS hit = ROW_COUNT;

  ELSIF _table = 'document_categories' THEN
    UPDATE public.documents SET category = new_name
    WHERE tenant_id = office AND category = ANY (old_pairs);
    GET DIAGNOSTICS hit = ROW_COUNT;

  ELSIF _table = 'appointment_categories' THEN
    UPDATE public.appointments SET category = new_name
    WHERE tenant_id = office AND category = ANY (old_pairs);
    GET DIAGNOSTICS hit = ROW_COUNT;

  ELSIF _table = 'appointment_statuses' THEN
    UPDATE public.appointments SET status = new_name
    WHERE tenant_id = office AND status = ANY (old_pairs);
    GET DIAGNOSTICS hit = ROW_COUNT;

  ELSIF _table = 'appointment_locations' THEN
    UPDATE public.appointments SET location = new_name
    WHERE tenant_id = office
      AND (location = ANY (old_pairs) OR location = _id::text);
    GET DIAGNOSTICS hit = ROW_COUNT;
  END IF;

  IF hit > 0 THEN
    updated_refs := updated_refs || jsonb_build_array(jsonb_build_object(
      'key', CASE
               WHEN _table IN ('task_categories', 'task_statuses') THEN 'tasks'
               WHEN _table IN ('case_file_types', 'case_file_processing_statuses') THEN 'case_files'
               WHEN _table = 'document_categories' THEN 'documents'
               ELSE 'appointments'
             END,
      'label', CASE
                 WHEN _table IN ('task_categories', 'task_statuses') THEN 'Aufgabe'
                 WHEN _table IN ('case_file_types', 'case_file_processing_statuses') THEN 'Fallakte'
                 WHEN _table = 'document_categories' THEN 'Dokument'
                 ELSE 'Termin'
               END,
      'count', hit));
    total := total + hit;
  END IF;

  -- Feldname und Modul, unter denen diese Konfiguration in Regeln auftaucht.
  -- document_categories hat kein Automatisierungsmodul, todo_categories läuft über die ID.
  CASE _table
    WHEN 'task_categories' THEN
      ref_fields := ARRAY['category']; ref_modules := ARRAY['tasks'];
      action_field := 'category'; action_tables := ARRAY['tasks'];
    WHEN 'task_statuses' THEN
      ref_fields := ARRAY['status']; ref_modules := ARRAY['tasks'];
      action_field := 'status'; action_tables := ARRAY['tasks'];
    WHEN 'case_file_types' THEN
      ref_fields := ARRAY['case_type']; ref_modules := ARRAY['casefiles', 'cases', 'case_files'];
      action_field := NULL; action_tables := NULL;
    WHEN 'case_file_processing_statuses' THEN
      ref_fields := ARRAY['processing_status']; ref_modules := ARRAY['casefiles', 'cases', 'case_files'];
      action_field := NULL; action_tables := NULL;
    WHEN 'appointment_categories' THEN
      ref_fields := ARRAY['category']; ref_modules := ARRAY['meetings', 'appointments'];
      action_field := NULL; action_tables := NULL;
    WHEN 'appointment_statuses' THEN
      ref_fields := ARRAY['status']; ref_modules := ARRAY['meetings', 'appointments'];
      action_field := NULL; action_tables := NULL;
    WHEN 'appointment_locations' THEN
      ref_fields := ARRAY['location']; ref_modules := ARRAY['meetings', 'appointments'];
      action_field := NULL; action_tables := NULL;
    ELSE
      ref_fields := NULL; ref_modules := NULL; action_field := NULL; action_tables := NULL;
  END CASE;

  IF ref_fields IS NOT NULL AND to_regclass('public.automation_rules') IS NOT NULL THEN
    SELECT count(*) INTO rule_hits
    FROM public.automation_rules r
    WHERE (scope = 'global' OR r.tenant_id = office)
      AND r.module = ANY (ref_modules)
      AND (
        public.config_rename_conditions(r.conditions, ref_fields, old_pairs, new_name) IS DISTINCT FROM r.conditions
        OR public.config_rename_conditions(r.trigger_config, ref_fields, old_pairs, new_name) IS DISTINCT FROM r.trigger_config
        OR (action_field IS NOT NULL
            AND public.config_rename_action_field(r.actions, action_field, action_tables, old_pairs, new_name) IS DISTINCT FROM r.actions)
      );

    IF rule_hits > 0 THEN
      UPDATE public.automation_rules r
      SET conditions = public.config_rename_conditions(r.conditions, ref_fields, old_pairs, new_name),
          trigger_config = public.config_rename_conditions(r.trigger_config, ref_fields, old_pairs, new_name),
          actions = CASE
                      WHEN action_field IS NULL THEN r.actions
                      ELSE public.config_rename_action_field(r.actions, action_field, action_tables, old_pairs, new_name)
                    END
      WHERE (scope = 'global' OR r.tenant_id = office)
        AND r.module = ANY (ref_modules)
        AND (
          public.config_rename_conditions(r.conditions, ref_fields, old_pairs, new_name) IS DISTINCT FROM r.conditions
          OR public.config_rename_conditions(r.trigger_config, ref_fields, old_pairs, new_name) IS DISTINCT FROM r.trigger_config
          OR (action_field IS NOT NULL
              AND public.config_rename_action_field(r.actions, action_field, action_tables, old_pairs, new_name) IS DISTINCT FROM r.actions)
        );

      updated_refs := updated_refs || jsonb_build_array(jsonb_build_object(
        'key', 'automation_rules', 'label', 'Automatisierungsregel', 'count', rule_hits));
      total := total + rule_hits;
    END IF;
  END IF;

  -- Workflows haben keine Modulspalte; es wird nur unter den Feldnamen ersetzt.
  IF ref_fields IS NOT NULL AND to_regclass('public.workflow_definitions') IS NOT NULL THEN
    SELECT count(*) INTO workflow_hits
    FROM public.workflow_definitions w
    WHERE (scope = 'global' OR w.tenant_id = office)
      AND (
        public.config_rename_conditions(w.conditions, ref_fields, old_pairs, new_name) IS DISTINCT FROM w.conditions
        OR public.config_rename_conditions(w.trigger_config, ref_fields, old_pairs, new_name) IS DISTINCT FROM w.trigger_config
        OR public.config_rename_keys(w.actions, ref_fields, old_pairs, new_name) IS DISTINCT FROM w.actions
      );

    IF workflow_hits > 0 THEN
      UPDATE public.workflow_definitions w
      SET conditions = public.config_rename_conditions(w.conditions, ref_fields, old_pairs, new_name),
          trigger_config = public.config_rename_conditions(w.trigger_config, ref_fields, old_pairs, new_name),
          actions = public.config_rename_keys(w.actions, ref_fields, old_pairs, new_name)
      WHERE (scope = 'global' OR w.tenant_id = office)
        AND (
          public.config_rename_conditions(w.conditions, ref_fields, old_pairs, new_name) IS DISTINCT FROM w.conditions
          OR public.config_rename_conditions(w.trigger_config, ref_fields, old_pairs, new_name) IS DISTINCT FROM w.trigger_config
          OR public.config_rename_keys(w.actions, ref_fields, old_pairs, new_name) IS DISTINCT FROM w.actions
        );

      updated_refs := updated_refs || jsonb_build_array(jsonb_build_object(
        'key', 'workflow_definitions', 'label', 'Workflow', 'count', workflow_hits));
      total := total + workflow_hits;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'table', _table,
    'id', _id,
    'old_name', old_name,
    'new_name', new_name,
    'label', new_label,
    'total', total,
    'updated', updated_refs);
END $$;

REVOKE ALL ON FUNCTION public.config_rename_conditions(jsonb, text[], text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.config_rename_action_field(jsonb, text, text[], text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.config_rename_keys(jsonb, text[], text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rename_config_item(text, uuid, text, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_config_item(text, uuid, text, text, text, boolean, boolean) TO authenticated;
