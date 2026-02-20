-- Neuen Notification-Type für Termin-Rückmeldungen anlegen
INSERT INTO notification_types (name, label, description)
VALUES ('appointment_feedback', 'Termin-Rückmeldung', 'Eine Rückmeldung zu einem Termin wurde gespeichert')
ON CONFLICT (name) DO NOTHING;