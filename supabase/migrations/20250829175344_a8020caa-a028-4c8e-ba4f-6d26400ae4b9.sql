-- Fix task notifications function - correct data type handling
CREATE OR REPLACE FUNCTION public.handle_task_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  assigned_user_text text;
  assigned_user_ids text[];
BEGIN
  -- Task created notification (only for creator)
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'task_created',
      'Neue Aufgabe erstellt',
      'Die Aufgabe "' || NEW.title || '" wurde erstellt.',
      jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title),
      CASE NEW.priority 
        WHEN 'high' THEN 'high' 
        WHEN 'urgent' THEN 'urgent' 
        ELSE 'medium' 
      END
    );

    -- Assignment notifications (only if assigned to someone other than creator)
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != '' THEN
      -- Split assigned_to by comma and loop through each assigned user
      assigned_user_ids := string_to_array(trim(NEW.assigned_to), ',');
      
      FOREACH assigned_user_text IN ARRAY assigned_user_ids
      LOOP
        -- Clean up the user ID and validate it's a valid UUID
        assigned_user_text := trim(assigned_user_text);
        
        -- Only send notification if it's not the creator and is a valid UUID
        IF assigned_user_text != NEW.user_id::text AND assigned_user_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          PERFORM public.create_notification(
            assigned_user_text::uuid,
            'task_assigned',
            'Aufgabe zugewiesen',
            'Ihnen wurde die Aufgabe "' || NEW.title || '" zugewiesen.',
            jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title),
            CASE NEW.priority 
              WHEN 'high' THEN 'high' 
              WHEN 'urgent' THEN 'urgent' 
              ELSE 'medium' 
            END
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Task updated notification (only for status changes or priority changes)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status != OLD.status THEN
      PERFORM public.create_notification(
        NEW.user_id,
        'task_updated',
        'Aufgabenstatus geändert',
        'Aufgabe "' || NEW.title || '" Status geändert von "' || OLD.status || '" zu "' || NEW.status || '".',
        jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title, 'old_status', OLD.status, 'new_status', NEW.status),
        'medium'
      );
    END IF;

    IF NEW.priority != OLD.priority THEN
      PERFORM public.create_notification(
        NEW.user_id,
        'task_updated',
        'Aufgabenpriorität geändert',
        'Aufgabe "' || NEW.title || '" Priorität geändert von "' || OLD.priority || '" zu "' || NEW.priority || '".',
        jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title, 'old_priority', OLD.priority, 'new_priority', NEW.priority),
        CASE NEW.priority 
          WHEN 'high' THEN 'high' 
          WHEN 'urgent' THEN 'urgent' 
          ELSE 'medium' 
        END
      );
    END IF;

    -- Handle assignment changes
    IF NEW.assigned_to != OLD.assigned_to THEN
      -- Send notifications to newly assigned users
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != '' THEN
        assigned_user_ids := string_to_array(trim(NEW.assigned_to), ',');
        
        FOREACH assigned_user_text IN ARRAY assigned_user_ids
        LOOP
          assigned_user_text := trim(assigned_user_text);
          
          -- Only send notification if it's not the creator and is a valid UUID
          IF assigned_user_text != NEW.user_id::text AND assigned_user_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            -- Check if this user wasn't already assigned
            IF OLD.assigned_to IS NULL OR OLD.assigned_to = '' OR position(assigned_user_text IN OLD.assigned_to) = 0 THEN
              PERFORM public.create_notification(
                assigned_user_text::uuid,
                'task_assigned',
                'Aufgabe zugewiesen',
                'Ihnen wurde die Aufgabe "' || NEW.title || '" zugewiesen.',
                jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title),
                CASE NEW.priority 
                  WHEN 'high' THEN 'high' 
                  WHEN 'urgent' THEN 'urgent' 
                  ELSE 'medium' 
                END
              );
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;