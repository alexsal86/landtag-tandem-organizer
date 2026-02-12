-- Remove redundant push notification triggers and their functions
-- Only trigger_push_on_notification (using notify_push_on_insert) should remain

DROP TRIGGER IF EXISTS notification_push_trigger ON public.notifications;
DROP TRIGGER IF EXISTS push_notification_trigger ON public.notifications;
DROP FUNCTION IF EXISTS handle_notification_push();
DROP FUNCTION IF EXISTS trigger_push_notification();