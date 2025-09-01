-- Test changing status to 'sent'
UPDATE letters 
SET status = 'sent', updated_at = now()
WHERE id = 'c96e81db-47dd-450b-a562-5a6d929bf624';