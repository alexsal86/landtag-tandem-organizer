
-- Step 1: Add category column to notification_types
ALTER TABLE public.notification_types 
ADD COLUMN IF NOT EXISTS category text;

-- Step 2: Update categories for all existing types
UPDATE public.notification_types SET category = 'tasks' WHERE name IN ('task_created', 'task_assigned', 'task_updated', 'task_due');
UPDATE public.notification_types SET category = 'decisions' WHERE name IN ('task_decision_request', 'task_decision_completed', 'task_decision_complete', 'task_decision_comment_received', 'task_decision_creator_response');
UPDATE public.notification_types SET category = 'calendar' WHERE name = 'appointment_reminder';
UPDATE public.notification_types SET category = 'messages' WHERE name = 'message_received';
UPDATE public.notification_types SET category = 'documents' WHERE name IN ('document_created', 'document_mention');
UPDATE public.notification_types SET category = 'knowledge' WHERE name = 'knowledge_document_created';
UPDATE public.notification_types SET category = 'meetings' WHERE name = 'meeting_created';
UPDATE public.notification_types SET category = 'employee' WHERE name IN ('employee_meeting_overdue', 'employee_meeting_due_soon', 'employee_meeting_due', 'employee_meeting_reminder', 'employee_meeting_request_overdue', 'employee_meeting_requested', 'employee_meeting_scheduled', 'employee_meeting_action_item_overdue');
UPDATE public.notification_types SET category = 'time' WHERE name IN ('vacation_request_pending', 'sick_leave_request_pending');
UPDATE public.notification_types SET category = 'notes' WHERE name = 'note_follow_up';
UPDATE public.notification_types SET category = 'polls' WHERE name IN ('poll_auto_cancelled', 'poll_auto_completed', 'poll_restored');
UPDATE public.notification_types SET category = 'system' WHERE name IN ('budget_exceeded', 'system_update');

-- Step 3: Insert new notification types that are missing
INSERT INTO public.notification_types (name, label, description, is_active, category) VALUES
  ('employee_meeting_request_declined', 'Gesprächsanfrage abgelehnt', 'Benachrichtigung wenn eine Gesprächsanfrage abgelehnt wird', true, 'employee'),
  ('letter_review_requested', 'Brief zur Prüfung', 'Benachrichtigung wenn ein Brief zur Prüfung zugewiesen wird', true, 'documents'),
  ('letter_review_completed', 'Brief geprüft', 'Benachrichtigung wenn ein Brief genehmigt oder zurückgewiesen wird', true, 'documents'),
  ('letter_sent', 'Brief versendet', 'Benachrichtigung wenn ein Brief als versendet markiert wird', true, 'documents'),
  ('planning_collaborator_added', 'Zu Planung hinzugefügt', 'Benachrichtigung wenn Sie als Mitarbeiter zu einer Planung hinzugefügt werden', true, 'planning'),
  ('team_announcement_created', 'Neue Team-Mitteilung', 'Benachrichtigung bei neuen Team-Mitteilungen', true, 'system'),
  ('leave_request_approved', 'Antrag genehmigt', 'Benachrichtigung wenn Ihr Urlaubs-/Abwesenheitsantrag genehmigt wird', true, 'time'),
  ('leave_request_rejected', 'Antrag abgelehnt', 'Benachrichtigung wenn Ihr Urlaubs-/Abwesenheitsantrag abgelehnt wird', true, 'time')
ON CONFLICT (name) DO NOTHING;

-- Step 4: Add missing navigation mappings
INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context) VALUES
  ('task_due', 'tasks'),
  ('document_mention', 'documents'),
  ('employee_meeting_due', 'employee'),
  ('employee_meeting_reminder', 'employee'),
  ('employee_meeting_requested', 'employee'),
  ('employee_meeting_scheduled', 'employee'),
  ('note_follow_up', 'mywork'),
  ('poll_auto_cancelled', 'calendar'),
  ('poll_auto_completed', 'calendar'),
  ('poll_restored', 'calendar'),
  ('budget_exceeded', 'tasks'),
  ('system_update', 'tasks'),
  ('employee_meeting_request_declined', 'employee'),
  ('letter_review_requested', 'documents'),
  ('letter_review_completed', 'documents'),
  ('letter_sent', 'documents'),
  ('planning_collaborator_added', 'eventplanning'),
  ('team_announcement_created', 'mywork'),
  ('leave_request_approved', 'time'),
  ('leave_request_rejected', 'time')
ON CONFLICT DO NOTHING;
