-- Löschen von Konfiguration nur noch mit geprüfter Folgenabschätzung.
--
-- Bisher sperrte nur der Dialog den Knopf; ein direkter DELETE auf die Tabelle
-- umging die Zählung vollständig. Jetzt gibt es genau einen Weg:
--   * config_item_references zählt die Verwendungen (eine Quelle für Dialog,
--     Umbenennen und Löschen, damit Auskunft und Durchsetzung nicht auseinanderlaufen),
--   * delete_config_item zählt erneut, verlangt die Bestätigung der angezeigten
--     Zahl und löscht erst dann,
--   * ein BEFORE-DELETE-Trigger auf allen Konfigurationstabellen weist jeden
--     direkten Zugriff ab, der nicht aus delete_config_item kommt.
--
-- Der Trigger blockiert auch Owner/Service-Role. Datenmigrationen, die wirklich
-- Einträge entfernen müssen, deaktivieren den Trigger bewusst explizit.

-- 1. Gemeinsamer Zählkern (Definition aus 20261124230000, unverändert im Ergebnis).
CREATE OR REPLACE FUNCTION public.config_item_references(_table text, _id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  scope text;
  office uuid;
  item_name text;
  item_label text;
  refs jsonb := '[]'::jsonb;
  total integer := 0;
  hit integer;
  label_pairs text[];
BEGIN
  IF _table IS NULL OR _id IS NULL THEN
    RAISE EXCEPTION 'Konfiguration und Eintrag sind erforderlich' USING ERRCODE = '22023';
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
      INTO office, item_name, item_label USING _id;
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
      INTO item_name, item_label USING _id;
    IF item_name IS NULL THEN
      RAISE EXCEPTION 'Eintrag nicht gefunden' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- name ist der stabile Schlüssel; ältere Datensätze können den Anzeigenamen tragen.
  label_pairs := ARRAY[item_name, item_label];

  IF _table = 'task_categories' THEN
    SELECT count(*) INTO hit FROM public.tasks
    WHERE tenant_id = office AND category = ANY (label_pairs);
    IF hit > 0 THEN
      refs := refs || jsonb_build_array(jsonb_build_object('key', 'tasks', 'label', 'Aufgabe', 'count', hit));
      total := total + hit;
    END IF;

  ELSIF _table = 'task_statuses' THEN
    SELECT count(*) INTO hit FROM public.tasks
    WHERE status = ANY (label_pairs);
    IF hit > 0 THEN
      refs := refs || jsonb_build_array(jsonb_build_object('key', 'tasks', 'label', 'Aufgabe', 'count', hit));
      total := total + hit;
    END IF;

  ELSIF _table = 'todo_categories' THEN
    SELECT count(*) INTO hit FROM public.todos
    WHERE category_id = _id;
    IF hit > 0 THEN
      refs := refs || jsonb_build_array(jsonb_build_object('key', 'todos', 'label', 'ToDo', 'count', hit));
      total := total + hit;
    END IF;

  ELSIF _table = 'case_file_types' THEN
    SELECT count(*) INTO hit FROM public.case_files
    WHERE tenant_id = office AND case_type = ANY (label_pairs);
    IF hit > 0 THEN
      refs := refs || jsonb_build_array(jsonb_build_object('key', 'case_files', 'label', 'Fallakte', 'count', hit));
      total := total + hit;
    END IF;

  ELSIF _table = 'case_file_processing_statuses' THEN
    SELECT count(*) INTO hit FROM public.case_files
    WHERE tenant_id = office
      AND (processing_status = ANY (label_pairs) OR processing_statuses && label_pairs);
    IF hit > 0 THEN
      refs := refs || jsonb_build_array(jsonb_build_object('key', 'case_files', 'label', 'Fallakte', 'count', hit));
      total := total + hit;
    END IF;

  ELSIF _table = 'document_categories' THEN
    SELECT count(*) INTO hit FROM public.documents
    WHERE tenant_id = office AND category = ANY (label_pairs);
    IF hit > 0 THEN
      refs := refs || jsonb_build_array(jsonb_build_object('key', 'documents', 'label', 'Dokument', 'count', hit));
      total := total + hit;
    END IF;

  ELSIF _table = 'appointment_categories' THEN
    SELECT count(*) INTO hit FROM public.appointments
    WHERE tenant_id = office AND category = ANY (label_pairs);
    IF hit > 0 THEN
      refs := refs || jsonb_build_array(jsonb_build_object('key', 'appointments', 'label', 'Termin', 'count', hit));
      total := total + hit;
    END IF;

  ELSIF _table = 'appointment_statuses' THEN
    SELECT count(*) INTO hit FROM public.appointments
    WHERE tenant_id = office AND status = ANY (label_pairs);
    IF hit > 0 THEN
      refs := refs || jsonb_build_array(jsonb_build_object('key', 'appointments', 'label', 'Termin', 'count', hit));
      total := total + hit;
    END IF;

  ELSIF _table = 'appointment_locations' THEN
    SELECT count(*) INTO hit FROM public.appointments
    WHERE tenant_id = office
      AND (location = ANY (label_pairs) OR location = _id::text);
    IF hit > 0 THEN
      refs := refs || jsonb_build_array(jsonb_build_object('key', 'appointments', 'label', 'Termin', 'count', hit));
      total := total + hit;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'table', _table,
    'id', _id,
    'label', COALESCE(item_label, item_name),
    'scope', scope,
    'total', total,
    'references', refs);
END $$;

-- 2. Auskunft für den Dialog bleibt dieselbe Hülle über dem Zählkern.
CREATE OR REPLACE FUNCTION public.config_delete_impact(_table text, _id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT public.config_item_references(_table, _id)
$$;

-- 3. Löschen mit erneuter Zählung und Bestätigung der angezeigten Zahl.
CREATE OR REPLACE FUNCTION public.delete_config_item(
  _table text,
  _id uuid,
  _expected_refs integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  refs jsonb;
  total integer;
BEGIN
  IF _expected_refs IS NULL OR _expected_refs < 0 THEN
    RAISE EXCEPTION 'Die bestätigte Anzahl Verwendungen fehlt' USING ERRCODE = '22023';
  END IF;

  -- Zählt erneut und prüft dabei Tabelle, Geltungsbereich und Berechtigung.
  refs := public.config_item_references(_table, _id);
  total := (refs->>'total')::integer;

  -- Der Admin bestätigt die Zahl, die er gesehen hat. Weicht sie inzwischen ab,
  -- wurde entweder parallel etwas angelegt oder die Auskunft war unvollständig:
  -- dann nicht löschen, sondern erneut prüfen lassen.
  IF total <> _expected_refs THEN
    RAISE EXCEPTION 'Die Verwendungen haben sich seit der Prüfung geändert: % statt %. Bitte erneut prüfen.',
      total, _expected_refs
      USING ERRCODE = '55000';
  END IF;

  -- Transaktionslokale Freigabe für den Guard-Trigger; nur dieser Aufruf setzt sie.
  PERFORM set_config('app.config_delete_approval', _table || ':' || _id::text, true);

  EXECUTE format('DELETE FROM public.%I WHERE id = $1', _table) USING _id;

  RETURN refs || jsonb_build_object('deleted', true, 'confirmed', _expected_refs);
END $$;

-- 4. Netz für Direktzugriffe: DELETE ohne Freigabe aus delete_config_item wird abgewiesen.
CREATE OR REPLACE FUNCTION public.config_delete_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
DECLARE
  approval text;
BEGIN
  approval := current_setting('app.config_delete_approval', true);
  IF approval IS DISTINCT FROM (TG_TABLE_NAME || ':' || OLD.id::text) THEN
    RAISE EXCEPTION 'Konfiguration kann nur über delete_config_item gelöscht werden, damit die Folgenabschätzung geprüft ist'
      USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END $$;

DO $$
DECLARE
  config_table text;
BEGIN
  FOREACH config_table IN ARRAY ARRAY[
    'task_categories', 'task_statuses', 'todo_categories', 'case_file_types',
    'document_categories', 'appointment_categories', 'appointment_statuses',
    'appointment_locations', 'case_file_processing_statuses'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS config_delete_guard_before ON public.%I', config_table);
    EXECUTE format(
      'CREATE TRIGGER config_delete_guard_before BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.config_delete_guard()',
      config_table);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.config_item_references(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.config_delete_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.config_delete_impact(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_config_item(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.config_delete_impact(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_config_item(text, uuid, integer) TO authenticated;
