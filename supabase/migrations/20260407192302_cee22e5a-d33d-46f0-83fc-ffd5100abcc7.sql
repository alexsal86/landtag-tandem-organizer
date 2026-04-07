
UPDATE public.notification_navigation_mapping
SET navigation_context = 'mywork'
WHERE notification_type_name IN (
  'task_decision_request',
  'task_decision_complete',
  'task_decision_completed',
  'task_decision_comment_received',
  'task_decision_creator_response'
)
AND navigation_context = 'decisions';

UPDATE public.notifications
SET navigation_context = 'mywork'
WHERE navigation_context = 'decisions'
AND is_read = false;
