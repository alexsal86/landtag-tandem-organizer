-- Test the status change again after fixing the trigger
UPDATE letters 
SET status = 'approved', updated_at = now()
WHERE id = 'c96e81db-47dd-450b-a562-5a6d929bf624';