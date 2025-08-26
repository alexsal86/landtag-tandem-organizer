-- Insert missing notification types for task management
INSERT INTO public.notification_types (name, label, description, is_active) VALUES
  ('task_created', 'Aufgabe erstellt', 'Benachrichtigung wenn eine neue Aufgabe erstellt wird', true),
  ('task_assigned', 'Aufgabe zugewiesen', 'Benachrichtigung wenn eine Aufgabe zugewiesen wird', true),
  ('task_updated', 'Aufgabe aktualisiert', 'Benachrichtigung wenn eine Aufgabe aktualisiert wird', true)
ON CONFLICT (name) DO NOTHING;