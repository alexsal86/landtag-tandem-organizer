-- Add notification types for shared quick notes and shared tasks
INSERT INTO public.notification_types (name, label, description, is_active)
VALUES
  ('quick_note_shared', 'Quick Note geteilt', 'Benachrichtigung, wenn eine Quick Note mit dir geteilt wurde', true),
  ('task_shared', 'Aufgabe geteilt', 'Benachrichtigung, wenn dir eine Aufgabe zugewiesen oder mit dir geteilt wurde', true)
ON CONFLICT (name) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
SELECT x.notification_type_name, x.navigation_context
FROM (VALUES
  ('quick_note_shared', 'quicknotes'),
  ('task_shared', 'tasks')
) AS x(notification_type_name, navigation_context)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notification_navigation_mapping nnm
  WHERE nnm.notification_type_name = x.notification_type_name
    AND nnm.navigation_context = x.navigation_context
);
