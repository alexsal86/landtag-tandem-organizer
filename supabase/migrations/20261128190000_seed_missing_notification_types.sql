-- Meldungstypen, die der Client erzeugt, fehlten im mandantenbezogenen Standard-Seed.
--
-- notification_types ist seit 20261120003000 je Mandant eindeutig (tenant_id, name).
-- create_notification löst den Typ über (tenant_id, name) auf und liefert NULL, wenn er
-- im Büro fehlt. Für per Wizard angelegte Büros gingen damit 14 Typen still verloren,
-- obwohl der Client sie weiter erzeugt. Diese Migration legt sie für alle vorhandenen
-- Büros an und hängt sie für neue Büros an den Tenant-Trigger.
--
-- Idempotent: vorhandene Zeilen bleiben unangetastet (Label, Beschreibung, Kategorie und
-- Aktivierungsstatus werden nicht überschrieben). Bestehende Büros behalten damit auch
-- ältere Kategorien wie 'mywork' oder 'polls' aus früheren Migrationen.

INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id, v.name, v.label, v.description, v.category, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('appointment_feedback', 'Termin-Rückmeldung', 'Eine Rückmeldung zu einem Termin wurde gespeichert.', 'appointments'),
  ('case_item_assigned', 'Vorgang zugewiesen', 'Ein Vorgang wurde dir zugewiesen.', 'casefiles'),
  ('case_item_status_changed', 'Vorgang-Status geändert', 'Der Status eines Vorgangs hat sich geändert.', 'casefiles'),
  ('case_item_comment', 'Vorgang-Kommentar', 'Ein neuer Kommentar zu einem Vorgang ist eingegangen.', 'casefiles'),
  ('employee_meeting_scheduled', 'Gespräch terminiert', 'Ein Mitarbeitergespräch wurde terminiert.', 'employee'),
  ('employee_meeting_request_declined', 'Gesprächsanfrage abgelehnt', 'Eine Gesprächsanfrage wurde abgelehnt.', 'employee'),
  ('news_shared_internal', 'News intern geteilt', 'Eine News wurde mit dir geteilt.', 'team'),
  ('poll_restored', 'Abstimmung wiederhergestellt', 'Eine Terminabstimmung wurde wiederhergestellt.', 'polls'),
  ('task_decision_request', 'Entscheidungsanfrage erhalten', 'Eine neue Entscheidungsanfrage wurde gestellt.', 'decisions'),
  ('task_decision_completed', 'Entscheidungsergebnis verfügbar', 'Alle Antworten zu einer Entscheidungsanfrage sind eingegangen.', 'decisions'),
  ('task_decision_creator_response', 'Antwort auf Ihren Kommentar', 'Der Ersteller hat auf deinen Kommentar geantwortet.', 'decisions'),
  ('task_decision_comment_received', 'Kommentar zu Entscheidungsanfrage', 'Jemand hat auf eine Entscheidungsanfrage mit Kommentar geantwortet.', 'decisions'),
  ('task_decision_comment_reaction_received', 'Neue Reaktion', 'Jemand hat auf einen Entscheidungskommentar reagiert.', 'decisions'),
  ('time_tracking', 'Fehlende Zeiteinträge', 'Für Arbeitstage fehlen Zeiteinträge.', 'time')
) AS v(name, label, description, category)
ON CONFLICT (tenant_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_missing_client_notification_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES
    (NEW.id, 'appointment_feedback', 'Termin-Rückmeldung', 'Eine Rückmeldung zu einem Termin wurde gespeichert.', 'appointments', true),
    (NEW.id, 'case_item_assigned', 'Vorgang zugewiesen', 'Ein Vorgang wurde dir zugewiesen.', 'casefiles', true),
    (NEW.id, 'case_item_status_changed', 'Vorgang-Status geändert', 'Der Status eines Vorgangs hat sich geändert.', 'casefiles', true),
    (NEW.id, 'case_item_comment', 'Vorgang-Kommentar', 'Ein neuer Kommentar zu einem Vorgang ist eingegangen.', 'casefiles', true),
    (NEW.id, 'employee_meeting_scheduled', 'Gespräch terminiert', 'Ein Mitarbeitergespräch wurde terminiert.', 'employee', true),
    (NEW.id, 'employee_meeting_request_declined', 'Gesprächsanfrage abgelehnt', 'Eine Gesprächsanfrage wurde abgelehnt.', 'employee', true),
    (NEW.id, 'news_shared_internal', 'News intern geteilt', 'Eine News wurde mit dir geteilt.', 'team', true),
    (NEW.id, 'poll_restored', 'Abstimmung wiederhergestellt', 'Eine Terminabstimmung wurde wiederhergestellt.', 'polls', true),
    (NEW.id, 'task_decision_request', 'Entscheidungsanfrage erhalten', 'Eine neue Entscheidungsanfrage wurde gestellt.', 'decisions', true),
    (NEW.id, 'task_decision_completed', 'Entscheidungsergebnis verfügbar', 'Alle Antworten zu einer Entscheidungsanfrage sind eingegangen.', 'decisions', true),
    (NEW.id, 'task_decision_creator_response', 'Antwort auf Ihren Kommentar', 'Der Ersteller hat auf deinen Kommentar geantwortet.', 'decisions', true),
    (NEW.id, 'task_decision_comment_received', 'Kommentar zu Entscheidungsanfrage', 'Jemand hat auf eine Entscheidungsanfrage mit Kommentar geantwortet.', 'decisions', true),
    (NEW.id, 'task_decision_comment_reaction_received', 'Neue Reaktion', 'Jemand hat auf einen Entscheidungskommentar reagiert.', 'decisions', true),
    (NEW.id, 'time_tracking', 'Fehlende Zeiteinträge', 'Für Arbeitstage fehlen Zeiteinträge.', 'time', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_missing_client_notification_types() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seed_missing_client_notification_types ON public.tenants;
CREATE TRIGGER seed_missing_client_notification_types
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_missing_client_notification_types();
