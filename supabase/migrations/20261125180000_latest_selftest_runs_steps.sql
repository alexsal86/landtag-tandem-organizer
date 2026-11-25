-- Schritt-Ergebnisse für den System-Puls: die RPC liefert jetzt zusätzlich
-- das in selftest_runs.steps gespeicherte JSONB (id, label, status, message).
--
-- Die Rückgabespalte ändert sich, deshalb muss die Funktion neu angelegt
-- werden; CREATE OR REPLACE kann den OUT-Parametersatz nicht erweitern.

DROP FUNCTION IF EXISTS public.get_latest_selftest_runs(uuid);

CREATE FUNCTION public.get_latest_selftest_runs(p_tenant_id uuid)
RETURNS TABLE (scenario_id text, status text, created_at timestamptz, steps jsonb)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (r.scenario_id)
    r.scenario_id,
    r.status,
    r.created_at,
    r.steps
  FROM public.selftest_runs r
  WHERE r.tenant_id = p_tenant_id
    AND p_tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
  ORDER BY r.scenario_id, r.created_at DESC, r.id DESC;
$$;

COMMENT ON FUNCTION public.get_latest_selftest_runs(uuid) IS
  'Neuester Selbsttest-Lauf je Szenario eines Mandanten inklusive Schritt-Ergebnissen (RLS + explizite Mitgliedsprüfung).';

REVOKE ALL ON FUNCTION public.get_latest_selftest_runs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_latest_selftest_runs(uuid) TO authenticated;
