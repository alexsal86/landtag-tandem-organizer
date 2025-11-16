-- Add missing navigation mappings for decision requests
INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
SELECT 'task_decision_request', 'decisions'
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_navigation_mapping 
  WHERE notification_type_name = 'task_decision_request' AND navigation_context = 'decisions'
);

INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
SELECT 'task_decision_complete', 'decisions'
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_navigation_mapping 
  WHERE notification_type_name = 'task_decision_complete' AND navigation_context = 'decisions'
);

INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
SELECT 'task_decision_completed', 'decisions'
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_navigation_mapping 
  WHERE notification_type_name = 'task_decision_completed' AND navigation_context = 'decisions'
);

-- Update existing notifications to have the correct navigation_context
UPDATE public.notifications n
SET navigation_context = nnm.navigation_context
FROM public.notification_navigation_mapping nnm
INNER JOIN public.notification_types nt ON nt.name = nnm.notification_type_name
WHERE n.notification_type_id = nt.id
  AND n.navigation_context IS NULL;