-- Neuester Selbsttest-Lauf je Szenario für einen Mandanten.
--
-- Der System-Puls im Security-Cockpit braucht genau eine Zeile je Szenario.
-- Ein Zeilen-Limit auf selftest_runs verliert bei genügend Läufen ältere
-- Szenarien aus dem Fenster und zeigt sie fälschlich als "noch nie getestet".
-- DISTINCT ON liefert den neuesten Lauf unabhängig von der Anzahl der Läufe;
-- der bestehende Index (tenant_id, scenario_id, created_at DESC) trägt die
-- Sortierung.
--
-- SECURITY INVOKER: die RLS-Policy auf selftest_runs greift zusätzlich. Die
-- explizite Mitgliedsprüfung verhindert auch dann mandantenfremde Zeilen, wenn
-- die Funktion später auf SECURITY DEFINER umgestellt würde.

CREATE OR REPLACE FUNCTION public.get_latest_selftest_runs(p_tenant_id uuid)
RETURNS TABLE (scenario_id text, status text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (r.scenario_id)
    r.scenario_id,
    r.status,
    r.created_at
  FROM public.selftest_runs r
  WHERE r.tenant_id = p_tenant_id
    AND p_tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
  ORDER BY r.scenario_id, r.created_at DESC, r.id DESC;
$$;

COMMENT ON FUNCTION public.get_latest_selftest_runs(uuid) IS
  'Neuester Selbsttest-Lauf je Szenario eines Mandanten (RLS + explizite Mitgliedsprüfung).';

REVOKE ALL ON FUNCTION public.get_latest_selftest_runs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_latest_selftest_runs(uuid) TO authenticated;
