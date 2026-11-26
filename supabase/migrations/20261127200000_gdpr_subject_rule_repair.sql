-- Kontakt-Beziehungen · „gegenstandUnveraenderlich“: Der Gegenstand einer
-- DSGVO-Anfrage ist in der Datenbank als unveränderlich gesperrt, die Sperre
-- wird aber nie erreicht.
--
-- 20261103234405 entzog authenticated das UPDATE auf public.gdpr_requests und
-- erteilte es nur noch für die Spalte status. Ein Update auf subject_email
-- scheitert damit an der Spaltenberechtigung (42501 „permission denied for
-- table gdpr_requests“). Die Regel aus gdpr_check_four_eyes („Anfragende
-- Person und Gegenstand der Anfrage sind unveränderlich.“) kommt nie zum Zug –
-- der Selbsttest sieht deshalb keinen Fehler mit dem Wort „unveränderlich“,
-- obwohl der Wert unverändert bleibt.
--
-- Die beiden Gegenstands-Spalten werden darum für authenticated schreibbar
-- gemacht; unveränderlich bleiben sie durch die Trigger. Bewusst nur diese
-- zwei: tenant_id, request_type und requested_by bleiben schon auf
-- Berechtigungsebene gesperrt.
--
-- Die Sperre selbst wird hier erneut gesetzt, damit sie auch auf Instanzen
-- greift, deren Reparatur-Bündel (20261127170000) nicht vollständig
-- durchgelaufen ist. Alle Schritte sind idempotent.

GRANT UPDATE (subject_email, subject_name) ON public.gdpr_requests TO authenticated;

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
