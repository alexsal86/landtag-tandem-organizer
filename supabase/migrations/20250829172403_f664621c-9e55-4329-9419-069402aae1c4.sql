-- Update existing notifications with navigation contexts based on their types
UPDATE public.notifications 
SET navigation_context = nnm.navigation_context
FROM public.notification_navigation_mapping nnm
INNER JOIN public.notification_types nt ON nt.name = nnm.notification_type_name
WHERE notifications.notification_type_id = nt.id 
  AND notifications.navigation_context IS NULL;