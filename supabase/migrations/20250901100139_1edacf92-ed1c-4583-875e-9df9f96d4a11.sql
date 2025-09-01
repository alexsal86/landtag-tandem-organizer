-- Now create follow-up tasks for the already sent letters
DO $$ 
DECLARE
    letter_record RECORD;
    template_response_days INTEGER := 21;
    task_title TEXT;
    task_description TEXT;
    content_text TEXT;
    due_date_calc TIMESTAMPTZ;
BEGIN
    -- Process the two sent letters
    FOR letter_record IN 
        SELECT id, title, subject, content, created_by, tenant_id, sent_date, template_id
        FROM letters 
        WHERE title IN ('sdfsdfsdfsd', 'sdfsdsdfsdff') 
        AND status = 'sent'
    LOOP
        -- Get response time from template if available
        IF letter_record.template_id IS NOT NULL THEN
            SELECT response_time_days INTO template_response_days
            FROM letter_templates
            WHERE id = letter_record.template_id;
            
            IF template_response_days IS NULL THEN
                template_response_days := 21;
            END IF;
        END IF;
        
        -- Calculate due date from sent_date
        due_date_calc := COALESCE(letter_record.sent_date::DATE, CURRENT_DATE) + INTERVAL '1 day' * template_response_days;
        
        -- Create task title
        task_title := 'Abgeordnetenbrief "' || COALESCE(letter_record.subject, letter_record.title) || '" vom ' || 
                     TO_CHAR(COALESCE(letter_record.sent_date::DATE, CURRENT_DATE), 'DD.MM.YYYY');
        
        -- Create task description from letter content (first 300 chars)
        content_text := COALESCE(letter_record.content, '');
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
            letter_record.created_by,
            letter_record.tenant_id,
            task_title,
            task_description,
            due_date_calc,
            'medium',
            'todo',
            'abgeordnetenbrief',
            NULL
        );
        
        RAISE NOTICE 'Follow-up task created for letter: %', letter_record.title;
    END LOOP;
END $$;