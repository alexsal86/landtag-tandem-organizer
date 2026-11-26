-- Fundament der modulübergreifenden Verschlagwortung über "Zentrale Themen".
--
-- Ziel dieser Migration:
--   1. Der Themenkatalog ist mandantensicher und bleibt beim Zusammenführen als
--      Weiterleitung erhalten (keine toten /themen/:id-Links mehr).
--   2. Jede Verknüpfung trägt tenant_id, wird per Composite-FK gegen fremde
--      Mandanten abgesichert und beim Schreiben automatisch befüllt.
--   3. Vorgänge (case_items) und Wissensfragen (knowledge_questions) erhalten
--      echte Verknüpfungstabellen; bestehende JSON-/Tag-Ablagen werden migriert.
--   4. Das Büro kann pro Modul Regeln hinterlegen (topic_module_settings).
--   5. topic_usage liefert die Verwendung je Modul für Admin-Liste und Impact.
--
-- Klassifikationen (Kategorien, Typen, Status, Orte, Prioritäten) bleiben
-- unverändert. Diese Migration fasst rename_config_item/delete_config_item nicht an.

-- ---------------------------------------------------------------------------
-- 1. Katalog härten
-- ---------------------------------------------------------------------------

ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.topics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

-- Für Composite-Fremdschlüssel der Verknüpfungstabellen erforderlich.
-- topics_tenant_id_id_responsibilities existiert bereits in älteren Ständen;
-- dann keinen zweiten Unique-Index auf dieselben Spalten anlegen.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'topics'
      AND indexname IN ('topics_tenant_id_id_key', 'topics_tenant_id_id_responsibilities')
  ) THEN
    CREATE UNIQUE INDEX topics_tenant_id_id_key ON public.topics(tenant_id, id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS topics_tenant_label_lookup ON public.topics(tenant_id, (lower(label)));

-- Doppelte Bezeichnungen innerhalb eines Büros verhindern. Vorhandene Dubletten
-- blockieren die Migration nicht, werden aber gemeldet; ensure_topic verhindert
-- neue Fälle zusätzlich über eine Label-Prüfung.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'topics_tenant_label_unique'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.topics
      WHERE tenant_id IS NOT NULL
      GROUP BY tenant_id, lower(label)
      HAVING count(*) > 1
    ) THEN
      RAISE NOTICE 'Zentrale Themen: doppelte Bezeichnungen vorhanden; eindeutiger Label-Index wird nicht angelegt.';
    ELSE
      CREATE UNIQUE INDEX topics_tenant_label_unique ON public.topics(tenant_id, (lower(label)));
    END IF;
  END IF;
END $$;

-- Themen ohne Mandant aus ihren bisherigen Verknüpfungen ableiten. Frühere
-- globale Themen werden nur übernommen, wenn alle Verknüpfungen in genau einem
-- Büro liegen.
DO $$
DECLARE
  v_deleted integer;
BEGIN
  UPDATE public.topics t
  SET tenant_id = s.tenant_id
  FROM (
    SELECT topic_id, (array_agg(DISTINCT tenant_id))[1] AS tenant_id
    FROM (
      SELECT tt.topic_id, p.tenant_id FROM public.task_topics tt JOIN public.tasks p ON p.id = tt.task_id
      UNION ALL
      SELECT ct.topic_id, p.tenant_id FROM public.case_file_topics ct JOIN public.case_files p ON p.id = ct.case_file_id
      UNION ALL
      SELECT dt.topic_id, p.tenant_id FROM public.document_topics dt JOIN public.documents p ON p.id = dt.document_id
      UNION ALL
      SELECT at.topic_id, p.tenant_id FROM public.appointment_topics at JOIN public.appointments p ON p.id = at.appointment_id
      UNION ALL
      SELECT ct.topic_id, p.tenant_id FROM public.contact_topics ct JOIN public.contacts p ON p.id = ct.contact_id
      UNION ALL
      SELECT tdt.topic_id, p.tenant_id FROM public.task_decision_topics tdt JOIN public.task_decisions p ON p.id = tdt.decision_id
      UNION ALL
      SELECT kdt.topic_id, p.tenant_id FROM public.knowledge_document_topics kdt JOIN public.knowledge_documents p ON p.id = kdt.document_id
      UNION ALL
      SELECT mft.topic_id, p.tenant_id FROM public.map_flag_topics mft JOIN public.map_flags p ON p.id = mft.flag_id
      UNION ALL
      SELECT er.topic_id, er.tenant_id FROM public.employee_responsibilities er WHERE er.topic_id IS NOT NULL
    ) links
    WHERE tenant_id IS NOT NULL
    GROUP BY topic_id
    HAVING count(DISTINCT tenant_id) = 1
  ) s
  WHERE t.id = s.topic_id AND t.tenant_id IS NULL;

  IF (SELECT count(*) FROM public.tenants) = 1 THEN
    UPDATE public.topics
    SET tenant_id = (SELECT id FROM public.tenants LIMIT 1)
    WHERE tenant_id IS NULL;
  END IF;

  SELECT count(*) INTO v_deleted FROM public.topics WHERE tenant_id IS NULL;
  IF v_deleted > 0 THEN
    RAISE NOTICE 'Zentrale Themen: % Themen ohne eindeutigen Mandanten bleiben vorerst ohne tenant_id.', v_deleted;
  ELSE
    ALTER TABLE public.topics ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- Inaktive Themen nur noch für die Büroleitung sichtbar; Mitglieder sehen den
-- aktiven Katalog.
DROP POLICY IF EXISTS "Tenant members can view topics" ON public.topics;
CREATE POLICY "Tenant members can view topics"
ON public.topics FOR SELECT TO authenticated
USING (
  public.user_belongs_to_tenant(tenant_id)
  AND (is_active OR public.is_tenant_config_admin(tenant_id))
);

-- ---------------------------------------------------------------------------
-- 2. Verknüpfungstabellen mandantensicher machen
-- ---------------------------------------------------------------------------

-- Setzt tenant_id aus dem Elternobjekt, verhindert Verknüpfungen über Büros
-- hinweg und füllt created_by. Damit bleiben bestehende Client-Schreibpfade
-- funktionsfähig, ohne dass sie tenant_id selbst mitschicken müssen.
CREATE OR REPLACE FUNCTION public.set_topic_link_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_table text := TG_ARGV[0];
  v_parent_col text := TG_ARGV[1];
  v_parent_id uuid;
  v_parent_tenant uuid;
  v_topic_tenant uuid;
BEGIN
  v_parent_id := (to_jsonb(NEW) ->> v_parent_col)::uuid;
  EXECUTE format('SELECT tenant_id FROM public.%I WHERE id = $1', v_parent_table)
    INTO v_parent_tenant USING v_parent_id;
  SELECT tenant_id INTO v_topic_tenant FROM public.topics WHERE id = NEW.topic_id;

  IF v_parent_tenant IS NULL OR v_topic_tenant IS NULL OR v_parent_tenant <> v_topic_tenant THEN
    RAISE EXCEPTION 'Thema und Objekt gehören nicht zum selben Büro.' USING ERRCODE = '22023';
  END IF;

  NEW.tenant_id := v_parent_tenant;
  NEW.created_by := coalesce(NEW.created_by, auth.uid());
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.set_topic_link_tenant() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  r record;
  v_count bigint;
  v_constraint text;
  v_index text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('task_topics', 'tasks', 'task_id'),
      ('case_file_topics', 'case_files', 'case_file_id'),
      ('document_topics', 'documents', 'document_id'),
      ('appointment_topics', 'appointments', 'appointment_id'),
      ('contact_topics', 'contacts', 'contact_id'),
      ('task_decision_topics', 'task_decisions', 'decision_id'),
      ('knowledge_document_topics', 'knowledge_documents', 'document_id'),
      ('map_flag_topics', 'map_flags', 'flag_id')
    ) AS v(tbl, parent, parent_col)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', r.tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid', r.tbl);

    EXECUTE format(
      'UPDATE public.%I x SET tenant_id = p.tenant_id FROM public.%I p WHERE p.id = x.%I AND x.tenant_id IS DISTINCT FROM p.tenant_id',
      r.tbl, r.parent, r.parent_col
    );

    -- Verknüpfungen auf Themen eines anderen Büros sind ungültig und werden
    -- entfernt (Sicherheitsfix; Anzahl wird protokolliert).
    EXECUTE format(
      'WITH d AS (DELETE FROM public.%I x USING public.topics t WHERE t.id = x.topic_id AND t.tenant_id IS DISTINCT FROM x.tenant_id RETURNING 1) SELECT count(*) FROM d',
      r.tbl
    ) INTO v_count;
    IF v_count > 0 THEN
      RAISE NOTICE 'Zentrale Themen: % mandantenfremde Verknüpfungen aus % entfernt.', v_count, r.tbl;
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id IS NULL', r.tbl) INTO v_count;
    IF v_count = 0 THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', r.tbl);
    ELSE
      RAISE NOTICE 'Zentrale Themen: % Verknüpfungen in % ohne Mandanten bleiben ohne NOT-NULL-Constraint.', v_count, r.tbl;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS set_topic_link_tenant ON public.%I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER set_topic_link_tenant BEFORE INSERT OR UPDATE OF %I, topic_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_topic_link_tenant(%L, %L)',
      r.parent_col, r.tbl, r.parent, r.parent_col
    );

    v_index := r.tbl || '_tenant_topic_idx';
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, topic_id)', v_index, r.tbl);

    v_constraint := r.tbl || '_tenant_topic_fkey';
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.tbl, v_constraint);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id, topic_id) REFERENCES public.topics(tenant_id, id) ON DELETE CASCADE NOT VALID',
      r.tbl, v_constraint
    );
    BEGIN
      EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', r.tbl, v_constraint);
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE NOTICE 'Zentrale Themen: % konnte nicht vollständig validiert werden.', v_constraint;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Vorgänge (case_items) erhalten eine echte Themenverknüpfung
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.case_item_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_item_id uuid NOT NULL REFERENCES public.case_items(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_item_id, topic_id),
  FOREIGN KEY (tenant_id, topic_id) REFERENCES public.topics(tenant_id, id) ON DELETE CASCADE
);

ALTER TABLE public.case_item_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Case item topics follow case item access" ON public.case_item_topics;
CREATE POLICY "Case item topics follow case item access"
ON public.case_item_topics FOR ALL TO authenticated
USING (
  public.user_can_access_case_item(auth.uid(), case_item_id)
  AND tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
)
WITH CHECK (
  public.user_can_access_case_item(auth.uid(), case_item_id)
  AND tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = case_item_topics.topic_id AND t.tenant_id = case_item_topics.tenant_id
  )
);

CREATE INDEX IF NOT EXISTS case_item_topics_tenant_topic_idx
  ON public.case_item_topics (tenant_id, topic_id);
CREATE INDEX IF NOT EXISTS case_item_topics_case_item_idx
  ON public.case_item_topics (case_item_id);

-- Bestehende Vorgänge tragen ihre Themen bisher nur im JSON-Feld.
INSERT INTO public.case_item_topics (tenant_id, case_item_id, topic_id)
SELECT ci.tenant_id, ci.id, coalesce(t.merged_into, t.id)
FROM public.case_items ci
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(ci.intake_payload -> 'topic_ids') = 'array'
       THEN ci.intake_payload -> 'topic_ids'
       ELSE '[]'::jsonb
  END
) AS e(value)
JOIN public.topics t
  ON t.tenant_id = ci.tenant_id
 AND t.id::text = e.value
ON CONFLICT (case_item_id, topic_id) DO NOTHING;

-- Neue Vorgänge schreiben weiterhin JSON; die Verknüpfung wird daraus gepflegt,
-- bis die Oberfläche auf set_entity_topics umgestellt ist.
CREATE OR REPLACE FUNCTION public.sync_case_item_topics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF coalesce(jsonb_typeof(NEW.intake_payload -> 'topic_ids'), 'null') <> 'array' THEN
    DELETE FROM public.case_item_topics WHERE case_item_id = NEW.id;
    RETURN NEW;
  END IF;

  DELETE FROM public.case_item_topics cit
  WHERE cit.case_item_id = NEW.id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(NEW.intake_payload -> 'topic_ids') AS e(value)
      JOIN public.topics t ON t.id::text = e.value AND t.tenant_id = NEW.tenant_id
      WHERE coalesce(t.merged_into, t.id) = cit.topic_id
    );

  INSERT INTO public.case_item_topics (tenant_id, case_item_id, topic_id, created_by)
  SELECT NEW.tenant_id, NEW.id, coalesce(t.merged_into, t.id), auth.uid()
  FROM jsonb_array_elements_text(NEW.intake_payload -> 'topic_ids') AS e(value)
  JOIN public.topics t ON t.id::text = e.value AND t.tenant_id = NEW.tenant_id
  ON CONFLICT (case_item_id, topic_id) DO NOTHING;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.sync_case_item_topics() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_case_item_topics ON public.case_items;
CREATE TRIGGER sync_case_item_topics
AFTER INSERT OR UPDATE OF intake_payload ON public.case_items
FOR EACH ROW EXECUTE FUNCTION public.sync_case_item_topics();

-- ---------------------------------------------------------------------------
-- 4. Wissensfragen erhalten eine Themenverknüpfung
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.knowledge_question_topics (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  topic_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, topic_id),
  FOREIGN KEY (tenant_id, question_id) REFERENCES public.knowledge_questions(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, topic_id) REFERENCES public.topics(tenant_id, id) ON DELETE CASCADE
);

ALTER TABLE public.knowledge_question_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_question_topics_read ON public.knowledge_question_topics;
CREATE POLICY knowledge_question_topics_read
ON public.knowledge_question_topics FOR SELECT TO authenticated
USING (public.knowledge_qa_can_access(tenant_id));

CREATE INDEX IF NOT EXISTS knowledge_question_topics_tenant_topic_idx
  ON public.knowledge_question_topics (tenant_id, topic_id);

-- Wissen-Tags wurden bisher per Trigger in topics gespiegelt; hier werden die
-- vorhandenen Zuordnungen auf Themen-IDs umgestellt.
INSERT INTO public.knowledge_question_topics (tenant_id, question_id, topic_id)
SELECT qt.tenant_id, qt.question_id, t.id
FROM public.knowledge_question_tags qt
JOIN public.knowledge_tags kt
  ON kt.id = qt.tag_id AND kt.tenant_id = qt.tenant_id
JOIN public.topics t
  ON t.tenant_id = qt.tenant_id
 AND lower(t.label) = lower(kt.name)
ON CONFLICT (question_id, topic_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Büro-Steuerung pro Modul
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.topic_module_settings (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN (
    'tasks', 'case_items', 'case_files', 'documents', 'appointments',
    'decisions', 'contacts', 'knowledge_questions', 'knowledge_documents', 'map_flags'
  )),
  is_enabled boolean NOT NULL DEFAULT true,
  requirement text NOT NULL DEFAULT 'optional' CHECK (requirement IN ('optional', 'required')),
  max_topics integer NOT NULL DEFAULT 5 CHECK (max_topics BETWEEN 1 AND 20),
  creation_policy text NOT NULL DEFAULT 'admins' CHECK (creation_policy IN ('admins', 'members')),
  show_filter boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module)
);

ALTER TABLE public.topic_module_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can read topic module settings" ON public.topic_module_settings;
CREATE POLICY "Tenant members can read topic module settings"
ON public.topic_module_settings FOR SELECT TO authenticated
USING (public.user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant admins can manage topic module settings" ON public.topic_module_settings;
CREATE POLICY "Tenant admins can manage topic module settings"
ON public.topic_module_settings FOR ALL TO authenticated
USING (public.is_tenant_config_admin(tenant_id))
WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP TRIGGER IF EXISTS update_topic_module_settings_updated_at ON public.topic_module_settings;
CREATE TRIGGER update_topic_module_settings_updated_at
BEFORE UPDATE ON public.topic_module_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Defaults bilden das bisherige Verhalten ab.
INSERT INTO public.topic_module_settings (tenant_id, module)
SELECT t.id, m.module
FROM public.tenants t
CROSS JOIN (VALUES
  ('tasks'), ('case_items'), ('case_files'), ('documents'), ('appointments'),
  ('decisions'), ('contacts'), ('knowledge_questions'), ('knowledge_documents'), ('map_flags')
) AS m(module)
ON CONFLICT (tenant_id, module) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Anlegen: Policy beachten, Slug-Kollisionen vermeiden
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._ensure_topic(p_tenant uuid, p_label text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_label text := regexp_replace(btrim(p_label), '\s+', ' ', 'g');
  v_base text;
  v_name text;
  v_order integer;
  v_try integer := 0;
  v_next uuid;
  v_hops integer := 0;
BEGIN
  IF v_label IS NULL OR length(v_label) < 2 OR length(v_label) > 40 THEN
    RAISE EXCEPTION 'Themen müssen 2–40 Zeichen lang sein.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_id
  FROM public.topics
  WHERE tenant_id = p_tenant AND lower(label) = lower(v_label)
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    -- Zusammengeführte Themen leiten auf ihr Ziel weiter.
    LOOP
      SELECT merged_into INTO v_next FROM public.topics WHERE id = v_id;
      EXIT WHEN v_next IS NULL;
      v_id := v_next;
      v_hops := v_hops + 1;
      IF v_hops > 10 THEN
        EXIT;
      END IF;
    END LOOP;
    RETURN v_id;
  END IF;

  v_base := public.topic_name_from_label(v_label);
  IF v_base IS NULL OR btrim(v_base) = '' THEN
    v_base := 'thema';
  END IF;

  -- Ein vorhandenes Thema mit gleichem Slug, aber anderem Label darf nicht
  -- vereinnahmt werden; stattdessen neuer Slug mit Suffix.
  LOOP
    v_name := CASE WHEN v_try = 0 THEN v_base ELSE v_base || '-' || (v_try + 1)::text END;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.topics WHERE tenant_id = p_tenant AND name = v_name
    );
    v_try := v_try + 1;
    IF v_try > 50 THEN
      RAISE EXCEPTION 'Für dieses Thema konnte kein eindeutiger Schlüssel gebildet werden.' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  SELECT coalesce(max(order_index), -1) + 1 INTO v_order
  FROM public.topics WHERE tenant_id = p_tenant;

  BEGIN
    INSERT INTO public.topics (tenant_id, name, label, icon, color, order_index, is_active, created_by)
    VALUES (p_tenant, v_name, v_label, 'Tag', '#64748b', v_order, true, auth.uid())
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id
    FROM public.topics
    WHERE tenant_id = p_tenant AND lower(label) = lower(v_label)
    LIMIT 1;
    IF v_id IS NULL THEN
      RAISE;
    END IF;
  END;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public._ensure_topic(uuid, text) FROM PUBLIC, anon, authenticated;

-- Die bisherige 2-Argument-Variante wird ersetzt, damit alle Aufrufer die
-- Modulprüfung nutzen können (Default hält bestehende Aufrufe kompatibel).
DROP FUNCTION IF EXISTS public.ensure_topic(uuid, text);

CREATE OR REPLACE FUNCTION public.ensure_topic(p_tenant uuid, p_label text, p_module text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_tenant(p_tenant) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  IF p_module IS NOT NULL THEN
    SELECT creation_policy INTO v_policy
    FROM public.topic_module_settings
    WHERE tenant_id = p_tenant AND module = p_module;

    IF coalesce(v_policy, 'admins') <> 'members'
       AND NOT public.is_tenant_config_admin(p_tenant) THEN
      RAISE EXCEPTION 'Neue Themen legt die Büroleitung an.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN public._ensure_topic(p_tenant, p_label);
END $$;

REVOKE ALL ON FUNCTION public.ensure_topic(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_topic(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Zusammenführen als Weiterleitung (Quelle bleibt erhalten)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.merge_topics(p_source uuid, p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.topics;
  t public.topics;
  r record;
  v_cond text;
  v_hops integer := 0;
  v_next uuid;
BEGIN
  SELECT * INTO s FROM public.topics WHERE id = p_source FOR UPDATE;
  IF s.id IS NULL THEN
    RAISE EXCEPTION 'Thema nicht gefunden.' USING ERRCODE = '22023';
  END IF;
  IF s.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Dieses Thema wurde bereits zusammengeführt.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO t FROM public.topics WHERE id = p_target FOR UPDATE;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Zielthema nicht gefunden.' USING ERRCODE = '22023';
  END IF;

  -- Ketten aus früheren Zusammenführungen bis zum endgültigen Ziel auflösen.
  LOOP
    v_next := t.merged_into;
    EXIT WHEN v_next IS NULL;
    v_hops := v_hops + 1;
    IF v_hops > 10 THEN
      RAISE EXCEPTION 'Zielthema verweist zu oft weiter.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO t FROM public.topics WHERE id = v_next FOR UPDATE;
  END LOOP;

  IF s.id = t.id OR s.tenant_id <> t.tenant_id THEN
    RAISE EXCEPTION 'Ungültige Themen' USING ERRCODE = '22023';
  END IF;
  IF NOT t.is_active THEN
    RAISE EXCEPTION 'Das Zielthema ist inaktiv.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_tenant_config_admin(s.tenant_id) THEN
    RAISE EXCEPTION 'Nur Abgeordnete und Büroleitung können Themen zusammenführen.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.topic_catalog_links
    WHERE topic_id IN (s.id, t.id)
  ) THEN
    RAISE EXCEPTION 'Umgewandelte Themen bitte über den Ausschuss- oder Regionskatalog zusammenführen.' USING ERRCODE = '22023';
  END IF;

  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
     AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'topic_id'
      AND c.table_name <> 'topics'
  LOOP
    SELECT string_agg(format('x.%1$I IS NOT DISTINCT FROM y.%1$I', column_name), ' AND ')
    INTO v_cond
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = r.table_name
      AND column_name NOT IN ('id', 'topic_id', 'created_at', 'updated_at', 'created_by');

    v_cond := coalesce(v_cond, 'true');

    EXECUTE format(
      'DELETE FROM public.%1$I x WHERE x.topic_id = $1 AND EXISTS (SELECT 1 FROM public.%1$I y WHERE y.topic_id = $2 AND %2$s)',
      r.table_name, v_cond
    ) USING s.id, t.id;

    EXECUTE format('UPDATE public.%I SET topic_id = $2 WHERE topic_id = $1', r.table_name)
      USING s.id, t.id;
  END LOOP;

  -- Weiterleitungen, die auf die Quelle zeigen, direkt auf das neue Ziel
  -- umlenken. So bleibt merged_into immer ein Ein-Hop-Verweis auf das
  -- endgültige Ziel, auch wenn später erneut zusammengeführt wird.
  UPDATE public.topics
  SET merged_into = t.id
  WHERE merged_into = s.id;

  UPDATE public.topics
  SET is_active = false,
      merged_into = t.id,
      merged_at = now(),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = s.id;
END $$;

REVOKE ALL ON FUNCTION public.merge_topics(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_topics(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Verwendung zählen
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.topic_usage(p_tenant uuid)
RETURNS TABLE (
  topic_id uuid,
  tasks bigint,
  case_items bigint,
  case_files bigint,
  documents bigint,
  appointments bigint,
  decisions bigint,
  contacts bigint,
  knowledge_questions bigint,
  knowledge_documents bigint,
  map_flags bigint,
  total bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_tenant(p_tenant) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    t.id AS topic_id,
    c.tasks,
    c.case_items,
    c.case_files,
    c.documents,
    c.appointments,
    c.decisions,
    c.contacts,
    c.knowledge_questions,
    c.knowledge_documents,
    c.map_flags,
    (c.tasks + c.case_items + c.case_files + c.documents + c.appointments
      + c.decisions + c.contacts + c.knowledge_questions + c.knowledge_documents
      + c.map_flags) AS total
  FROM public.topics t
  CROSS JOIN LATERAL (
    SELECT
      (SELECT count(*) FROM public.task_topics x WHERE x.topic_id = t.id) AS tasks,
      (SELECT count(*) FROM public.case_item_topics x WHERE x.topic_id = t.id) AS case_items,
      (SELECT count(*) FROM public.case_file_topics x WHERE x.topic_id = t.id) AS case_files,
      (SELECT count(*) FROM public.document_topics x WHERE x.topic_id = t.id) AS documents,
      (SELECT count(*) FROM public.appointment_topics x WHERE x.topic_id = t.id) AS appointments,
      (SELECT count(*) FROM public.task_decision_topics x WHERE x.topic_id = t.id) AS decisions,
      (SELECT count(*) FROM public.contact_topics x WHERE x.topic_id = t.id) AS contacts,
      (SELECT count(*) FROM public.knowledge_question_topics x WHERE x.topic_id = t.id) AS knowledge_questions,
      (SELECT count(*) FROM public.knowledge_document_topics x WHERE x.topic_id = t.id) AS knowledge_documents,
      (SELECT count(*) FROM public.map_flag_topics x WHERE x.topic_id = t.id) AS map_flags
  ) c
  WHERE t.tenant_id = p_tenant
  ORDER BY t.order_index, lower(t.label);
END $$;

REVOKE ALL ON FUNCTION public.topic_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.topic_usage(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Altbestand nachziehen (idempotent)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
  v_topic uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT tenant_id, btrim(t) AS tag, id
    FROM public.contacts, unnest(tags) t
    WHERE tenant_id IS NOT NULL AND length(btrim(t)) BETWEEN 2 AND 40
  LOOP
    v_topic := public._ensure_topic(r.tenant_id, r.tag);
    INSERT INTO public.contact_topics (tenant_id, contact_id, topic_id)
    VALUES (r.tenant_id, r.id, v_topic)
    ON CONFLICT (contact_id, topic_id) DO NOTHING;
  END LOOP;

  FOR r IN
    SELECT DISTINCT tenant_id, btrim(t) AS tag, id
    FROM public.case_files, unnest(tags) t
    WHERE tenant_id IS NOT NULL AND length(btrim(t)) BETWEEN 2 AND 40
  LOOP
    v_topic := public._ensure_topic(r.tenant_id, r.tag);
    INSERT INTO public.case_file_topics (tenant_id, case_file_id, topic_id)
    VALUES (r.tenant_id, r.id, v_topic)
    ON CONFLICT (case_file_id, topic_id) DO NOTHING;
  END LOOP;

  -- documents.tags enthält auch Systemwerte (knowledge:<id>, email, file);
  -- diese sind keine Nutzer-Themen und werden nicht übernommen.
  FOR r IN
    SELECT DISTINCT tenant_id, btrim(t) AS tag, id
    FROM public.documents, unnest(tags) t
    WHERE tenant_id IS NOT NULL
      AND length(btrim(t)) BETWEEN 2 AND 40
      AND lower(btrim(t)) NOT IN ('email', 'file')
      AND btrim(t) NOT LIKE 'knowledge:%'
  LOOP
    v_topic := public._ensure_topic(r.tenant_id, r.tag);
    INSERT INTO public.document_topics (tenant_id, document_id, topic_id)
    VALUES (r.tenant_id, r.id, v_topic)
    ON CONFLICT (document_id, topic_id) DO NOTHING;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
