-- Register note_follow_up notification type
INSERT INTO public.notification_types (name, label, description, is_active)
VALUES (
  'note_follow_up',
  'Fällige Wiedervorlage',
  'Benachrichtigung wenn eine Notiz-Wiedervorlage fällig ist',
  true
)
ON CONFLICT (name) DO NOTHING;