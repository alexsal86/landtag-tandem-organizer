-- Modul-Steuerung der zentralen Themen für neue Büros
--
-- Bisher wurden topic_module_settings nur einmalig für die damals bestehenden
-- Mandanten angelegt (20261126090000, Abschnitt 5). Neue Büros starteten ohne
-- Zeilen: Die Oberfläche fiel über normalizeTopicModuleRule(null) auf Defaults
-- zurück, der Selbsttest-Schritt module-settings fand aber keine Zeile
-- case_items und meldete „Für dieses Büro fehlt die Modul-Zeile case_items".
--
-- Die Modul-Steuerung gehört zu den Standarddaten, die ein Büro ab dem ersten
-- Tag braucht. Sie wird deshalb – wie die Themen-Wolke – beim Anlegen über
-- einen Trigger auf tenants mitgeseedet und für bestehende Büros nachgezogen.
--
-- Reine Datenmigration: keine neue Tabelle, keine Schemaänderung.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Modul-Steuerung für ein Büro anlegen (idempotent, liefert neue Zeilen)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_topic_module_settings(p_tenant uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_tenant IS NULL OR NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant) THEN
    RAISE EXCEPTION 'Unbekanntes Büro' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.topic_module_settings (tenant_id, module)
  SELECT p_tenant, m.module
  FROM (VALUES
    ('tasks'), ('case_items'), ('case_files'), ('documents'), ('appointments'),
    ('decisions'), ('contacts'), ('knowledge_questions'), ('knowledge_documents'), ('map_flags')
  ) AS m(module)
  ON CONFLICT (tenant_id, module) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_topic_module_settings(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Bestehende Büros nachziehen
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT t.id FROM public.tenants t ORDER BY t.created_at LOOP
    PERFORM public.seed_topic_module_settings(r.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Neue Büros erhalten die Modul-Steuerung automatisch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_topic_module_settings_on_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.seed_topic_module_settings(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_topic_module_settings_on_tenant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seed_topic_module_settings ON public.tenants;
CREATE TRIGGER seed_topic_module_settings
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_topic_module_settings_on_tenant();

-- ---------------------------------------------------------------------------
-- 4) Selbsttest: ein neues Büro erhält alle zehn Module, mehrfach ohne Dubletten.
--    Läuft in einer Teilschachtelung und rollt am Ende alles zurück.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.topic_module_settings_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new uuid := gen_random_uuid();
  v_rows integer;
  v_modules integer;
  v_second integer;
  checks jsonb := '{}';
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_member(p_tenant, auth.uid()) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  BEGIN
    INSERT INTO public.tenants(id, name)
    VALUES (v_new, '[SELFTEST] Modul-Steuerung ' || substr(v_new::text, 1, 8));

    SELECT count(*), count(DISTINCT module) INTO v_rows, v_modules
    FROM public.topic_module_settings
    WHERE tenant_id = v_new;

    checks := jsonb_build_object(
      'rules_seeded', v_rows = 10,
      'all_modules', v_modules = 10,
      'defaults_active', NOT EXISTS (
        SELECT 1 FROM public.topic_module_settings
        WHERE tenant_id = v_new
          AND (is_enabled IS DISTINCT FROM true
            OR requirement IS DISTINCT FROM 'optional'
            OR creation_policy IS DISTINCT FROM 'admins'
            OR max_topics IS DISTINCT FROM 5)
      )
    );

    v_second := public.seed_topic_module_settings(v_new);
    checks := checks || jsonb_build_object(
      'idempotent',
      v_second = 0
        AND (SELECT count(*) FROM public.topic_module_settings WHERE tenant_id = v_new) = v_rows
    );

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX023';
  EXCEPTION
    WHEN SQLSTATE 'ZX023' THEN NULL;
    WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', NOT EXISTS (SELECT 1 FROM jsonb_each(checks) e WHERE e.value <> 'true'::jsonb),
    'checks', checks
  );
END;
$$;

REVOKE ALL ON FUNCTION public.topic_module_settings_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.topic_module_settings_selftest(uuid) TO authenticated;

COMMIT;
