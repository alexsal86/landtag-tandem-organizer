-- Erstelle einfach das Dokument ohne den Brief-Status zu ändern
DO $$
DECLARE
    letter_record RECORD;
    new_document_id UUID;
BEGIN
    -- Finde alle versendeten Briefe ohne archivierte Dokumente
    FOR letter_record IN 
        SELECT * FROM letters 
        WHERE status = 'sent' AND archived_document_id IS NULL
    LOOP
        -- Erstelle Dokument-Eintrag für den Brief
        INSERT INTO documents (
            user_id,
            tenant_id,
            title,
            description,
            file_name,
            file_path,
            file_type,
            category,
            tags,
            status,
            document_type,
            source_letter_id
        ) VALUES (
            letter_record.created_by,
            letter_record.tenant_id,
            'Brief: ' || letter_record.title,
            'Archivierte Version des Briefes "' || letter_record.title || '"',
            'letter_' || REPLACE(letter_record.title, ' ', '_') || '_' || EXTRACT(EPOCH FROM NOW())::text || '.pdf',
            'archived_letters/letter_' || REPLACE(letter_record.title, ' ', '_') || '_' || EXTRACT(EPOCH FROM NOW())::text || '.pdf',
            'application/pdf',
            'correspondence',
            ARRAY['archiviert', 'brief'],
            'archived',
            'archived_letter',
            letter_record.id
        ) RETURNING id INTO new_document_id;

        -- Aktualisiere nur die Dokumenten-ID, ohne den Status zu ändern
        UPDATE letters 
        SET 
            archived_document_id = new_document_id,
            sent_at = COALESCE(sent_at, now()),
            sent_by = COALESCE(sent_by, created_by)
        WHERE id = letter_record.id;
        
        RAISE NOTICE 'Brief % wurde archiviert als Dokument %', letter_record.title, new_document_id;
    END LOOP;
END;
$$;