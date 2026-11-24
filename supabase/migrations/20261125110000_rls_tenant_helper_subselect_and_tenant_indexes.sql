-- Performance: RLS-Hilfsfunktion einmal pro Query statt pro Zeile + fehlende Mandanten-Indizes.
--
-- Problem 1 (Policy-Auswertung)
-- 271 Policies prüfen ihren Mandanten über
--   tenant_id = ANY (get_user_tenant_ids(auth.uid()))
-- get_user_tenant_ids ist STABLE, SECURITY DEFINER und liest user_tenant_memberships. In dieser
-- Form steht der Aufruf direkt im Policy-Ausdruck und wird für jede geprüfte Zeile (und je Policy)
-- erneut ausgewertet. Als skalare Subquery wird er zum InitPlan: Postgres wertet ihn einmal pro
-- Query aus und vergleicht danach nur noch gegen das Array. Das Ergebnis ist identisch, es ändert
-- sich ausschließlich der Ausführungsplan.
--
-- Der Cast ::uuid[] ist erforderlich, nicht kosmetisch: ANY ((SELECT …)) wird von Postgres als
-- Subquery-Form geparst und vergleicht dann uuid mit uuid[] ("operator does not exist: uuid =
-- uuid[]"). Erst der Cast auf den Array-Typ macht daraus die Array-Form ANY (array_expression).
--
-- Problem 2 (Index-Lücken)
-- profiles, appointments und meetings werden laufend nach tenant_id gefiltert, hatten dafür aber
-- keinen Index (nur user_id, calendar_uid, title, …). Ohne Index liest jede Liste die ganze Tabelle
-- und wirft die fremden Mandanten per RLS weg.
--
-- Beides ist additiv: keine Spalten, keine Daten, keine Semantik ändern sich. Die Policy-Umstellung
-- erhält Rollen, Kommando und PERMISSIVE/RESTRICTIVE unverändert (ALTER POLICY ohne TO) und ist
-- wiederholbar – bereits umgestellte Policies werden übersprungen.

-- 1) Rollback-Sicherung des Ausgangszustands.
--    Die Tabelle hält die Policy-Ausdrücke vor dem Rewrite, damit die Umstellung im Zweifel
--    gezielt zurückgenommen werden kann. RLS ohne Policy => nur service_role/owner lesen sie;
--    sie ist nicht Teil der Anwendungsoberfläche.
CREATE TABLE IF NOT EXISTS public.rls_policy_snapshot_20261124 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schema_name NAME NOT NULL,
  table_name NAME NOT NULL,
  policy_name NAME NOT NULL,
  permissive TEXT NOT NULL,
  roles NAME[] NOT NULL,
  cmd TEXT NOT NULL,
  qual TEXT,
  with_check TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schema_name, table_name, policy_name)
);

ALTER TABLE public.rls_policy_snapshot_20261124 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rls_policy_snapshot_20261124 FROM PUBLIC, anon, authenticated;

-- 2) Policy-Rewrite.
--    Es werden ausschließlich die beiden Aufruf-Formen ersetzt, die pg_get_expr für
--    get_user_tenant_ids mit auth.uid() erzeugt (siehe c_call). Das Muster ist klammergenau, damit
--    die umgebende ANY-Klammer und alle weiteren Bedingungen im Ausdruck erhalten bleiben. Jede
--    Policy ohne diesen Aufruf bleibt unangetastet. Enthält ein Ausdruck bereits eine
--    Subquery-Form, wird er übersprungen; die Nachkontrolle unten erzwingt, dass dabei kein roher
--    Aufruf übrig bleibt.
DO $rls_tenant_subselect$
DECLARE
  v_policy   record;
  v_using    TEXT;
  v_check    TEXT;
  v_changed  INTEGER := 0;
  v_skipped  INTEGER := 0;
  v_leftover INTEGER := 0;
  v_bad      TEXT := '';
  v_expr     TEXT;
  v_total_calls   INTEGER;
  v_wrapped_calls INTEGER;

  -- Bereits umgestellte Subquery-Form.
  c_wrapped CONSTANT TEXT := '\(\s*SELECT\s+(public\.)?get_user_tenant_ids';
  -- Roher Aufruf in beiden Deparse-Varianten, in EINEM Muster:
  --   Variante 1: get_user_tenant_ids(auth.uid())
  --   Variante 2: get_user_tenant_ids((SELECT auth.uid() [AS uid]))
  -- Die Alternation ist nötig, weil zwei sequenzielle Ersetzungen kaskadieren würden: die zweite
  -- würde den Aufruf innerhalb der gerade erzeugten Subquery erneut ersetzen. Aufbau: Aufrufname +
  -- Argument (Alternation) + schließende Klammer des Aufrufs. Diese Klammer steht bewusst
  -- AUSSERHALB der Alternation, damit beide Varianten genau eine Klammer konsumieren und die
  -- umgebende ANY-Klammer erhalten bleibt.
  c_call CONSTANT TEXT := 'get_user_tenant_ids\s*\(\s*(\(\s*SELECT\s+auth\.uid\(\)(\s+AS\s+uid)?\s*\)|auth\.uid\(\))\s*\)';
  -- Ersatz: skalare Subquery, per Cast in die Array-Form gebracht.
  c_replacement CONSTANT TEXT := '(SELECT public.get_user_tenant_ids(auth.uid()))::uuid[]';
  -- Präfix-Zähler für die Nachkontrolle (klammerunabhängig).
  c_call_uid       CONSTANT TEXT := 'get_user_tenant_ids\s*\(\s*(\(\s*SELECT\s+)?(public\.)?auth\.uid\(\)';
  c_call_uid_wrapped CONSTANT TEXT := 'SELECT\s+(public\.)?get_user_tenant_ids\s*\(\s*auth\.uid\(\)';
BEGIN
  FOR v_policy IN
    SELECT p.schemaname, p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND (p.qual LIKE '%get_user_tenant_ids%' OR p.with_check LIKE '%get_user_tenant_ids%')
     ORDER BY p.tablename, p.policyname
  LOOP
    INSERT INTO public.rls_policy_snapshot_20261124
      (schema_name, table_name, policy_name, permissive, roles, cmd, qual, with_check)
    VALUES
      (v_policy.schemaname, v_policy.tablename, v_policy.policyname, v_policy.permissive,
       v_policy.roles, v_policy.cmd, v_policy.qual, v_policy.with_check)
    ON CONFLICT (schema_name, table_name, policy_name) DO NOTHING;

    v_using := v_policy.qual;
    v_check := v_policy.with_check;

    -- Nur Ausdrücke ohne vorhandene Subquery-Form werden angefasst.
    IF v_using IS NOT NULL AND v_using !~* c_wrapped THEN
      v_using := regexp_replace(v_using, c_call, c_replacement, 'gi');
    END IF;
    IF v_check IS NOT NULL AND v_check !~* c_wrapped THEN
      v_check := regexp_replace(v_check, c_call, c_replacement, 'gi');
    END IF;

    IF v_using IS DISTINCT FROM v_policy.qual OR v_check IS DISTINCT FROM v_policy.with_check THEN
      IF v_using IS NOT NULL AND v_check IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
                       v_policy.policyname, v_policy.schemaname, v_policy.tablename, v_using, v_check);
      ELSIF v_using IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
                       v_policy.policyname, v_policy.schemaname, v_policy.tablename, v_using);
      ELSE
        EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
                       v_policy.policyname, v_policy.schemaname, v_policy.tablename, v_check);
      END IF;
      v_changed := v_changed + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  -- 3) Nachkontrolle: Subquery-Formen entfernen und prüfen, dass kein roher Aufruf übrig bleibt.
  FOR v_policy IN
    SELECT p.tablename, p.policyname, p.qual, p.with_check
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND (p.qual LIKE '%get_user_tenant_ids%' OR p.with_check LIKE '%get_user_tenant_ids%')
  LOOP
    FOREACH v_expr IN ARRAY ARRAY[v_policy.qual, v_policy.with_check]
    LOOP
      CONTINUE WHEN v_expr IS NULL;
      -- Zählung über den Aufruf-Präfix: klammerunabhängig und robust gegen die Alias- und
      -- Cast-Schreibweise, die pg_get_expr für eine Subquery erzeugt.
      v_total_calls := (SELECT count(*) FROM regexp_matches(v_expr, c_call_uid, 'gi') AS m);
      v_wrapped_calls := (SELECT count(*) FROM regexp_matches(v_expr, c_call_uid_wrapped, 'gi') AS m);
      IF v_total_calls > v_wrapped_calls THEN
        v_leftover := v_leftover + (v_total_calls - v_wrapped_calls);
        v_bad := v_bad || format(' %s.%s;', v_policy.tablename, v_policy.policyname);
      END IF;
    END LOOP;
  END LOOP;

  IF v_leftover > 0 THEN
    RAISE EXCEPTION 'RLS-Umstellung unvollständig: % Policy-Ausdrücke mit rohem Aufruf:%s',
      v_leftover, v_bad;
  END IF;

  RAISE NOTICE 'RLS-Umstellung: % Policies umgeschrieben, % unverändert.', v_changed, v_skipped;
END
$rls_tenant_subselect$;

-- 4) Fehlende Mandanten-Indizes.
--    Spaltenreihenfolge folgt den echten Zugriffen: führend tenant_id (RLS-Filter), danach die
--    Spalte, nach der sortiert/gefiltert wird. CONCURRENTLY ist hier bewusst nicht verwendet –
--    es läuft nicht in der Migrations-Transaktion. Auf einer sehr großen Produktionsdatenbank
--    können die drei Indizes vorab manuell mit CONCURRENTLY angelegt werden; IF NOT EXISTS
--    überspringt sie dann.
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_display_name
  ON public.profiles (tenant_id, display_name);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_start_time
  ON public.appointments (tenant_id, start_time);

CREATE INDEX IF NOT EXISTS idx_meetings_tenant_meeting_date
  ON public.meetings (tenant_id, meeting_date DESC);

-- Neue Indizes sofort in den Planer-Statistiken berücksichtigen.
ANALYZE public.profiles;
ANALYZE public.appointments;
ANALYZE public.meetings;

-- Rücknahme (manuell, nur bei Bedarf):
--   DO $rollback$
--   DECLARE r record;
--   BEGIN
--     FOR r IN SELECT * FROM public.rls_policy_snapshot_20261124 LOOP
--       EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', r.policy_name, r.schema_name, r.table_name, r.qual);
--     END LOOP;
--   END $rollback$;
--   DROP INDEX IF EXISTS public.idx_profiles_tenant_display_name;
--   DROP INDEX IF EXISTS public.idx_appointments_tenant_start_time;
--   DROP INDEX IF EXISTS public.idx_meetings_tenant_meeting_date;
