-- Check current structure of letter_collaborators table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'letter_collaborators' 
AND table_schema = 'public'
ORDER BY ordinal_position;