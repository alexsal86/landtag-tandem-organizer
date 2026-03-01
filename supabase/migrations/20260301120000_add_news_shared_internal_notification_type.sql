-- Add notification type for internally shared news links
INSERT INTO public.notification_types (name, label, description, is_active)
VALUES (
  'news_shared_internal',
  'News intern geteilt',
  'Benachrichtigung wenn ein Teammitglied einen News-Artikel intern teilt',
  true
)
ON CONFLICT (name) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Route shared news notifications to the notifications area (fallback navigation_context)
INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
SELECT 'news_shared_internal', 'notifications'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notification_navigation_mapping
  WHERE notification_type_name = 'news_shared_internal'
    AND navigation_context = 'notifications'
);
