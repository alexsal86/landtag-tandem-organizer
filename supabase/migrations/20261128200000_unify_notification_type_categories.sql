-- Vereinheitlicht die Kategorie-Schlüssel der Meldungstypen.
--
-- Der Standard-Seed verwendete bisher eigene Schlüssel (appointments, casefiles,
-- letters), während die Einstellungsseite Gruppen wie calendar, cases und documents
-- kennt. Unbekannte Schlüssel fielen dort auf eine Ersatzgruppe mit rohem Schlüssel
-- als Label zurück, und Typen derselben Fachdomäne landeten in getrennten Gruppen.
--
-- Kanonisch sind die Schlüssel aus CATEGORY_META in
-- src/components/notifications/NotificationSettings.tsx. Diese Migration zieht
-- bestehende Zeilen nach und ersetzt die Seed-Funktionen, damit auch neue Büros und
-- künftig per Trigger angelegte Typen nur noch kanonische Schlüssel erhalten.
-- Idempotent: bereits kanonische Zeilen bleiben unverändert.

UPDATE public.notification_types
SET category = 'calendar'
WHERE category IN ('appointments');

UPDATE public.notification_types
SET category = 'cases'
WHERE category IN ('casefiles', 'mywork');

UPDATE public.notification_types
SET category = 'documents'
WHERE category IN ('letters');

-- Erwähnungen in Vorgängen entstehen künftig in der Gruppe "cases".
CREATE OR REPLACE FUNCTION public.seed_case_interaction_mention_notification_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (
    NEW.id,
    'case_interaction_mention',
    'In Vorgang erwähnt',
    'Du wurdest in einer Interaktion eines Vorgangs erwähnt.',
    'cases',
    true
  )
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_case_interaction_mention_notification_type() FROM PUBLIC, anon, authenticated;

-- Auch die 14 nachgezogenen Client-Typen nutzen für neue Büros sofort die kanonischen
-- Schlüssel (calendar/cases statt appointments/casefiles).
CREATE OR REPLACE FUNCTION public.seed_missing_client_notification_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES
    (NEW.id, 'appointment_feedback', 'Termin-Rückmeldung', 'Eine Rückmeldung zu einem Termin wurde gespeichert.', 'calendar', true),
    (NEW.id, 'case_item_assigned', 'Vorgang zugewiesen', 'Ein Vorgang wurde dir zugewiesen.', 'cases', true),
    (NEW.id, 'case_item_status_changed', 'Vorgang-Status geändert', 'Der Status eines Vorgangs hat sich geändert.', 'cases', true),
    (NEW.id, 'case_item_comment', 'Vorgang-Kommentar', 'Ein neuer Kommentar zu einem Vorgang ist eingegangen.', 'cases', true),
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
