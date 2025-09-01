-- Function to create follow-up task when letter is sent
CREATE OR REPLACE FUNCTION create_letter_followup_task()
RETURNS TRIGGER AS $$
DECLARE
    template_response_days INTEGER := 21;
    task_title TEXT;
    task_description TEXT;
    content_text TEXT;
    due_date_calc TIMESTAMPTZ;
BEGIN
    -- Only proceed if status changed to 'sent'
    IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
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
        
        -- Insert the follow-up task
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
            NULL
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create follow-up tasks
DROP TRIGGER IF EXISTS trigger_letter_followup_task ON letters;
CREATE TRIGGER trigger_letter_followup_task
    AFTER UPDATE ON letters
    FOR EACH ROW
    EXECUTE FUNCTION create_letter_followup_task();