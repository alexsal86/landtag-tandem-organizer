-- Now test the status change directly
UPDATE letters 
SET status = 'approved', updated_at = now()
WHERE id = 'c96e81db-47dd-450b-a562-5a6d929bf624';