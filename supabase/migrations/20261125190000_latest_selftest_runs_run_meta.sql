-- Lauf-Metadaten für das Security-Cockpit: zusätzlich zum Status und den
-- Schritt-Ergebnissen liefert die RPC den gespeicherten Testnamen, die Dauer
-- und die Zahl der fehlgeschlagenen bzw. ausgeführten Schritte.
--
-- Die Rückgabespalte ändert sich, deshalb muss die Funktion neu angelegt
-- werden; CREATE OR REPLACE kann den OUT-Parametersatz nicht erweitern.

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
    r.steps
  FROM public.selftest_runs r
  WHERE r.tenant_id = p_tenant_id
    AND p_tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
  ORDER BY r.scenario_id, r.created_at DESC, r.id DESC;
$$;

COMMENT ON FUNCTION public.get_latest_selftest_runs(uuid) IS
  'Neuester Selbsttest-Lauf je Szenario eines Mandanten inklusive Name, Dauer, Schrittzahlen und Schritt-Ergebnissen (RLS + explizite Mitgliedsprüfung).';

REVOKE ALL ON FUNCTION public.get_latest_selftest_runs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_latest_selftest_runs(uuid) TO authenticated;
