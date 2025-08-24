-- Ensure all notification triggers are active
DROP TRIGGER IF EXISTS task_notifications ON public.tasks;
CREATE TRIGGER task_notifications
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_notifications();

DROP TRIGGER IF EXISTS appointment_notifications ON public.appointments;
CREATE TRIGGER appointment_notifications
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_notifications();

DROP TRIGGER IF EXISTS message_notifications ON public.messages;
CREATE TRIGGER message_notifications
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_notifications();

DROP TRIGGER IF EXISTS message_recipient_notifications ON public.message_recipients;
CREATE TRIGGER message_recipient_notifications
  AFTER INSERT ON public.message_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_recipient_notifications();