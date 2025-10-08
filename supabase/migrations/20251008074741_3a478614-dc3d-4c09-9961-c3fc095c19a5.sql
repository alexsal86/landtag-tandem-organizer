-- Create notification types for employee meeting reminders
-- First check if they exist, only insert if not
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.notification_types WHERE name = 'employee_meeting_overdue') THEN
    INSERT INTO public.notification_types (name, label, description, is_active)
    VALUES ('employee_meeting_overdue', 'Überfälliges Gespräch', 'Mitarbeitergespräch ist überfällig', true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.notification_types WHERE name = 'employee_meeting_due_soon') THEN
    INSERT INTO public.notification_types (name, label, description, is_active)
    VALUES ('employee_meeting_due_soon', 'Gespräch bald fällig', 'Mitarbeitergespräch bald fällig (14/7 Tage)', true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.notification_types WHERE name = 'employee_meeting_request_overdue') THEN
    INSERT INTO public.notification_types (name, label, description, is_active)
    VALUES ('employee_meeting_request_overdue', 'Offene Gesprächsanfrage', 'Unbeantwortete Gesprächsanfrage (>7 Tage)', true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.notification_types WHERE name = 'employee_meeting_action_item_overdue') THEN
    INSERT INTO public.notification_types (name, label, description, is_active)
    VALUES ('employee_meeting_action_item_overdue', 'Überfällige Maßnahme', 'Überfällige Maßnahme aus Gespräch', true);
  END IF;
END $$;

-- Map notification types to navigation contexts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.notification_navigation_mapping WHERE notification_type_name = 'employee_meeting_overdue') THEN
    INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
    VALUES ('employee_meeting_overdue', 'employees');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.notification_navigation_mapping WHERE notification_type_name = 'employee_meeting_due_soon') THEN
    INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
    VALUES ('employee_meeting_due_soon', 'employees');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.notification_navigation_mapping WHERE notification_type_name = 'employee_meeting_request_overdue') THEN
    INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
    VALUES ('employee_meeting_request_overdue', 'employees');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.notification_navigation_mapping WHERE notification_type_name = 'employee_meeting_action_item_overdue') THEN
    INSERT INTO public.notification_navigation_mapping (notification_type_name, navigation_context)
    VALUES ('employee_meeting_action_item_overdue', 'employees');
  END IF;
END $$;