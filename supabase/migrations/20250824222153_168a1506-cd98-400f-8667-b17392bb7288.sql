-- Add triggers for comprehensive notification coverage

-- Task notifications trigger (already exists, just ensuring it's active)
DROP TRIGGER IF EXISTS task_notifications ON public.tasks;
CREATE TRIGGER task_notifications
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_notifications();

-- Appointment notifications trigger (already exists, ensuring it's active)
DROP TRIGGER IF EXISTS appointment_notifications ON public.appointments;
CREATE TRIGGER appointment_notifications
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_notifications();

-- Message notifications trigger (already exists, ensuring it's active)
DROP TRIGGER IF EXISTS message_notifications ON public.messages;
CREATE TRIGGER message_notifications
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_notifications();

-- Message recipient notifications trigger (already exists, ensuring it's active)
DROP TRIGGER IF EXISTS message_recipient_notifications ON public.message_recipients;
CREATE TRIGGER message_recipient_notifications
  AFTER INSERT ON public.message_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_recipient_notifications();

-- Auto archive message trigger (already exists, ensuring it's active)
DROP TRIGGER IF EXISTS auto_archive_message ON public.message_recipients;
CREATE TRIGGER auto_archive_message
  AFTER UPDATE ON public.message_recipients
  FOR EACH ROW
  WHEN (NEW.has_read = true AND OLD.has_read = false)
  EXECUTE FUNCTION public.auto_archive_message();

-- Enable real-time for notifications table
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.notifications;

-- Enable real-time for user_notification_settings table
ALTER TABLE public.user_notification_settings REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.user_notification_settings;

-- Enable real-time for push_subscriptions table
ALTER TABLE public.push_subscriptions REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.push_subscriptions;