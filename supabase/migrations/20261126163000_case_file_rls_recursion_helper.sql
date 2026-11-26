-- Fallakten: 42P17 "infinite recursion detected in policy for relation case_files".
--
-- Die SELECT-Regel von case_files prüft die Teilnahme über eine Unterabfrage auf
-- case_file_participants. Deren SELECT-Regel (20261112005437, "Tenant members can
-- view case file participants") prüft den Zugriff über case_files. PostgreSQL
-- wertet beim Lesen von case_files die Teilnehmerregel mit aus, die wieder
-- case_files liest – der Zyklus bricht das Anlegen einer Akte ab, weil
-- `insert(...).select()` (INSERT ... RETURNING) die SELECT-Regel braucht.
--
-- Die Teilnehmerregel bleibt tenant-gebunden; ein offener Lesezugriff wie in der
-- Notlösung 20260208203051 kommt nicht zurück. Stattdessen prüft die Aktenregel
-- die Teilnahme über eine SECURITY-DEFINER-Funktion. Sie liest
-- case_file_participants ohne deren Regeln und kann deshalb nicht erneut in die
-- Aktenregel laufen. Die Tenant-Prüfung bleibt in der Aktenregel selbst: ein
-- Teilnehmereintrag aus einem anderen Büro öffnet keine Akte, weil die
-- Mitgliedschaftsprüfung davor greift.

CREATE OR REPLACE FUNCTION public.is_case_file_participant(_user_id uuid, _case_file_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.case_file_participants AS participant
    WHERE participant.case_file_id = _case_file_id
      AND participant.user_id = _user_id
  );
$$;

COMMENT ON FUNCTION public.is_case_file_participant(uuid, uuid) IS
  'Teilnahme an einer Akte ohne Auswertung der Teilnehmerregeln; verhindert den Policy-Zyklus zwischen case_files und case_file_participants.';

REVOKE ALL ON FUNCTION public.is_case_file_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_case_file_participant(uuid, uuid) TO authenticated;

-- Inhaltlich unverändert: gleiche Sichtbarkeit (Büro, öffentlich, eigene Akte,
-- Teilnahme), nur die Teilnahme kommt jetzt aus dem Helfer statt aus der
-- rekursiven Unterabfrage.
DROP POLICY IF EXISTS "Users can view accessible case files" ON public.case_files;

CREATE POLICY "Users can view accessible case files"
  ON public.case_files FOR SELECT
  USING (
    tenant_id IN (
      SELECT utm.tenant_id FROM public.user_tenant_memberships utm
      WHERE utm.user_id = auth.uid() AND utm.is_active = true
    )
    AND (
      visibility = 'public'
      OR user_id = auth.uid()
      OR public.is_case_file_participant(auth.uid(), id)
    )
  );
