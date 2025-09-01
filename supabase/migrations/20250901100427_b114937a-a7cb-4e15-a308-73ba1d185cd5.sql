-- Update the trigger function to assign follow-up tasks to letter creator
CREATE OR REPLACE FUNCTION public.create_letter_followup_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    template_response_days INTEGER := 21;
    task_title TEXT;
    task_description TEXT;
    content_text TEXT;
    due_date_calc TIMESTAMPTZ;
    task_id UUID;
BEGIN
    -- Only proceed if status changed to 'sent'
    IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
        
        -- Log trigger execution (for debugging)
        RAISE NOTICE 'Creating follow-up task for letter: % (title: %)', NEW.id, NEW.title;
        
        -- Get response time from template if available
        IF NEW.template_id IS NOT NULL THEN
            SELECT response_time_days INTO template_response_days
            FROM letter_templates
            WHERE id = NEW.template_id;
            
            IF template_response_days IS NULL THEN
                template_response_days := 21;
            END IF;
        END IF;
        
        -- Calculate due date
        due_date_calc := CURRENT_DATE + INTERVAL '1 day' * template_response_days;
        
        -- Create task title
        task_title := 'Abgeordnetenbrief "' || COALESCE(NEW.subject, NEW.title) || '" vom ' || 
                     TO_CHAR(COALESCE(NEW.sent_date::DATE, CURRENT_DATE), 'DD.MM.YYYY');
        
        -- Create task description from letter content (first 300 chars)
        content_text := COALESCE(NEW.content, '');
        IF LENGTH(content_text) > 300 THEN
            task_description := LEFT(content_text, 300) || '...';
        ELSE
            task_description := content_text;
        END IF;
        
        -- Insert the follow-up task, assigned to the letter creator
        INSERT INTO tasks (
            user_id,
            tenant_id,
            title,
            description,
            due_date,
            priority,
            status,
            category,
            assigned_to
        ) VALUES (
            NEW.created_by,
            NEW.tenant_id,
            task_title,
            task_description,
            due_date_calc,
            'medium',
            'todo',
            'abgeordnetenbrief',
            NEW.created_by::text  -- Assign to letter creator
        ) RETURNING id INTO task_id;
        
        RAISE NOTICE 'Follow-up task created with ID: % and assigned to: %', task_id, NEW.created_by;
        
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the letter update
        RAISE NOTICE 'Error creating follow-up task for letter %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$function$;

-- Update existing follow-up tasks to assign them to their letter creators
UPDATE tasks 
SET assigned_to = (
    SELECT l.created_by::text 
    FROM letters l 
    WHERE l.title IN ('sdfsdfsdfsd', 'sdfsdsdfsdff') 
    AND l.status = 'sent'
    AND tasks.title LIKE 'Abgeordnetenbrief "' || COALESCE(l.subject, l.title) || '"%'
    LIMIT 1
)
WHERE category = 'abgeordnetenbrief' 
AND title LIKE 'Abgeordnetenbrief %'
AND assigned_to IS NULL;