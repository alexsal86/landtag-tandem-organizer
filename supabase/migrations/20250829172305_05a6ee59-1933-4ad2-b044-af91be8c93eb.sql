-- Add trigger to automatically update navigation_context when notifications are created
CREATE OR REPLACE FUNCTION public.set_notification_navigation_context()
RETURNS TRIGGER AS $$
BEGIN
  -- Set navigation_context based on notification type mapping
  SELECT navigation_context INTO NEW.navigation_context
  FROM public.notification_navigation_mapping nnm
  INNER JOIN public.notification_types nt ON nt.name = nnm.notification_type_name
  WHERE nt.id = NEW.notification_type_id
  LIMIT 1;
  
  -- If no mapping found, set to null (will show in all contexts)
  IF NEW.navigation_context IS NULL THEN
    NEW.navigation_context := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-setting navigation context
CREATE TRIGGER trigger_set_notification_navigation_context
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_notification_navigation_context();