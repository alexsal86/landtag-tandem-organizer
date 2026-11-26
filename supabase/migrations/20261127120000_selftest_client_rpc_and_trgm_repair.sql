-- Reparatur der verbleibenden Selbsttest-Meldungen aus Kontakte, Aufgaben und
-- Personal. Alle Schritte sind idempotent und ändern keine Daten.
--
-- 1) find_contact_duplicates_trgm vergleicht Namen, E-Mails und Telefonnummern
--    mit similarity() und dem %-Operator aus pg_trgm. Seit 20260308154438 liegt
--    pg_trgm im Schema extensions; die Funktion arbeitet aber mit
--    search_path=public. Jeder Aufruf endete deshalb mit 42883
--    "function similarity(text, text) does not exist".
-- 2) 20261119200036 entzog authenticated die Ausführung von
--    assign_contact_to_organization und handover_tasks_to_deputy. Beide sind
--    dokumentierte Client-Schnittstellen (Kontakte bzw. Offboarding) und werden
--    von Oberfläche und Selbsttest direkt aufgerufen; ohne EXECUTE antwortet
--    PostgREST mit 42501 "permission denied for function".
--    assign_contact_to_organization lief dabei als SECURITY DEFINER ohne eigene
--    Büroprüfung; die Funktion prüft die Zugehörigkeit jetzt selbst, bevor sie
--    die Zuordnung schreibt.
-- 3) create_decision_task war mit der vom Client genutzten Signatur
--    (p_decision_id) nicht im PostgREST-Schema-Cache (PGRST202). Die Funktion
--    wird mit dem Rumpf aus 20261107150000 neu angelegt.

-- 1) Trigramm-Funktionen mit dem Schema der Extension ausführen.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'find_contact_duplicates_trgm'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', fn.signature);
  END LOOP;
END $$;

-- 2a) Kontakt-Zuordnung: Büroprüfung in der Funktion, danach Client-Recht.
CREATE OR REPLACE FUNCTION public.assign_contact_to_organization(contact_id uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.contacts%ROWTYPE; o public.contacts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.contacts WHERE id = contact_id;
  IF NOT FOUND OR NOT (CASE WHEN c.tenant_id IS NULL THEN c.user_id = auth.uid()
                            ELSE public.is_tenant_member(c.tenant_id, auth.uid()) END) THEN
    RAISE EXCEPTION 'Kein Zugriff auf den Kontakt' USING ERRCODE = '42501';
  END IF;
  IF org_id IS NOT NULL THEN
    SELECT * INTO o FROM public.contacts WHERE id = org_id;
    IF NOT FOUND OR NOT (CASE WHEN o.tenant_id IS NULL THEN o.user_id = auth.uid()
                              ELSE public.is_tenant_member(o.tenant_id, auth.uid()) END)
       OR (c.tenant_id IS NOT NULL AND o.tenant_id IS NOT NULL AND o.tenant_id <> c.tenant_id) THEN
      RAISE EXCEPTION 'Organisation gehört nicht zum Büro' USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.contacts SET organization_id = org_id, updated_at = now() WHERE id = contact_id;
END $$;

REVOKE ALL ON FUNCTION public.assign_contact_to_organization(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_contact_to_organization(uuid, uuid) TO authenticated;

-- 2b) Vertretungsübergabe: Rolle und Empfänger prüft die Funktion selbst.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handover_tasks_to_deputy' AND p.pronargs = 3
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.signature);
  END LOOP;
END $$;

-- 3) Entscheidung atomar verknüpfen: Signatur mit dem Client-Parameternamen.
DROP FUNCTION IF EXISTS public.create_decision_task(uuid);
CREATE FUNCTION public.create_decision_task(p_decision_id uuid) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE d public.task_decisions%ROWTYPE; result uuid; file_id uuid; yes_count int; no_count int; outcome text;
BEGIN
 SELECT * INTO d FROM task_decisions WHERE id=p_decision_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Kein Zugriff auf die Entscheidung' USING ERRCODE='42501'; END IF;
 SELECT id INTO result FROM tasks WHERE tenant_id=d.tenant_id AND source_type='decision' AND source_id=d.id LIMIT 1;
 IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT count(*) FILTER(WHERE response_type='yes'),count(*) FILTER(WHERE response_type='no') INTO yes_count,no_count
 FROM (SELECT DISTINCT ON (participant_id) participant_id,response_type FROM task_decision_responses WHERE decision_id=d.id ORDER BY participant_id,created_at DESC) latest;
 outcome:=CASE WHEN yes_count>no_count THEN 'Angenommen' WHEN no_count>yes_count THEN 'Abgelehnt' ELSE 'Unentschieden' END;
 INSERT INTO tasks(user_id,tenant_id,title,description,assigned_to,priority,category,status,source_type,source_id)
 VALUES(auth.uid(),d.tenant_id,'[Entscheidung] '||d.title,concat_ws(E'\n',d.description,'Ergebnis: '||outcome||' (Ja: '||yes_count||', Nein: '||no_count||')'),auth.uid()::text,'medium','personal','todo','decision',d.id) RETURNING id INTO result;
 file_id:=d.case_file_id;
 IF file_id IS NULL AND d.case_item_id IS NOT NULL THEN SELECT case_file_id INTO file_id FROM case_items WHERE id=d.case_item_id; END IF;
 IF file_id IS NOT NULL THEN INSERT INTO case_file_tasks(case_file_id,task_id) VALUES(file_id,result); END IF;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.create_decision_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_decision_task(uuid) TO authenticated;

-- 4) Der Gegenstand einer DSGVO-Anfrage war in der Datenbank nicht geschützt:
--    Betroffenenkonto, Name und Art ließen sich nach dem Anlegen überschreiben.
--    Der Selbsttest verlangt genau diese Sperre ("unveränderlich").
CREATE OR REPLACE FUNCTION public.guard_gdpr_request_subject()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.subject_email, NEW.subject_name, NEW.request_type, NEW.requested_by)
     IS DISTINCT FROM (OLD.subject_email, OLD.subject_name, OLD.request_type, OLD.requested_by) THEN
    RAISE EXCEPTION 'Der Gegenstand einer DSGVO-Anfrage ist unveränderlich.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gdpr_request_subject ON public.gdpr_requests;
CREATE TRIGGER trg_gdpr_request_subject
  BEFORE UPDATE ON public.gdpr_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_gdpr_request_subject();

NOTIFY pgrst, 'reload schema';
