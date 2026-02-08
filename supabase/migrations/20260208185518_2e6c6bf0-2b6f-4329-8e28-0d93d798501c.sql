
-- Create the trigger on notifications table for automatic push delivery
DROP TRIGGER IF EXISTS push_notification_trigger ON public.notifications;
CREATE TRIGGER push_notification_trigger
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();
