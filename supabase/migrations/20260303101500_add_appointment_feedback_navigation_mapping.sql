-- Route appointment feedback notifications to the feedback feed
INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
SELECT 'appointment_feedback', 'mywork?tab=feedbackfeed'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notification_navigation_mapping
  WHERE notification_type_name = 'appointment_feedback'
    AND navigation_context = 'mywork?tab=feedbackfeed'
);
