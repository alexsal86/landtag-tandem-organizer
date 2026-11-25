-- Puls-Qualität und Verlauf: Die neueste Zeile je Szenario liefert zusätzlich
-- App-Version, Demo-Kennzeichen und Aufräumstatus. Eine zweite RPC liefert die
-- letzten Läufe je Szenario für Verlauf, Wiederholungsfehler und Dauertrend.
--
-- Die Rückgabespalte von get_latest_selftest_runs ändert sich, deshalb wird die
-- Funktion neu angelegt (CREATE OR REPLACE kann OUT-Parameter nicht erweitern).

DROP FUNCTION IF EXISTS public.get_latest_selftest_runs(uuid);

CREATE FUNCTION public.get_latest_selftest_runs(p_tenant_id uuid)
RETURNS TABLE (
  scenario_id text,
  scenario_title text,
  status text,
  created_at timestamptz,
  duration_ms integer,
  failed_steps integer,
  total_steps integer,
  app_version text,
  keep_data boolean,
  cleanup jsonb,
  steps jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (r.scenario_id)
    r.scenario_id,
    r.scenario_title,
    r.status,
    r.created_at,
    r.duration_ms,
    r.failed_steps,
    r.total_steps,
    r.app_version,
    r.keep_data,
    r.cleanup,
    r.steps
  FROM public.selftest_runs r
  WHERE r.tenant_id = p_tenant_id
    AND p_tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
  ORDER BY r.scenario_id, r.created_at DESC, r.id DESC;
$$;

COMMENT ON FUNCTION public.get_latest_selftest_runs(uuid) IS
  'Neuester Selbsttest-Lauf je Szenario eines Mandanten inklusive Name, Dauer, Schrittzahlen, App-Version, Demo-/Aufräumstatus und Schritt-Ergebnissen (RLS + explizite Mitgliedsprüfung).';

REVOKE ALL ON FUNCTION public.get_latest_selftest_runs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_latest_selftest_runs(uuid) TO authenticated;

CREATE FUNCTION public.get_selftest_run_history(p_tenant_id uuid, p_runs_per_scenario integer DEFAULT 8)
RETURNS TABLE (
  scenario_id text,
  status text,
  created_at timestamptz,
  duration_ms integer,
  failed_steps integer,
  total_steps integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT scenario_id, status, created_at, duration_ms, failed_steps, total_steps
  FROM (
    SELECT
      r.scenario_id,
      r.status,
      r.created_at,
      r.duration_ms,
      r.failed_steps,
      r.total_steps,
      row_number() OVER (
        PARTITION BY r.scenario_id
        ORDER BY r.created_at DESC, r.id DESC
      ) AS rn
    FROM public.selftest_runs r
    WHERE r.tenant_id = p_tenant_id
      AND p_tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
  ) ranked
  WHERE rn <= GREATEST(1, LEAST(p_runs_per_scenario, 50))
  ORDER BY scenario_id, created_at DESC;
$$;

COMMENT ON FUNCTION public.get_selftest_run_history(uuid, integer) IS
  'Letzte Selbsttest-Läufe je Szenario eines Mandanten (Standard 8, maximal 50) für Verlauf und Dauertrend (RLS + explizite Mitgliedsprüfung).';

REVOKE ALL ON FUNCTION public.get_selftest_run_history(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_selftest_run_history(uuid, integer) TO authenticated;
