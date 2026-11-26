-- Versandstatus verliert beim Archivieren den Absender.
--
-- Der Selbsttest „letter-lifecycle“ meldete im Schritt „Versandstatus,
-- Archiv-PDF und Folgeaufgabe über Anwendungsfunktion“ genau eine Abweichung:
-- `sent_by` Soll <aufrufender Benutzer>, Ist null. Status, workflow_locked und
-- archived_document_id stimmten, das Archiv-PDF und die Folgeaufgabe entstanden.
--
-- Ursache ist der BEFORE-Trigger trigger_letter_status_change
-- (public.handle_letter_status_change): Er setzt beim Wechsel auf `sent`
-- unbedingt `NEW.sent_by = auth.uid()`. Die Edge Function archive-letter
-- aktualisiert den Brief mit einem Service-Role-Client, also ohne Benutzer-JWT;
-- dort ist auth.uid() NULL. Der ausdrücklich geschriebene Absender
-- (`sent_by: archivalUserId`) wurde damit unmittelbar vor dem Speichern durch
-- NULL ersetzt. `sent_at` fiel nur deshalb nicht auf, weil der Trigger es
-- ohnehin auf now() setzte.
--
-- Die Datenbank bleibt Quelle der Wahrheit:
--   * Liegt eine Anmeldung vor, gewinnt immer der authentifizierte Akteur
--     (auth.uid()). Ein Client kann den Absender damit nicht auf eine andere
--     Person schreiben.
--   * Ohne Benutzer-JWT (Service-Role/interne Aufrufe, etwa die Archivfunktion)
--     bleibt die ausdrücklich übergebene Zuweisung erhalten.
--   * `sent_at` wird analog nur ergänzt, nicht durch eine zweite Zeitquelle
--     ersetzt; `workflow_locked` bleibt wie bisher erzwungen.
--
-- CREATE OR REPLACE FUNCTION genügt: Der bestehende Trigger
-- trigger_letter_status_change ruft weiterhin diese Funktion auf, es werden
-- weder Trigger noch Daten angefasst. Die bestehende Selftest-Erwartung
-- (sent_by = aufrufender Benutzer) prüft die Regel danach unverändert.

CREATE OR REPLACE FUNCTION public.handle_letter_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Beim Wechsel auf `sent` Zeitpunkt, Absender und Workflow-Sperre setzen.
  IF NEW.status = 'sent' AND OLD.status IS DISTINCT FROM 'sent' THEN
    -- Angemeldete Aufrufe: der Akteur ist maßgeblich. Service-Role-Aufrufe
    -- haben kein auth.uid(); dort zählt die bereits gesetzte Zuweisung.
    NEW.sent_by = coalesce(auth.uid(), NEW.sent_by);
    NEW.sent_at = coalesce(NEW.sent_at, now());
    NEW.workflow_locked = true;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_letter_status_change() IS
  'Setzt beim Wechsel auf sent workflow_locked, sent_at und sent_by; ein vorhandenes Benutzer-JWT (auth.uid()) hat Vorrang, ohne JWT bleibt ein ausdrücklich gesetzter Absender erhalten.';
