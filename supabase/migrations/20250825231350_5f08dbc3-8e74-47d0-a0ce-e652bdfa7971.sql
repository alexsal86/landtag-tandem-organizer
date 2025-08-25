-- Update all external participants without tokens to have valid tokens
DO $$
DECLARE
    participant_record RECORD;
    new_token TEXT;
BEGIN
    FOR participant_record IN 
        SELECT id, email FROM poll_participants 
        WHERE is_external = true AND (token IS NULL OR token = '')
    LOOP
        -- Generate a new token
        SELECT public.generate_participant_token() INTO new_token;
        
        -- Update the participant with the new token
        UPDATE poll_participants 
        SET token = new_token 
        WHERE id = participant_record.id;
        
        RAISE NOTICE 'Updated participant % with token %', participant_record.email, new_token;
    END LOOP;
END $$;