-- Add new notification types for task decisions
INSERT INTO public.notification_types (name, label, description, is_active) VALUES
('task_decision_request', 'Entscheidungsanfrage erhalten', 'Benachrichtigung wenn eine Entscheidungsanfrage gestellt wird', true),
('task_decision_complete', 'Entscheidungsanfrage abgeschlossen', 'Benachrichtigung wenn alle Teilnehmer geantwortet haben', true)
ON CONFLICT (name) DO NOTHING;