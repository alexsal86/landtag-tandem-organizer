-- Kontaktzusammenführung als eine einzige Datenbanktransaktion.
--
-- Bisher schrieb das Frontend Hauptkontakt, Verknüpfungen, Protokoll und
-- Löschung in getrennten Anfragen. Ein Fehler dazwischen ließ einen halb
-- zusammengeführten Datenbestand zurück: Notizen wurden erneut angehängt und
-- kollidierende Verknüpfungen verloren ihre Zusatzdaten.
--
-- merge_contacts erledigt alles in einem Aufruf. Jede Änderung läuft in einer
-- Transaktion; ein Fehler (auch eine durch RLS oder einen Trigger nicht
-- ausgeführte Zeile) bricht die gesamte Zusammenführung ab.
CREATE OR REPLACE FUNCTION public.merge_contacts(
  p_target uuid,
  p_source uuid,
  p_updates jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merger uuid := auth.uid();
  v_source public.contacts;
  v_target public.contacts;
  v_tenant uuid;
  v_allowed text[] := ARRAY[
    'name', 'first_name', 'last_name', 'title', 'position', 'organization', 'organization_id',
    'address', 'birthday', 'website', 'linkedin', 'facebook', 'instagram', 'mobile_phone',
    'business_phone', 'business_street', 'business_house_number', 'business_postal_code',
    'business_city', 'business_country', 'email', 'phone', 'notes', 'category', 'priority',
    'contact_type', 'gender', 'is_favorite', 'tags', 'avatar_url'
  ];
  v_unknown text[];
  v_sets text;
  v_link record;
  v_keys text[];
  v_match text;
  v_fill text;
  v_count integer;
  v_leftover integer;
  v_moved integer := 0;
  v_dropped integer := 0;
  v_activity uuid;
BEGIN
  IF v_merger IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet.' USING ERRCODE = '42501';
  END IF;
  IF p_target IS NULL OR p_source IS NULL OR p_target = p_source THEN
    RAISE EXCEPTION 'Haupt- und Zweitkontakt müssen verschieden sein.' USING ERRCODE = '22023';
  END IF;
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' THEN
    RAISE EXCEPTION 'Ungültige Kontaktdaten.' USING ERRCODE = '22023';
  END IF;

  -- Nur Felder, die die Zusammenführung tatsächlich zusammenführt. Identität,
  -- Büro, Eigentümer, Audit- und DSGVO-Felder bleiben unveränderlich; unbekannte
  -- Felder werden abgelehnt statt stillschweigend verworfen.
  SELECT coalesce(array_agg(k.name), '{}') INTO v_unknown
  FROM jsonb_object_keys(p_updates) AS k(name)
  WHERE k.name <> ALL (v_allowed);
  IF cardinality(v_unknown) > 0 THEN
    RAISE EXCEPTION 'Nicht zusammenführbare Felder: %', array_to_string(v_unknown, ', ') USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_source FROM public.contacts WHERE id = p_source;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Zweitkontakt nicht gefunden.' USING ERRCODE = '22023';
  END IF;
  v_tenant := v_source.tenant_id;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Büro.' USING ERRCODE = '42501';
  END IF;

  -- Zusammenführungen desselben Büros laufen nacheinander, beide Kontakte
  -- werden in stabiler Reihenfolge gesperrt (keine Verklemmung bei parallelen Aufrufen).
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text, 0));
  PERFORM 1 FROM public.contacts WHERE id IN (p_source, p_target) ORDER BY id FOR UPDATE;

  SELECT * INTO v_source FROM public.contacts WHERE id = p_source;
  SELECT * INTO v_target FROM public.contacts WHERE id = p_target;
  IF v_source.id IS NULL OR v_target.id IS NULL THEN
    RAISE EXCEPTION 'Kontakt nicht mehr vorhanden.' USING ERRCODE = '22023';
  END IF;
  IF v_source.tenant_id <> v_tenant OR v_target.tenant_id <> v_tenant THEN
    RAISE EXCEPTION 'Kontakte gehören nicht zum selben Büro.' USING ERRCODE = '42501';
  END IF;

  IF p_updates ? 'organization_id' AND jsonb_typeof(p_updates -> 'organization_id') <> 'null' THEN
    IF (p_updates ->> 'organization_id')::uuid = p_source THEN
      RAISE EXCEPTION 'Die gewählte Organisation ist der Zweitkontakt.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.contacts
      WHERE id = (p_updates ->> 'organization_id')::uuid AND tenant_id = v_tenant
    ) THEN
      RAISE EXCEPTION 'Die gewählte Organisation gehört nicht zum Büro.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_updates <> '{}'::jsonb THEN
    SELECT string_agg(format('%I = s.%I', k.name, k.name), ', ') INTO v_sets
    FROM jsonb_object_keys(p_updates) AS k(name);
    EXECUTE format(
      'UPDATE public.contacts AS c SET %s FROM jsonb_populate_record(NULL::public.contacts, $1) AS s WHERE c.id = $2 AND c.tenant_id = $3',
      v_sets
    ) USING p_updates, p_target, v_tenant;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Hauptkontakt konnte nicht aktualisiert werden.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_target FROM public.contacts WHERE id = p_target;

  -- Jede Spalte, die auf contacts zeigt: alle Fremdschlüssel plus alle
  -- contact_id-Spalten ohne Constraint (z. B. call_logs). Neue Verknüpfungen
  -- werden dadurch ohne Codeänderung mitgenommen.
  FOR v_link IN
    WITH refs AS (
      SELECT con.conrelid, con.conkey[1] AS attnum
      FROM pg_constraint con
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.contacts'::regclass
        AND array_length(con.conkey, 1) = 1
      UNION
      SELECT c.oid, a.attnum
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'contact_id' AND NOT a.attisdropped
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.oid <> 'public.contacts'::regclass
    )
    SELECT refs.conrelid AS relid, refs.attnum, c.relname AS table_name, a.attname AS column_name
    FROM refs
    JOIN pg_class c ON c.oid = refs.conrelid
    JOIN pg_attribute a ON a.attrelid = refs.conrelid AND a.attnum = refs.attnum
    ORDER BY c.relname, a.attname
  LOOP
    -- Konfliktspalten: der Unique-Index der Verknüpfungstabelle ohne contact_id.
    SELECT array_agg(a2.attname) INTO v_keys
    FROM pg_index i
    JOIN pg_attribute a2 ON a2.attrelid = i.indrelid AND a2.attnum = ANY (i.indkey)
    WHERE i.indexrelid = (
      SELECT i2.indexrelid FROM pg_index i2
      WHERE i2.indrelid = v_link.relid
        AND i2.indisunique AND i2.indisvalid AND i2.indpred IS NULL
        AND v_link.attnum = ANY (i2.indkey)
      ORDER BY i2.indexrelid
      LIMIT 1
    )
    AND a2.attnum <> v_link.attnum;

    IF v_keys IS NULL OR cardinality(v_keys) = 0 THEN
      -- Keine Paar-Eindeutigkeit: jede Zeile wandert unverändert mit.
      IF v_link.table_name = 'contacts' AND v_link.column_name = 'organization_id' THEN
        UPDATE public.contacts SET organization_id = p_target
          WHERE organization_id = p_source AND id <> p_target AND tenant_id = v_tenant;
        UPDATE public.contacts SET organization_id = NULL
          WHERE id = p_target AND organization_id = p_source;
      ELSE
        EXECUTE format(
          'UPDATE public.%I SET %I = $1 WHERE %I = $2',
          v_link.table_name, v_link.column_name, v_link.column_name
        ) USING p_target, p_source;
      END IF;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_moved := v_moved + v_count;
    ELSE
      SELECT string_agg(format('t.%1$I = s.%1$I', k), ' AND ') INTO v_match FROM unnest(v_keys) AS k;

      -- Kollision: Zusatzdaten der Zweitzeile in die erhaltene Zeile retten,
      -- bevor die Zweitzeile entfällt. Nutzungszähler sind additiv.
      IF v_link.table_name = 'contact_usage_stats' AND v_link.column_name = 'contact_id' THEN
        EXECUTE format(
          'UPDATE public.%1$I t SET usage_count = t.usage_count + s.usage_count, last_used_at = greatest(t.last_used_at, s.last_used_at)
             FROM public.%1$I s WHERE s.%2$I = $1 AND t.%2$I = $2 AND %3$s',
          v_link.table_name, v_link.column_name, v_match
        ) USING p_source, p_target;
      ELSE
        SELECT string_agg(format('%1$I = coalesce(t.%1$I, s.%1$I)', col.attname), ', ') INTO v_fill
        FROM pg_attribute col
        WHERE col.attrelid = v_link.relid
          AND col.attnum > 0 AND NOT col.attisdropped
          AND col.attgenerated = '' AND col.attidentity = ''
          AND col.attname <> v_link.column_name
          AND col.attname <> ALL (ARRAY['id'] || v_keys)
          AND col.attname NOT IN ('created_at', 'updated_at');
        IF v_fill IS NOT NULL THEN
          EXECUTE format(
            'UPDATE public.%1$I t SET %3$s FROM public.%1$I s WHERE s.%2$I = $1 AND t.%2$I = $2 AND %4$s',
            v_link.table_name, v_link.column_name, v_fill, v_match
          ) USING p_source, p_target;
        END IF;
      END IF;

      EXECUTE format(
        'DELETE FROM public.%1$I s USING public.%1$I t WHERE s.%2$I = $1 AND t.%2$I = $2 AND %3$s',
        v_link.table_name, v_link.column_name, v_match
      ) USING p_source, p_target;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_dropped := v_dropped + v_count;

      EXECUTE format(
        'UPDATE public.%1$I SET %2$I = $2 WHERE %2$I = $1',
        v_link.table_name, v_link.column_name
      ) USING p_source, p_target;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_moved := v_moved + v_count;
    END IF;

    -- Kein Verweis darf zurückbleiben, sonst würde das Löschen des Zweitkontakts
    -- ihn kaskadierend mitnehmen. Geprüft an den tatsächlich vorhandenen Zeilen.
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE %I = $1',
      v_link.table_name, v_link.column_name
    ) INTO v_leftover USING p_source;
    IF v_leftover > 0 THEN
      RAISE EXCEPTION 'Die Verknüpfung %.% konnte nicht verschoben werden (% Zeilen).',
        v_link.table_name, v_link.column_name, v_leftover USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  INSERT INTO public.contact_activities (contact_id, tenant_id, activity_type, title, description, created_by, metadata)
  VALUES (
    p_target, v_tenant, 'edit', 'Kontakte zusammengeführt',
    format('Kontakt "%s" und "%s" wurden zusammengeführt', v_target.name, v_source.name),
    v_merger,
    jsonb_build_object(
      'merged_contact_id', p_source,
      'merged_contact_name', v_source.name,
      'moved_links', v_moved,
      'dropped_links', v_dropped
    )
  )
  RETURNING id INTO v_activity;

  DELETE FROM public.contacts WHERE id = p_source AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Zweitkontakt konnte nicht gelöscht werden.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'target_id', p_target,
    'source_id', p_source,
    'tenant_id', v_tenant,
    'updated_fields', (
      SELECT coalesce(jsonb_agg(k.name ORDER BY k.name), '[]'::jsonb)
      FROM jsonb_object_keys(p_updates) AS k(name)
    ),
    'moved_links', v_moved,
    'dropped_links', v_dropped,
    'activity_id', v_activity
  );
END $$;

REVOKE ALL ON FUNCTION public.merge_contacts(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_contacts(uuid, uuid, jsonb) TO authenticated;
