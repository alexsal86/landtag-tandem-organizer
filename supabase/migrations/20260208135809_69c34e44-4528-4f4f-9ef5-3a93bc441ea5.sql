-- Create the document_mention notification type for @mentions in editors
INSERT INTO public.notification_types (name, label, description, is_active)
VALUES (
  'document_mention',
  'Erwähnung in Dokument',
  'Benachrichtigung wenn Sie in einem Dokument erwähnt werden',
  true
)
ON CONFLICT (name) DO NOTHING;