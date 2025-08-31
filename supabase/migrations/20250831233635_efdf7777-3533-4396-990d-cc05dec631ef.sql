-- Clean up duplicate letters with the same title by keeping only the latest one
DELETE FROM letters 
WHERE id NOT IN (
    SELECT DISTINCT ON (title) id 
    FROM letters 
    ORDER BY title, updated_at DESC
);