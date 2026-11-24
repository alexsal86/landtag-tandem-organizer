-- Umbenennen von Konfiguration zieht die referenzierten Werte mit.
--
-- Die Fachdaten speichern den stabilen Schlüssel `name` (ältere Datensätze auch
-- `label`) als Text. Ein reines UPDATE der Konfigurationszeile ließ diese Werte
-- zurück, sodass Folgenabschätzung und Filter danach „keine Verwendung" meldeten.
-- rename_config_item aktualisiert deshalb Konfiguration und alle Verweise in einer
-- Transaktion. Die sichere Variante:
--   * nur bekannte Konfigurationstabellen, rollen-/bürogeprüft,
--   * neuer name wird serverseitig gebildet (gleiche Regel wie im Editor),
--   * Umbenennen wird abgelehnt, wenn die bisherige Bezeichnung nicht eindeutig ist
--     (sonst würden Verweise eines anderen Eintrags mitwandern) oder die neue
--     Bezeichnung bereits vergeben ist,
--   * Verweise werden auf den neuen name normalisiert (auch alte label-Werte),
--     Status-Arrays ohne Duplikate und in ihrer Reihenfolge fortgeschrieben.

CREATE OR REPLACE FUNCTION public.config_item_name(_label text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = 'public' AS $$
  SELECT regexp_replace(lower(btrim(_label)), '\s+', '_', 'g')
$$;

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
    updated_refs := jsonb_build_array(jsonb_build_object(
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
    total := hit;
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

REVOKE ALL ON FUNCTION public.config_item_name(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rename_config_item(text, uuid, text, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.config_item_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_config_item(text, uuid, text, text, text, boolean, boolean) TO authenticated;
