
-- Add navigation context mapping for case item notifications
INSERT INTO notification_navigation_mapping (notification_type_name, navigation_context)
VALUES
  ('case_item_created', 'mywork'),
  ('case_item_assigned', 'mywork'),
  ('case_item_status_changed', 'mywork'),
  ('case_item_comment', 'mywork')
ON CONFLICT DO NOTHING;
