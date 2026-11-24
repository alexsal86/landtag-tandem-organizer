-- Folgenabschätzung vor dem Löschen von Konfiguration (Kategorien, Status, Typen, Orte).
--
-- Die Kategorie-/Status-/Typ-Editoren löschen bisher ohne Auskunft, wie viele
-- Datensätze den Eintrag verwenden. Diese Funktion zählt die Verwendungen
-- serverseitig, damit die Anzeige nicht von der Seitengröße der UI-Listen abhängt
-- und keine RLS-Lücke einzelne Verwendungen verbirgt. Sie entscheidet nichts,
-- sondern liefert nur Zahlen; der Admin bestätigt danach bewusst.
--
-- Referenzen liegen überwiegend als Text (name/label) in den Fachdatensätzen;
-- nur ToDo-Kategorien sind per Fremdschlüssel (mit ON DELETE CASCADE) verknüpft.
-- Bürobezogene Konfiguration zählt im eigenen Büro, plattformweite Konfiguration
-- (task_statuses, todo_categories) zählt büroübergreifend und erfordert Plattformrechte.

CREATE OR REPLACE FUNCTION public.config_delete_impact(_table text, _id uuid)
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

REVOKE ALL ON FUNCTION public.config_delete_impact(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.config_delete_impact(text, uuid) TO authenticated;
