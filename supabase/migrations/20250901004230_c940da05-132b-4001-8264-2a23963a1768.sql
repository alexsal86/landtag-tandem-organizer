-- Test the current policies by updating a simple field first
-- Let's check if the update policy works at all by updating a non-problematic field
UPDATE letters 
SET subject = COALESCE(subject, '') || ' (Test)'
WHERE id = 'c96e81db-47dd-450b-a562-5a6d929bf624';