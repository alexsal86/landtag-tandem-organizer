-- Add missing notification type for task updates
INSERT INTO public.notification_types (name, label, description, is_active) 
VALUES ('task_updated', 'Task Updated', 'Notification when a task is updated', true)
ON CONFLICT (name) DO NOTHING;