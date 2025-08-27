-- Insert notification types for task decisions if they don't exist
INSERT INTO public.notification_types (name, label, description, is_active) VALUES
('task_decision_request', 'Entscheidungsanfrage erhalten', 'Benachrichtigung wenn eine neue Entscheidungsanfrage gestellt wird', true),
('task_decision_completed', 'Entscheidungsergebnis verfügbar', 'Benachrichtigung wenn alle Antworten zu einer Entscheidungsanfrage eingegangen sind', true)
ON CONFLICT (name) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;