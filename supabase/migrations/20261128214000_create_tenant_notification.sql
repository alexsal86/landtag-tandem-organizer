-- Mandantengebundene Meldung aus dem Client.
--
-- Die 6-Argument-Fassung von create_notification löst den Mandanten über den
-- Hauptmandanten der Empfängerin bzw. des Empfängers auf. Bei mehrfachen
-- Mitgliedschaften landet die Meldung damit im falschen Arbeitsbereich. Die
-- 7-Argument-Fassung ist für Clients gesperrt, weil sie den Mandanten ungeprüft
-- übernimmt.
--
-- Diese Funktion ist das schmale, geprüfte Primitiv dazwischen: Der Aufrufer nennt
-- den Mandanten des Fachobjekts, die Funktion prüft seine eigene Mitgliedschaft und
-- reicht erst dann an die 7-Argument-Fassung weiter. Die Empfängermitgliedschaft
-- prüft create_notification selbst und liefert sonst NULL.
CREATE OR REPLACE FUNCTION public.create_tenant_notification(
  user_id_param uuid,
  type_name text,
  title_param text,
  message_param text,
  data_param jsonb DEFAULT NULL,
  priority_param text DEFAULT 'medium',
  tenant_id_param uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501';
  END IF;
  IF tenant_id_param IS NULL THEN
    RAISE EXCEPTION 'Mandant fehlt.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_tenant_member(tenant_id_param, auth.uid()) THEN
    RAISE EXCEPTION 'Keine Mitgliedschaft im Mandanten.' USING ERRCODE = '42501';
  END IF;
  IF priority_param NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Ungültige Priorität: %', priority_param USING ERRCODE = '22023';
  END IF;

  RETURN public.create_notification(
    user_id_param,
    type_name,
    title_param,
    message_param,
    data_param,
    priority_param,
    tenant_id_param
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_notification(uuid, text, text, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_notification(uuid, text, text, text, jsonb, text, uuid) TO authenticated;
